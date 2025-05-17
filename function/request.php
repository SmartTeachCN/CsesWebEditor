<?php
class request
{
  public static function handleRequest()
  {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      request::post($_POST);
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action'])) {
      request::get($_GET);
    }
  }
  public static function post($postData)
  {
    header('Content-Type: application/json');
    if (!isset($_SESSION['user'])) {
      echo json_encode(['success' => false, 'error' => '未登录']);
      exit;
    }

    $config = $postData['config'] ?? '';
    $terminalId = $postData['terminalId'] ?? '';

    terminal::vaildateId($terminalId);
    if (tool::vaildTextSize($config, 250000)) {
      echo json_encode(['success' => false, 'error' => '配置长度超过限制']);
      exit;
    }

    terminal::saveConfig($config, $terminalId, $_SESSION['user']['id']);
    echo json_encode(['success' => true]);
  }
  public static function get($getParams)
  {
    header('Content-Type: application/json');
    $action = $getParams['action'];

    switch ($action) {
      case 'load':
        terminal::vaildateId($getParams['terminalId'] ?? '');
        terminal::loadConfig($getParams['terminalId'] ?? '');
        break;
      case 'getId':
        user::getCid();
        break;
      case 'del':
        terminal::vaildateId($getParams['terminalId'] ?? '');
        terminal::delete($getParams['terminalId'] ?? '');
        break;
      case 'listTerminals':
        terminal::list();
        break;
      case "logout":
        user::logout();
        break;
      case 'spaceConfig':
        saveSpaceConfig();
        break;
      case 'joinSpace':
        handleJoinSpace($_GET);
        break;
      default:
        echo json_encode([]);
        exit;
    }
  }
}