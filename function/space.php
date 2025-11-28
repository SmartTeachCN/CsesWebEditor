<?php

function getSpaceConfig($terminalId)
{
    header('Content-Type: application/json');
    if (!isset($_SESSION['user'])) {
        echo json_encode(['success' => false, 'error' => '未登录']);
        exit;
    }

    $userDir = user::getDir($_SESSION['user']['id']);
    $configPath = "$userDir/{$terminalId}_share.json";

    if (file_exists($configPath)) {
        $config = json_decode(file_get_contents($configPath), true);
        echo json_encode(['success' => true, 'config' => $config]);
    } else {
        echo json_encode(['success' => true, 'config' => ['enabled' => false, 'mode' => 'password']]);
    }
    exit;
}

function saveSpaceConfig()
{
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
    $userDir = user::getDir($_SESSION['user']['id']);

    // 保存到终端特定的共享配置文件
    $configPath = "$userDir/{$terminalId}_share.json";
    file_put_contents($configPath, json_encode($data, JSON_PRETTY_PRINT));

    echo json_encode(['success' => true]);
    exit;
}

function handleJoinSpace($params)
{
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
    $targetUserDir = user::getDir($targetUserId);
    $configPath = "$targetUserDir/{$targetTerminalId}_share.json";

    if (!file_exists($configPath)) {
        echo json_encode(['success' => false, 'error' => '目标实例未启用共享']);
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
        $currentUserDir = user::getDir($_SESSION['user']['id']);
        $linkPath = "$currentUserDir/{$localTerminalId}.cses";
        $targetPath = "$targetUserDir/{$targetTerminalId}.cses";

        if (!file_exists($targetPath)) {
            echo json_encode(['success' => false, 'error' => '目标实例不存在']);
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
