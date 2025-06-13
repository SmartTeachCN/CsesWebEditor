<?php $debugMode = false;
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
session_start();

$configFile = __DIR__ . '/user/users.php';
if (isset($_GET['login'])) {
  if ($ALLOWINUSER)
    include_once 'function/user/login.php';
  exit;
} else if (isset($_GET['regist'])) {
  if ($ALLOWREG)
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
  if ($ALLOWOAUTH || $debugMode) {
    $debugMode ? $userData = user::debug() : $userData = user::getUserInfo();
    user::setSession($userData);
  }

}


// 请求处理
request::handleRequest();


