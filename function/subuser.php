<?php
/**
 * 子用户（实例子用户）
 * ---------------------------------------------------------------------------
 * v2 数据模型 —— 子用户归属「实例组」，而不是某个实例
 *   user/<实例组标识>/_subusers.json
 *   [
 *     {
 *       "username":    "alice",
 *       "secretHash":  "<password_hash>",
 *       "secretPlain": "<明文，仅用于实例组主人回显/复制>",
 *       "allowed":     ["*"] 或 ["实例A", "实例B"],
 *       "createdAt":   1734567890,
 *       "createdBy":   "<主人 user id>"
 *     }
 *   ]
 *   allowed 中的 "*" 表示「实例组内全部实例」。
 *
 * v1 数据（按实例）：user/<实例组标识>/<实例ID>_subusers.json
 *   -> 首次读取时自动合并进 _subusers.json 并删除旧文件（allowed 取并集）。
 *
 * 修复的认证问题：
 *   1. 旧 verifyInDir() 会遍历目录下所有 *_subusers.json 并取「第一个」同名的
 *      用户，同名子用户会互相污染，导致凭据正确也认证失败。
 *      v2 直接按实例组读一份文件，用户名全局唯一。
 *   2. directoryId / terminalId 之前未做任何格式校验，可用 ../ 穿越目录。
 *   3. subList / subLoad 之前把密钥放在 GET query 上（浏览器历史、服务器日志、
 *      Referer 都会泄露），现在只接受 POST。
 *   4. 增加失败次数锁定，避免密钥被在线暴力枚举。
 */
class subuser
{
  const MAX_USERS = 5;
  const MAX_ATTEMPTS = 8;
  const ATTEMPT_WINDOW = 600; // 统计窗口（秒）
  const LOCK_SECONDS = 600;   // 锁定时长（秒）

  /* ===================== 路径与存储 ===================== */

  public static function dirById($directoryId)
  {
    return $GLOBALS['RUNDIR'] . 'user/' . $directoryId;
  }

  /** v2：实例组级子用户文件 */
  public static function filePath($directoryId)
  {
    return subuser::dirById($directoryId) . '/_subusers.json';
  }

  public static function ensureDir($directoryId)
  {
    $dir = subuser::dirById($directoryId);
    if (!is_dir($dir)) {
      mkdir($dir, 0755, true);
    }
    return $dir;
  }

  /** 列出实例组内可用的实例（即 <实例ID>.cses） */
  public static function listTerminals($directoryId)
  {
    $dir = subuser::dirById($directoryId);
    $list = [];
    if (is_dir($dir)) {
      foreach (scandir($dir) as $f) {
        if (pathinfo($f, PATHINFO_EXTENSION) === 'cses') {
          $list[] = pathinfo($f, PATHINFO_FILENAME);
        }
      }
    }
    sort($list, SORT_NATURAL | SORT_FLAG_CASE);
    return $list;
  }

  /** 旧的按实例子用户文件：<实例ID>_subusers.json */
  private static function legacyFiles($dir)
  {
    $out = [];
    if (!is_dir($dir)) return $out;
    $suffix = '_subusers.json';
    foreach (scandir($dir) as $f) {
      if ($f === '_subusers.json') continue;
      if (strlen($f) <= strlen($suffix)) continue;
      if (substr($f, -strlen($suffix)) !== $suffix) continue;
      $terminalId = substr($f, 0, -strlen($suffix));
      if ($terminalId === '') continue;
      $out[$dir . '/' . $f] = $terminalId;
    }
    return $out;
  }

  /**
   * 读取实例组子用户列表。
   * $migrate = true 时会把 v1 的按实例文件合并进来（allowed 取并集）并删除旧文件。
   */
  public static function read($directoryId, $migrate = true)
  {
    $dir = subuser::dirById($directoryId);
    if (!is_dir($dir)) return [];

    $list = [];
    $main = $dir . '/_subusers.json';
    if (file_exists($main)) {
      $data = json_decode((string)file_get_contents($main), true);
      if (is_array($data)) $list = $data;
    }

    if (!$migrate) return $list;

    $legacy = subuser::legacyFiles($dir);
    if (count($legacy) === 0) return $list;

    foreach ($legacy as $file => $terminalId) {
      $data = json_decode((string)file_get_contents($file), true);
      if (!is_array($data)) continue;
      foreach ($data as $u) {
        if (!isset($u['username']) || !is_string($u['username']) || $u['username'] === '') continue;
        $list = subuser::mergeUser($list, $u, $terminalId);
      }
    }
    subuser::write($directoryId, $list);
    foreach ($legacy as $file => $terminalId) {
      @unlink($file);
    }
    return $list;
  }

