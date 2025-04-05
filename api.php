<?php

include_once 'config.php';

session_start();

// 处理认证回调
if (isset($_GET['code'])) {
  $token = $_GET['code'];
  $accessToken = exchangeToken($token);
  setcookie('accessToken', $accessToken, time() + 3600 * 24 * 10, '/');
  header('Location: /');
  exit;
}

// 检查是否启用调试模式
$debugMode = true; // 设置为true以启用调试模式，false以禁用

if ($debugMode) {
  // 使用测试用户信息
  $_SESSION['user'] = [
    'id' => 'test_user',
    'name' => 'Test User',
    'email' => 'test@example.com',
    'preferred_username' => 'testuser'
  ];
} else {
  // 获取用户信息
  $userData = getUserInfo($CASDOOR_ENDPOINT . "/api/userinfo");

  // 处理用户信息
  $_SESSION['user'] = [
    'id' => $userData['sub'],
    'name' => $userData['name'],
    'email' => $userData['email'],
    'preferred_username' => $userData['preferred_username']
  ];
}

// if (empty($_SESSION['user']['id'])) {
//   echo $accessToken;
//   exit;
// } else {
//   echo json_encode($_SESSION['user']);
//   exit;
// }


// 处理API请求
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  handleApiRequest($_POST);
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action'])) {
  handleApiAction($_GET);
}

// 函数定义
function exchangeToken($code) {
  $url = $GLOBALS['CASDOOR_ENDPOINT'] . "/api/login/oauth/access_token";
  $data = [
    "client_id" => $GLOBALS['CASDOOR_CLIENT_ID'],
    "client_secret" => $GLOBALS['CASDOOR_CLIENT_SECRET'],
    "code" => $code,
    "grant_type" => "authorization_code",
    "redirect_uri" => $GLOBALS['REDIRECT_URI']
  ];
  
  $response = curlPost($url, $data);
  return $response->access_token;
}

function getUserInfo($url) {
  $accessToken = isset($_COOKIE['accessToken']) ? $_COOKIE['accessToken'] : '';
  $response = curlGet($url, ["Authorization: Bearer $accessToken"]);
  return json_decode($response, true);
}

function curlPost($url, $data) {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
  $response = curl_exec($ch);
  curl_close($ch);
  return json_decode($response);
}

function curlGet($url, $headers = []) {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  if (!empty($headers)) {
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  }
  $response = curl_exec($ch);
  curl_close($ch);
  return $response;
}

function handleApiRequest($postData) {
  header('Content-Type: application/json');
  if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => '未登录']);
    exit;
  }

  $config = $postData['config'] ?? '';
  $terminalId = $postData['terminalId'] ?? '';
  
  validateTerminalId($terminalId);
  validateConfigSize($config, 250000);

  saveConfig($config, $terminalId, $_SESSION['user']['id']);
}

