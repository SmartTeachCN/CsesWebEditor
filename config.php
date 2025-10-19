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

$prodConfigFile = __DIR__ . '/config.prod.php';
if (file_exists($prodConfigFile)) {
    include $prodConfigFile;
};
