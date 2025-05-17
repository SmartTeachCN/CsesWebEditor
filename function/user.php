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
            mkdir($GLOBALS['RUNDIR'] . 'user/' . $randomDir, 0755, $recursive);
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
        if (!isset($_SESSION['user'])) {
            return false;
        }
        return true;
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
        setcookie('accessToken', $response->access_token, time() + 3600 * 24 * 10, '/');
        return $response->access_token;
    }

    public static function getUserInfo()
    {
        $accessToken = isset($_COOKIE['accessToken']) ? $_COOKIE['accessToken'] : '';
        $response = curl::get($GLOBALS['CASDOOR_ENDPOINT'] . "/api/userinfo", ["Authorization: Bearer $accessToken"]);
        return json_decode($response, true);
    }

    public static function setSession($userData)
    {
        $_SESSION['user'] = [
            'id' => $userData['sub'],
            'name' => $userData['name'],
            'email' => $userData['email'],
            'preferred_username' => $userData['preferred_username']
        ];
    }

    public static function logout()
    {
        session_destroy();
        setcookie('accessToken', "");
        header('Location: /');
    }

    public static function getCid()
    {
        $userId = $_SESSION['user']['id'];
        $dir = user::getDir($userId, false, true);

        echo json_encode(['success' => true, 'directoryId' => $dir ?? '']);
        exit;
    }
}