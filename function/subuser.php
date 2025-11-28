<?php
class subuser
{
  public static function dirById($directoryId)
  {
    return $GLOBALS['RUNDIR'] . 'user/' . $directoryId;
  }
  public static function filePath($directoryId, $terminalId)
  {
    return subuser::dirById($directoryId) . '/' . $terminalId . '_subusers.json';
  }
  public static function ensureDir($directoryId)
  {
    $dir = subuser::dirById($directoryId);
    if (!is_dir($dir)) {
      mkdir($dir, 0755, true);
    }
    return $dir;
  }
  public static function getForOwner($terminalId)
  {
    if (!isset($_SESSION['user'])) {
      echo json_encode(['success' => false, 'error' => '未登录']);
      exit;
    }
    $directoryId = user::getDir($_SESSION['user']['id'], false, true);
    $path = subuser::filePath($directoryId, $terminalId);
    $list = [];
    if (file_exists($path)) {
      $list = json_decode(file_get_contents($path), true) ?: [];
    }
    $safe = array_map(function ($u) {
      return ['username' => $u['username']];
    }, $list);
    echo json_encode(['success' => true, 'users' => $safe]);
    exit;
  }
  private static function isStrongSecret($s)
  {
    if (strlen($s) < 8) return false;
    if (!preg_match('/[a-z]/', $s)) return false;
    if (!preg_match('/[A-Z]/', $s)) return false;
    if (!preg_match('/\d/', $s)) return false;
    if (!preg_match('/[^a-zA-Z\d]/', $s)) return false;
    return true;
  }
  public static function addForOwner($terminalId, $username, $secretRaw = '')
  {
    if (!isset($_SESSION['user'])) {
      echo json_encode(['success' => false, 'error' => '未登录']);
      exit;
    }
    $directoryId = user::getDir($_SESSION['user']['id'], false, true);
    subuser::ensureDir($directoryId);
    $path = subuser::filePath($directoryId, $terminalId);
    $list = [];
    if (file_exists($path)) {
      $list = json_decode(file_get_contents($path), true) ?: [];
    }
    foreach ($list as $u) {
      if ($u['username'] === $username) {
        echo json_encode(['success' => false, 'error' => '用户名已存在']);
        exit;
      }
    }
    if (count($list) >= 5) {
      echo json_encode(['success' => false, 'error' => '子用户数量已达上限']);
      exit;
    }
    $secret = $secretRaw;
    if ($secret === '' || $secret === null) {
      $secret = bin2hex(random_bytes(16));
    } else {
      if (!subuser::isStrongSecret($secret)) {
        echo json_encode(['success' => false, 'error' => '密码强度不足（至少8位，含大小写、数字、特殊字符）']);
        exit;
      }
    }
    $list[] = [
      'username' => $username,
      'secretHash' => password_hash($secret, PASSWORD_DEFAULT),
      'secretPlain' => $secret,
      'allowed' => [$terminalId]
    ];
    file_put_contents($path, json_encode($list, JSON_PRETTY_PRINT));
    echo json_encode(['success' => true, 'username' => $username, 'secret' => $secret]);
    exit;
  }
  public static function deleteForOwner($terminalId, $username)
  {
    if (!isset($_SESSION['user'])) {
      echo json_encode(['success' => false, 'error' => '未登录']);
      exit;
    }
    $directoryId = user::getDir($_SESSION['user']['id'], false, true);
    $path = subuser::filePath($directoryId, $terminalId);
    $list = [];
    if (file_exists($path)) {
      $list = json_decode(file_get_contents($path), true) ?: [];
    }
    $list = array_values(array_filter($list, function ($u) use ($username) {
      return $u['username'] !== $username;
    }));
    file_put_contents($path, json_encode($list, JSON_PRETTY_PRINT));
    echo json_encode(['success' => true]);
    exit;
  }
  public static function getSecretForOwner($terminalId, $username)
  {
    if (!isset($_SESSION['user'])) {
      echo json_encode(['success' => false, 'error' => '未登录']);
      exit;
    }
    $directoryId = user::getDir($_SESSION['user']['id'], false, true);
    $path = subuser::filePath($directoryId, $terminalId);
    if (!file_exists($path)) {
      echo json_encode(['success' => false, 'error' => '子用户不存在']);
      exit;
    }
    $list = json_decode(file_get_contents($path), true) ?: [];
    foreach ($list as $u) {
      if ($u['username'] === $username) {
        echo json_encode(['success' => true, 'secret' => ($u['secretPlain'] ?? '')]);
        exit;
      }
    }
    echo json_encode(['success' => false, 'error' => '子用户不存在']);
    exit;
  }
  public static function verifyInDir($directoryId, $username, $secret)
  {
    $dir = subuser::dirById($directoryId);
    if (!is_dir($dir)) {
      return ['ok' => false];
    }
    $files = scandir($dir);
    foreach ($files as $f) {
      if (substr($f, -13) === '_subusers.json') {
        $list = json_decode(file_get_contents($dir . '/' . $f), true) ?: [];
        foreach ($list as $u) {
          if ($u['username'] === $username && password_verify($secret, $u['secretHash'])) {
            return ['ok' => true, 'allowed' => $u['allowed']];
          }
        }
      }
    }
    return ['ok' => false];
  }
  public static function subList($directoryId, $username, $secret)
  {
    $v = subuser::verifyInDir($directoryId, $username, $secret);
    if (!$v['ok']) {
      echo json_encode(['success' => false, 'error' => '认证失败']);
      exit;
    }
    echo json_encode(['success' => true, 'terminals' => $v['allowed']]);
    exit;
  }
  public static function subLoad($directoryId, $username, $secret, $terminalId)
  {
    $v = subuser::verifyInDir($directoryId, $username, $secret);
    if (!$v['ok'] || !in_array($terminalId, $v['allowed'])) {
      echo json_encode(['success' => false, 'error' => '认证失败']);
      exit;
    }
    $path = subuser::dirById($directoryId) . '/' . $terminalId . '.cses';
    if (file_exists($path)) {
      echo file_get_contents($path);
      exit;
    }
    echo json_encode(['success' => false, 'error' => '配置不存在']);
    exit;
  }
  public static function subSave($directoryId, $username, $secret, $terminalId, $config)
  {
    $v = subuser::verifyInDir($directoryId, $username, $secret);
    if (!$v['ok'] || !in_array($terminalId, $v['allowed'])) {
      echo json_encode(['success' => false, 'error' => '认证失败']);
      exit;
    }
    $dir = subuser::ensureDir($directoryId);
    $path = $dir . '/' . $terminalId . '.cses';
    file_put_contents($path, $config);
    echo json_encode(['success' => true]);
    exit;
  }
}
