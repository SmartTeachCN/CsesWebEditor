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
        echo json_encode(['success' => true, 'message' => '删除成功']);
      } else {
        echo json_encode(['success' => false, 'error' => '删除失败']);
      }
    } else {
      echo json_encode(['success' => false, 'error' => '文件不存在']);
    }
    exit;
  }
  public static function loadConfig($terminalId)
  {
    $userId = $_SESSION['user']['id'];
    $userDir = user::getDir($userId, false);
    $configFile = $userDir . '/' . $terminalId . '.cses';

    if (file_exists($configFile)) {
      echo file_get_contents($configFile);
      exit;
    } else {
      echo json_encode(['success' => false, 'error' => '配置不存在']);
      exit;
    }
  }
  public static function saveConfig($config, $terminalId, $userId)
  {
    // 创建用户目录
    $userDir = user::getDir($userId);

    $configPath = $userDir . '/' . $terminalId . '.cses';
    file_put_contents($configPath, $config);
    echo json_encode(['success' => true]);
    exit;
  }
  public static function list()
  {
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

    echo json_encode(['success' => true, 'terminals' => $terminals]);
    exit;
  }
  public static function vaildateId($terminalId)
  {
    if (empty($terminalId)) {
      echo json_encode(['success' => false, 'error' => '终端ID不能为空']);
      exit;
    }
  }
}