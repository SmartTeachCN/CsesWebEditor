<?php
$users = include $configFile;
$data = json_decode(file_get_contents("php://input"), true);
$username = $_GET['regist'] ?? '';
$password = $_GET['pass'] ?? '';
if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => '用户名或密码不能为空']);
    exit;
}
if (isset($users[$username])) {
    echo json_encode(['success' => false, 'message' => '用户名已被占用']);
    exit;
}

// 计算自增id
$maxSub = 0;
foreach ($users as $user) {
    if (isset($user['sub']) && $user['sub'] > $maxSub) {
        $maxSub = $user['sub'];
    }
}
$newSub = $maxSub + 1;

$hashedPassword = password_hash($password, PASSWORD_DEFAULT);
$users[$username] = [
    'username' => $username,
    'password' => $hashedPassword,
    'sub' => $newSub
];

// 将更新后的用户写回配置文件
$content = "<?php\n\nreturn " . var_export($users, true) . ";\n";
file_put_contents($configFile, $content);

echo json_encode(['success' => true, 'sub' => $newSub]);