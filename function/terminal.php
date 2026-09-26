<?php
class terminal
{
  public static function delete($terminalId)
  {
    terminal::vaildateId($terminalId);
    $userId = $_SESSION['user']['id'];
    $userDir = user::getDir($userId);
    $configFile = $userDir . '/' . $terminalId . '.cses';

    if (file_exists($configFile)) {
      if (unlink($configFile)) {
        echo json_encode(['success' => true, 'message' => '删除成功'], JSON_UNESCAPED_UNICODE);
      } else {
        echo json_encode(['success' => false, 'error' => '删除失败'], JSON_UNESCAPED_UNICODE);
      }
    } else {
      echo json_encode(['success' => false, 'error' => '文件不存在'], JSON_UNESCAPED_UNICODE);
    }
    exit;
  }
  public static function loadConfig($terminalId)
  {
    terminal::vaildateId($terminalId);
    $userId = $_SESSION['user']['id'];
    $userDir = user::getDir($userId, false);
    $configFile = $userDir . '/' . $terminalId . '.cses';

    if (file_exists($configFile)) {
      if (!headers_sent()) {
        header('Content-Type: text/plain; charset=utf-8');
      }
      echo file_get_contents($configFile);
      exit;
    } else {
      echo json_encode(['success' => false, 'error' => '配置不存在'], JSON_UNESCAPED_UNICODE);
      exit;
    }
  }
  public static function saveConfig($config, $terminalId, $userId)
  {
    terminal::vaildateId($terminalId);
    // 创建用户目录
    $userDir = user::getDir($userId);

    if (!is_dir($userDir)) {
      mkdir($userDir, 0755, true);
    }
    $configPath = $userDir . '/' . $terminalId . '.cses';
    if (file_put_contents($configPath, $config, LOCK_EX) === false) {
      echo json_encode(['success' => false, 'error' => '写入失败，请检查目录权限'], JSON_UNESCAPED_UNICODE);
      exit;
    }
    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
    exit;
  }
  public static function list()
  {
    if (!isset($_SESSION['user']['id'])) {
      echo json_encode(['success' => false, 'error' => '未登录'], JSON_UNESCAPED_UNICODE);
      exit;
    }
    $userId = $_SESSION['user']['id'];

    $userDir = user::getDir($userId);
    $terminals = [];

    if (is_dir($userDir)) {
      $files = scandir($userDir);
      foreach ($files as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'cses') {
          $terminals[] = pathinfo($file, PATHINFO_FILENAME);
        }
      }
    }

    echo json_encode(['success' => true, 'terminals' => $terminals], JSON_UNESCAPED_UNICODE);
    exit;
  }

  /** 判断该实例是否属于当前登录用户 */
  public static function exists($userId, $terminalId)
  {
    if (!tool::validTerminalId($terminalId)) return false;
    $userDir = user::getDir($userId, false);
    return file_exists($userDir . '/' . $terminalId . '.cses');
  }

  /**
   * 实例ID校验。
   * 旧实现只判断了「非空」，因此 ../../ 之类的值可以穿越目录，
   * 现在统一走 tool::validTerminalId()（禁止路径分隔符、.. 与隐藏文件名）。
   */
  public static function vaildateId($terminalId)
  {
    if (!tool::validTerminalId($terminalId)) {
      echo json_encode([
        'success' => false,
        'error' => '实例ID不合法（不能为空，且不能包含 / \\ : * ? " < > | 或 .. ）',
      ], JSON_UNESCAPED_UNICODE);
      exit;
    }
    return true;
  }
}
