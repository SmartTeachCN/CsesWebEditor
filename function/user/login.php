<?PHP
$users = include $configFile;

$username = $_GET['login'] ?? '';
$password = $_GET['pass'] ?? '';

if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => '用户名或密码不能为空']);
    exit;
}

if (!isset($users[$username])) {
    echo json_encode(['success' => false, 'message' => '用户不存在']);
    exit;
}

$user = $users[$username];

if (password_verify($password, $user['password'])) {
    // $_SESSION['user'] = ['username' => $username];
    echo json_encode(['success' => true, 'user' => ['username' => $username]]);
    user::setSession([
            'sub' => $user['sub'],
            'name' => $user['username'],
            'email' => 'unknownw',
            'preferred_username' => $user['username'],
        ]);

} else {
    echo json_encode(['success' => false, 'message' => '密码错误']);
}