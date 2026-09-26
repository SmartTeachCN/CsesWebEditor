<?php
$CASDOOR_ENDPOINT = 'https://casdoor.example.com';
$CASDOOR_CLIENT_ID = 'cses-cloud-dev';
$CASDOOR_CLIENT_SECRET = 'cses-cloud-dev-secret';

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$REDIRECT_URI = $scheme . $host . '/api.php';

$ENCYC = 'SmartEDUCloud';

// ICP/备案信息（留空则不显示）
$ICP_BEIAN = '';

// ---------------------------------------------------------------------------
// 登录方式开关的默认值。
// 之前这些变量只在生产环境的 config.prod.php 里定义，开发副本中完全是未定义变量，
// 于是 function.php 里的 `if ($ALLOWOAUTH || $debugMode)` 恒为 false，
// OAuth 回调拿不到会话；而 login.html 中的 $REDIRECT_URI2 也为空。
// 这里给出安全默认值，config.prod.php 仍可覆盖（它在下方被 include）。
// ---------------------------------------------------------------------------
$ALLOWINUSER = $ALLOWINUSER ?? false;   // 站内独立账户登录
$ALLOWREG    = $ALLOWREG ?? false;      // 站内独立账户注册
$ALLOWOAUTH  = $ALLOWOAUTH ?? true;     // 智教联盟 OAuth
$REDIRECT_URI2 = $REDIRECT_URI2 ?? $REDIRECT_URI;

$prodConfigFile = __DIR__ . '/config.prod.php';
if (file_exists($prodConfigFile)) {
    include $prodConfigFile;
};
