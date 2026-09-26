<?php $debugMode = file_exists(__DIR__ . '/debug.flag');
$RUNDIR = __DIR__ . '/';
// phpinfo();
include_once 'config.php';
include_once 'function/ui.php';
include_once 'function/uiConfig.php';
include_once 'function/terminal.php';
include_once 'function/tool.php';
include_once 'function/request.php';
include_once 'function/terminal.php';
include_once 'function/curl.php';
include_once 'function/space.php';
include_once 'function/user.php';
include_once 'function/subuser.php';
session_start();

$configFile = __DIR__ . '/user/users.php';
if (isset($_GET['login'])) {
  if (!empty($ALLOWINUSER))
    include_once 'function/user/login.php';
  exit;
} else if (isset($_GET['regist'])) {
  if (!empty($ALLOWREG))
    include_once 'function/user/regist.php';
  exit;
} else {

  // OAuth用户登录
  if (isset($_GET['code'])) {
    $accessToken = user::handleLogin($_GET['code']);
    header('Location: /');
    exit;
  }

  // 用户信息
  // 只在「还没有会话」时解析身份，避免每个 AJAX 请求都去请求一次 OAuth userinfo。
  if (empty($_SESSION['user']['id'])) {
    if ($debugMode) {
      user::setSession(user::debug());
    } elseif (!empty($ALLOWOAUTH) && !empty($_COOKIE['accessToken'])) {
      $userData = user::getUserInfo();
      if (is_array($userData) && !empty($userData['sub'])) {
        user::setSession($userData);
      }
    }
  }

}


// 请求处理
request::handleRequest();