  /** 把旧记录合并进新列表：同名用户合并 allowed，凭据取先出现的（非空优先） */
  private static function mergeUser($list, $u, $terminalId)
  {
    $username = (string)$u['username'];
    foreach ($list as $i => $e) {
      if (!isset($e['username']) || $e['username'] !== $username) continue;
      $cur = (isset($e['allowed']) && is_array($e['allowed'])) ? $e['allowed'] : [];
      if (!in_array('*', $cur, true) && !in_array($terminalId, $cur, true)) {
        $cur[] = $terminalId;
      }
      $list[$i]['allowed'] = array_values($cur);
      if (empty($list[$i]['secretHash']) && !empty($u['secretHash'])) $list[$i]['secretHash'] = $u['secretHash'];
      if (empty($list[$i]['secretPlain']) && !empty($u['secretPlain'])) $list[$i]['secretPlain'] = $u['secretPlain'];
      if (empty($list[$i]['createdAt']) && !empty($u['createdAt'])) $list[$i]['createdAt'] = $u['createdAt'];
      return $list;
    }
    $list[] = [
      'username' => $username,
      'secretHash' => isset($u['secretHash']) ? (string)$u['secretHash'] : '',
      'secretPlain' => isset($u['secretPlain']) ? (string)$u['secretPlain'] : '',
      'allowed' => subuser::validTerminalId($terminalId) ? [$terminalId] : ['*'],
      'createdAt' => isset($u['createdAt']) ? (int)$u['createdAt'] : 0,
    ];
    return $list;
  }

