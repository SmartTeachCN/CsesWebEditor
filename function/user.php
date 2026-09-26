<?php
class user
{
    public static function getDir($userId, $recursive = true, $onlyId = false)
    {
        $mappingFile = $GLOBALS['RUNDIR'] . 'user/' . $GLOBALS['ENCYC'] . '.json';
        $mappings = [];
        if (file_exists($mappingFile)) {
            $mappings = json_decode(file_get_contents($mappingFile), true) ?: [];
        }

        $userDir = '';

        if (!isset($mappings[$userId])) {
            $randomDir = substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'), 0, 10);
            $mappings[$userId] = $randomDir;
            file_put_contents($mappingFile, json_encode($mappings));
            if (!is_dir($GLOBALS['RUNDIR'] . 'user/' . $randomDir)) {
                mkdir($GLOBALS['RUNDIR'] . 'user/' . $randomDir, 0755, $recursive);
            }
        }

        if ($onlyId) {
            return $mappings[$userId];
        }

        $userDir = $GLOBALS['RUNDIR'] . 'user/' . $mappings[$userId];
        return $userDir;
    }
    public static function debug()
    {
        return [
            'sub' => 'test_user',
            'name' => 'Test User',
            'email' => 'test@example.com',
            'preferred_username' => 'testuser'
        ];
    }
    public static function checkSession()
    {
        return !empty($_SESSION['user']['id']);
    }
    public static function handleLogin($code)
    {
        $url = $GLOBALS['CASDOOR_ENDPOINT'] . "/api/login/oauth/access_token";
        $data = [
            "client_id" => $GLOBALS['CASDOOR_CLIENT_ID'],
            "client_secret" => $GLOBALS['CASDOOR_CLIENT_SECRET'],
            "code" => $code,
            "grant_type" => "authorization_code",
            "redirect_uri" => $GLOBALS['REDIRECT_URI']
        ];

        $response = curl::post($url, $data);
        // 授权码换取失败时不再把空串写进 accessToken Cookie
        if (!is_object($response) || empty($response->access_token)) {
            return null;
        }
        if (!headers_sent()) {
            setcookie('accessToken', $response->access_token, time() + 3600 * 24 * 10, '/');
        }
        return $response->access_token;
    }

    /**
     * 读取 OAuth 用户信息。
     * 网络错误 / 令牌失效 / 返回非 JSON 时返回 null，调用方据此决定是否建立会话。
     */
    public static function getUserInfo()
    {
        $accessToken = isset($_COOKIE['accessToken']) ? $_COOKIE['accessToken'] : '';
        if ($accessToken === '') {
            return null;
        }
        $response = curl::get($GLOBALS['CASDOOR_ENDPOINT'] . "/api/userinfo", ["Authorization: Bearer $accessToken"]);
        if (!is_string($response) || $response === '') {
            return null;
        }
        $data = json_decode($response, true);
        if (!is_array($data) || empty($data['sub'])) {
            return null;
        }
        return $data;
    }

    public static function setSession($userData)
    {
        if (!is_array($userData) || empty($userData['sub'])) {
            return false;
        }
        $_SESSION['user'] = [
            'id' => $userData['sub'],
            'name' => $userData['name'] ?? ($userData['preferred_username'] ?? ''),
            'email' => $userData['email'] ?? '',
            'preferred_username' => $userData['preferred_username'] ?? ($userData['name'] ?? '')
        ];
        return true;
    }

    public static function logout()
    {
        // 清除会话与访问令牌
        $_SESSION = [];
        session_unset();
        session_destroy();
        // 正确删除 accessToken Cookie（设为过期）
        if (!headers_sent()) {
            setcookie('accessToken', '', time() - 3600, '/');
        }
        // 返回主页
        if (!headers_sent()) {
            header('Location: /');
        }
        exit;
    }

    public static function getCid()
    {
        if (empty($_SESSION['user']['id'])) {
            echo json_encode(['success' => false, 'error' => '未登录'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $userId = $_SESSION['user']['id'];
        $dir = user::getDir($userId, false, true);

        echo json_encode(['success' => true, 'directoryId' => $dir ?? ''], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
