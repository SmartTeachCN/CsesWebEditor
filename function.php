<?php $debugMode = true;
$RUNDIR = __DIR__ . '/';

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

// 用户登录
if (isset($_GET['code'])) {
  $accessToken = user::handleLogin($$_GET['code']);
  header('Location: /');
  exit;
}

// 用户信息
$debugMode ? $userData = user::debug() : $userData = user::getUserInfo();
user::setSession($userData);

// 请求处理
request::handleRequest();