  public static function write($directoryId, $list)
  {
    $dir = subuser::ensureDir($directoryId);
    $path = $dir . '/_subusers.json';
    file_put_contents(
      $path,
      json_encode(array_values($list), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
      LOCK_EX
    );
    @chmod($path, 0600);
  }

  /* ===================== 凭据 ===================== */

  private static function isStrongSecret($s)
  {
    if (!is_string($s) || strlen($s) < 8) return false;
    if (!preg_match('/[a-z]/', $s)) return false;
    if (!preg_match('/[A-Z]/', $s)) return false;
    if (!preg_match('/\d/', $s)) return false;
    if (!preg_match('/[^a-zA-Z\d]/', $s)) return false;
    return true;
  }

  /** allowed 归一化：null/'' -> ['*']；'a,b' 或 ['a','b'] -> 过滤为组内真实存在的实例 */
  public static function normalizeAllowed($allowedRaw, $directoryId)
  {
    if ($allowedRaw === null || $allowedRaw === '' || $allowedRaw === false) {
      return ['*'];
    }
    if (is_string($allowedRaw)) {
      $allowedRaw = array_map('trim', explode(',', $allowedRaw));
    }
    if (!is_array($allowedRaw)) return ['*'];

    $instances = subuser::listTerminals($directoryId);
    $out = [];
    foreach ($allowedRaw as $t) {
      if (!is_string($t) && !is_numeric($t)) continue;
      $t = (string)$t;
      if ($t === '*') return ['*'];
      if ($t === '') continue;
      if (!in_array($t, $instances, true)) continue; // 只接受组内已存在的实例
      if (!in_array($t, $out, true)) $out[] = $t;
    }
    return array_values($out);
  }

  /** 把 allowed 展开成真实实例列表 */
  public static function allowedTerminals($directoryId, $user)
  {
    $all = subuser::listTerminals($directoryId);
    $allowed = (isset($user['allowed']) && is_array($user['allowed'])) ? $user['allowed'] : [];
    if (in_array('*', $allowed, true)) return $all;
    return array_values(array_intersect($all, $allowed));
  }

  /**
   * 校验子用户凭据。
   * @return array|null 命中的用户记录；失败返回 null
   */
  public static function verify($directoryId, $username, $secret)
  {
    if (!tool::validDirId($directoryId)) return null;
    if (!is_string($username) || $username === '') return null;
    if (!is_string($secret) || $secret === '') return null;
    if (subuser::isLocked($directoryId, $username)) return null;

    $match = null;
    foreach (subuser::read($directoryId) as $u) {
      if (!isset($u['username'], $u['secretHash'])) continue;
      if ($u['username'] !== $username) continue; // 用户名在组内唯一
      if ($u['secretHash'] !== '' && password_verify($secret, $u['secretHash'])) {
        $match = $u;
      }
      break;
    }

    if ($match !== null) {
      subuser::clearFailures($directoryId, $username);
      return $match;
    }
    subuser::recordFailure($directoryId, $username);
    return null;
  }

  /**
   * 校验凭据 + 确认该子用户对该实例有权限。
   * @return array|null
   */
  public static function authorize($directoryId, $username, $secret, $terminalId)
  {
    if (!tool::validTerminalId($terminalId)) return null;
    $user = subuser::verify($directoryId, $username, $secret);
    if ($user === null) return null;
    if (!in_array($terminalId, subuser::allowedTerminals($directoryId, $user), true)) return null;
    return $user;
  }

  /* ===================== 失败锁定 ===================== */

  private static function attemptsPath($directoryId)
  {
    return subuser::dirById($directoryId) . '/_subusers_attempts.json';
  }

  private static function attemptsKey($username)
  {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : 'unknown';
    return substr(sha1($username . '|' . $ip), 0, 16);
  }

  private static function readAttempts($directoryId)
  {
    $data = [];
    try {
      $path = subuser::attemptsPath($directoryId);
      if (file_exists($path)) {
        $decoded = json_decode((string)file_get_contents($path), true);
        if (is_array($decoded)) $data = $decoded;
      }
    } catch (\Throwable $e) {
      $data = [];
    }
    return $data;
  }

  private static function isLocked($directoryId, $username)
  {
    $data = subuser::readAttempts($directoryId);
    if (count($data) === 0) return false;
    $key = subuser::attemptsKey($username);
    if (!isset($data[$key]) || !is_array($data[$key])) return false;
    return ((int)($data[$key]['lockedUntil'] ?? 0)) > time();
  }

  private static function recordFailure($directoryId, $username)
  {
    try {
      if (!is_dir(subuser::dirById($directoryId))) return;
      $data = subuser::readAttempts($directoryId);
      $key = subuser::attemptsKey($username);
      $now = time();
      $rec = (isset($data[$key]) && is_array($data[$key])) ? $data[$key] : [];
      $firstAt = (int)($rec['firstAt'] ?? $now);
      $count = (int)($rec['count'] ?? 0);
      if ($now - $firstAt > self::ATTEMPT_WINDOW) {
        $firstAt = $now;
        $count = 0;
      }
      $count++;
      $rec = ['count' => $count, 'firstAt' => $firstAt, 'lockedUntil' => 0];
      if ($count >= self::MAX_ATTEMPTS) {
        $rec['lockedUntil'] = $now + self::LOCK_SECONDS;
        $rec['count'] = 0;
        $rec['firstAt'] = $now;
      }
      $data[$key] = $rec;

      // 清理长期无活动的记录，避免文件无限增长
      foreach ($data as $k => $v) {
        if (!is_array($v)) {
          unset($data[$k]);
          continue;
        }
        $stale = ((int)($v['lockedUntil'] ?? 0)) < ($now - self::ATTEMPT_WINDOW)
          && ((int)($v['firstAt'] ?? 0)) < ($now - self::ATTEMPT_WINDOW);
        if ($stale) unset($data[$k]);
      }
      if (count($data) > 200) {
        $data = array_slice($data, -200, null, true);
      }
      file_put_contents(subuser::attemptsPath($directoryId), json_encode($data), LOCK_EX);
    } catch (\Throwable $e) {
      // 限流失败不能影响正常认证流程
    }
  }

  private static function clearFailures($directoryId, $username)
  {
    try {
      $path = subuser::attemptsPath($directoryId);
      if (!file_exists($path)) return;
      $data = subuser::readAttempts($directoryId);
      $key = subuser::attemptsKey($username);
      if (!isset($data[$key])) return;
      unset($data[$key]);
      file_put_contents($path, json_encode($data), LOCK_EX);
    } catch (\Throwable $e) {
    }
  }

  /* ===================== 主人侧（需登录） ===================== */

  /** 校验登录态并返回主人的实例组标识 */
  private static function requireOwnerDir()
  {
    if (!isset($_SESSION['user']['id']) || $_SESSION['user']['id'] === '') {
      tool::json(['success' => false, 'error' => '未登录'], 401);
    }
    return user::getDir($_SESSION['user']['id'], false, true);
  }

  private static function publicUser($u)
  {
    return [
      'username' => isset($u['username']) ? (string)$u['username'] : '',
      'allowed' => (isset($u['allowed']) && is_array($u['allowed'])) ? array_values($u['allowed']) : [],
      'createdAt' => isset($u['createdAt']) ? (int)$u['createdAt'] : 0,
    ];
  }

  /** 列出当前实例组的所有子用户（含可管理实例范围） */
  public static function getForOwner($terminalId)
  {
    $directoryId = subuser::requireOwnerDir();
    $users = subuser::read($directoryId);
    $out = [];
    foreach ($users as $u) {
      if (!isset($u['username'])) continue;
      $out[] = subuser::publicUser($u);
    }
    tool::json([
      'success' => true,
      'directoryId' => $directoryId,
      'users' => $out,
      'instances' => subuser::listTerminals($directoryId),
      'maxUsers' => self::MAX_USERS,
    ]);
  }

  /**
   * 创建子用户。
   * $terminalId 只用于确认调用者是站在某个有效实例上操作（也作为 allowed 的默认值来源）。
   * $allowedRaw 为空时默认 ['*']（可管理实例组内全部实例）。
   */
  public static function addForOwner($terminalId, $username, $secretRaw = '', $allowedRaw = null)
  {
    $directoryId = subuser::requireOwnerDir();

    if (!tool::validTerminalId($terminalId)) {
      tool::json(['success' => false, 'error' => '实例ID不合法']);
    }
    $username = is_string($username) ? trim($username) : '';
    if (!tool::validUsername($username)) {
      tool::json(['success' => false, 'error' => '子用户名不合法（不能为空，且不能包含空白或 / \\ : * ? " < > | ）']);
    }

    $list = subuser::read($directoryId);
    foreach ($list as $u) {
      if (isset($u['username']) && $u['username'] === $username) {
        tool::json(['success' => false, 'error' => '该实例组已存在同名子用户']);
      }
    }
    if (count($list) >= self::MAX_USERS) {
      tool::json(['success' => false, 'error' => '子用户数量已达上限（' . self::MAX_USERS . ' 个）']);
    }

    $secret = $secretRaw;
    if (!is_string($secret) || $secret === '') {
      $secret = bin2hex(random_bytes(16));
    } elseif (!subuser::isStrongSecret($secret)) {
      tool::json(['success' => false, 'error' => '密码强度不足（至少8位，含大小写、数字、特殊字符）']);
    }

    $allowed = subuser::normalizeAllowed($allowedRaw, $directoryId);
    $list[] = [
      'username' => $username,
      'secretHash' => password_hash($secret, PASSWORD_DEFAULT),
      'secretPlain' => $secret,
      'allowed' => $allowed,
      'createdAt' => time(),
      'createdBy' => (string)$_SESSION['user']['id'],
    ];
    subuser::write($directoryId, $list);

    tool::json([
      'success' => true,
      'username' => $username,
      'secret' => $secret,
      'allowed' => $allowed,
    ]);
  }

  /**
   * 修改子用户可管理的实例范围。
   * $allowedRaw 支持 '*' / '实例A,实例B' / ['实例A','实例B']；
   * 传空（null 或 ''）会被视为「全部实例」。
   */
  public static function setAllowedForOwner($terminalId, $username, $allowedRaw)
  {
    $directoryId = subuser::requireOwnerDir();
    if (!tool::validTerminalId($terminalId)) {
      tool::json(['success' => false, 'error' => '实例ID不合法']);
    }
    $list = subuser::read($directoryId);
    $found = false;
    foreach ($list as $i => $u) {
      if (!isset($u['username']) || $u['username'] !== $username) continue;
      $list[$i]['allowed'] = subuser::normalizeAllowed($allowedRaw, $directoryId);
      $found = true;
    }
    if (!$found) {
      tool::json(['success' => false, 'error' => '子用户不存在']);
    }
    subuser::write($directoryId, $list);
    tool::json(['success' => true]);
  }

  public static function deleteForOwner($terminalId, $username)
  {
    $directoryId = subuser::requireOwnerDir();
    $list = subuser::read($directoryId);
    $before = count($list);
    $list = array_values(array_filter($list, function ($u) use ($username) {
      return !isset($u['username']) || $u['username'] !== $username;
    }));
    if (count($list) === $before) {
      tool::json(['success' => false, 'error' => '子用户不存在']);
    }
    subuser::write($directoryId, $list);
    tool::json(['success' => true]);
  }

  public static function getSecretForOwner($terminalId, $username)
  {
    $directoryId = subuser::requireOwnerDir();
    foreach (subuser::read($directoryId) as $u) {
      if (!isset($u['username']) || $u['username'] !== $username) continue;
      tool::json([
        'success' => true,
        'secret' => isset($u['secretPlain']) ? (string)$u['secretPlain'] : '',
        'allowed' => (isset($u['allowed']) && is_array($u['allowed'])) ? array_values($u['allowed']) : [],
      ]);
    }
    tool::json(['success' => false, 'error' => '子用户不存在']);
  }

  /* ===================== 子用户侧（凭据认证，无需登录） ===================== */

  /** 认证并返回可管理的实例列表 */
  public static function subList($directoryId, $username, $secret)
  {
    if (!tool::validDirId($directoryId)) {
      tool::json(['success' => false, 'error' => '实例组标识不合法']);
    }
    if (subuser::isLocked($directoryId, (string)$username)) {
      tool::json(['success' => false, 'error' => '尝试次数过多，请 ' . ceil(self::LOCK_SECONDS / 60) . ' 分钟后再试']);
    }
    $user = subuser::verify($directoryId, $username, $secret);
    if ($user === null) {
      tool::json(['success' => false, 'error' => '认证失败：请检查实例组标识、子用户名与密钥']);
    }
    tool::json([
      'success' => true,
      'username' => (string)$user['username'],
      'directoryId' => $directoryId,
      'terminals' => subuser::allowedTerminals($directoryId, $user),
    ]);
  }

  /** 读取某个实例的配置（纯文本返回） */
  public static function subLoad($directoryId, $username, $secret, $terminalId)
  {
    if (!tool::validDirId($directoryId) || !tool::validTerminalId($terminalId)) {
      tool::json(['success' => false, 'error' => '实例组标识或实例ID不合法']);
    }
    $user = subuser::authorize($directoryId, $username, $secret, $terminalId);
    if ($user === null) {
      tool::json(['success' => false, 'error' => '认证失败或无权访问该实例']);
    }
    $path = subuser::dirById($directoryId) . '/' . $terminalId . '.cses';
    if (!file_exists($path)) {
      tool::json(['success' => false, 'error' => '配置不存在']);
    }
    if (!headers_sent()) {
      header('Content-Type: text/plain; charset=utf-8');
    }
    echo file_get_contents($path);
    exit;
  }

  /** 写入某个实例的配置 */
  public static function subSave($directoryId, $username, $secret, $terminalId, $config)
  {
    if (!tool::validDirId($directoryId) || !tool::validTerminalId($terminalId)) {
      tool::json(['success' => false, 'error' => '实例组标识或实例ID不合法']);
    }
    $user = subuser::authorize($directoryId, $username, $secret, $terminalId);
    if ($user === null) {
      tool::json(['success' => false, 'error' => '认证失败或无权修改该实例']);
    }
    if (tool::vaildTextSize($config, 250000)) {
      tool::json(['success' => false, 'error' => '配置长度超过限制']);
    }
    $dir = subuser::ensureDir($directoryId);
    $path = $dir . '/' . $terminalId . '.cses';
    if (file_put_contents($path, $config, LOCK_EX) === false) {
      tool::json(['success' => false, 'error' => '写入失败，请检查目录权限']);
    }
    tool::json(['success' => true]);
  }
}