function handleApiAction($getParams) {
  header('Content-Type: application/json');
  $action = $getParams['action'];

  switch ($action) {
    case 'load':
      loadConfig($getParams['terminalId']);
      break;
    case 'getId':
      getConfigId($getParams['terminalId']);
      break;
    case 'del':
      deleteConfig($getParams['terminalId']);
      break;
    case 'listTerminals':
      listTerminals();
      break;
    case "logout":
      logout();
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

function validateTerminalId($terminalId) {
  if (empty($terminalId)) {
    echo json_encode(['success' => false, 'error' => '终端ID不能为空']);
    exit;
  }
}

function validateConfigSize($config, $maxLength) {
  if (mb_strlen($config) >= $maxLength) {
    echo json_encode(['success' => false, 'error' => '配置长度超过限制']);
    exit;
  }
}

function saveConfig($config, $terminalId, $userId) {
  $mappingFile = getUserMappingFile();
  $mappings = getUserMapping($mappingFile, $userId);

  // 创建用户目录
  $userDir = getUserDir($mappings, $userId);

  $configPath = $userDir . '/' . $terminalId . '.cses';
  file_put_contents($configPath, $config);
  echo json_encode(['success' => true]);
  exit;
}

function loadConfig($terminalId) {
  $userId = $_SESSION['user']['id'];
  $mappingFile = getUserMappingFile();
  $mappings = getUserMapping($mappingFile, $userId);

  $userDir = getUserDir($mappings, $userId, false);
  $configFile = $userDir . '/' . $terminalId . '.cses';

  if (file_exists($configFile)) {
    echo file_get_contents($configFile);
    exit;
  } else {
    echo json_encode(['success' => false, 'error' => '配置不存在']);
    exit;
  }
}

function getConfigId($terminalId = null) {
  $userId = $_SESSION['user']['id'];
  $mappingFile = getUserMappingFile();
  $mappings = getUserMapping($mappingFile, $userId);

  echo json_encode(['success' => true, 'directoryId' => $mappings[$userId] ?? '']);
  exit;
}

function deleteConfig($terminalId) {
  validateTerminalId($terminalId);
  $userId = $_SESSION['user']['id'];
  $mappingFile = getUserMappingFile();
  $mappings = getUserMapping($mappingFile, $userId);
  
  $userDir = getUserDir($mappings, $userId);
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

function listTerminals() {
  $userId = $_SESSION['user']['id'];
  $mappingFile = getUserMappingFile();
  $mappings = getUserMapping($mappingFile, $userId);
  
  $userDir = getUserDir($mappings, $userId);
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

function getSpaceConfig($terminalId) {
    header('Content-Type: application/json');
    if (!isset($_SESSION['user'])) {
        echo json_encode(['success' => false, 'error' => '未登录']);
        exit;
    }

    $mappingFile = getUserMappingFile();
    $mappings = getUserMapping($mappingFile, $_SESSION['user']['id']);
    $userDir = getUserDir($mappings, $_SESSION['user']['id']);
    $configPath = "$userDir/{$terminalId}_share.json";

    if (file_exists($configPath)) {
        $config = json_decode(file_get_contents($configPath), true);
        echo json_encode(['success' => true, 'config' => $config]);
    } else {
        echo json_encode(['success' => true, 'config' => ['enabled' => false, 'mode' => 'password']]);
    }
    exit;
}

function saveSpaceConfig() {
    header('Content-Type: application/json');
    if (!isset($_SESSION['user'])) {
        echo json_encode(['success' => false, 'error' => '未登录']);
        exit;
    }

    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    // 验证必要字段是否存在
    if (!isset($data['terminalId'], $data['enabled'], $data['mode'])) {
        echo json_encode(['success' => false, 'error' => '无效的配置格式']);
        exit;
    }

    $terminalId = $data['terminalId'];
    $mappingFile = getUserMappingFile();
    $mappings = getUserMapping($mappingFile, $_SESSION['user']['id']);
    $userDir = getUserDir($mappings, $_SESSION['user']['id']);

    // 保存到终端特定的共享配置文件
    $configPath = "$userDir/{$terminalId}_share.json";
    file_put_contents($configPath, json_encode($data, JSON_PRETTY_PRINT));

    echo json_encode(['success' => true]);
    exit;
}

function handleJoinSpace($params) {
    header('Content-Type: application/json');
    if (!isset($_SESSION['user'])) {
        echo json_encode(['success' => false, 'error' => '未登录']);
        exit;
    }

    $targetUserId = $params['targetUser'] ?? '';
    $targetTerminalId = $params['targetTerminal'] ?? '';
    $localTerminalId = $params['localTerminal'] ?? $targetTerminalId;
    $password = $params['password'] ?? '';

    // 获取目标用户的共享配置
    $mappingFile = getUserMappingFile();
    $targetMappings = getUserMapping($mappingFile, $targetUserId);
    $targetUserDir = getUserDir($targetMappings, $targetUserId, false);
    $configPath = "$targetUserDir/{$targetTerminalId}_share.json";

    if (!file_exists($configPath)) {
        echo json_encode(['success' => false, 'error' => '目标终端未启用共享']);
        exit;
    }

    $shareConfig = json_decode(file_get_contents($configPath), true);

    if (!$shareConfig['enabled']) {
        echo json_encode(['success' => false, 'error' => '该空间未启用共享']);
        exit;
    }

    // 验证权限
    $allowed = false;
    switch ($shareConfig['mode']) {
        case 'password':
            $allowed = ($password === $shareConfig['password']);
            break;
        case 'whitelist':
            $allowed = in_array($_SESSION['user']['id'], $shareConfig['whitelist']);
            break;
    }

    if ($allowed) {
        // 创建符号链接
        $currentUserDir = getUserDir(getUserMapping($mappingFile, $_SESSION['user']['id']), $_SESSION['user']['id']);
        $linkPath = "$currentUserDir/{$localTerminalId}.cses";
        $targetPath = "$targetUserDir/{$targetTerminalId}.cses";

        if (!file_exists($targetPath)) {
            echo json_encode(['success' => false, 'error' => '目标终端不存在']);
            exit;
        }

        if (symlink($targetPath, $linkPath)) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'error' => '创建链接失败']);
        }
    } else {
        echo json_encode(['success' => false, 'error' => '访问被拒绝']);
    }
    exit;
}

function logout() {
  session_destroy();
  setcookie('accessToken', "");
  header('Location: /');
}

function getUserMappingFile() {
  return __DIR__ . '/user/' . $GLOBALS['ENCYC'] . '.json';
}

function getUserMapping($mappingFile, $userId) {
  $mappings = [];
  if (file_exists($mappingFile)) {
    $mappings = json_decode(file_get_contents($mappingFile), true) ?: [];
  }
  return $mappings;
}

function getUserDir(&$mappings, $userId, $create = true) {
  $mappingFile = getUserMappingFile();
  $userDir = '';

  if (!isset($mappings[$userId])) {
    $randomDir = substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'), 0, 10);
    $mappings[$userId] = $randomDir;
    file_put_contents($mappingFile, json_encode($mappings));
    mkdir(__DIR__ . '/user/' . $randomDir, 0755, $create);
  }
  
  $userDir = __DIR__ . '/user/' . $mappings[$userId];
  return $userDir;
}
