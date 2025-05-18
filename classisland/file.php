<?php
// 检查是否有id参数
if (!isset($_GET['id'])) {
    die(json_encode(['error' => 'Missing ID parameter'], JSON_PRETTY_PRINT));
}

// 获取文件路径
$filePath = "../user/" . $_GET['id'] . '.cses';

// 检查文件是否存在
if (!file_exists($filePath)) {
    die(json_encode(['error' => 'File not found：'.$filePath], JSON_PRETTY_PRINT));
}

// 获取文件内容
$fileContent = file_get_contents($filePath);

// 判断文件内容是否为JSON格式
if (json_decode($fileContent) === null) {
    die(json_encode(['error' => 'The file content is not valid JSON'], JSON_PRETTY_PRINT));
}

// 解析JSON内容
$jsonData = json_decode($fileContent, true);

// 获取GET参数控制的键值（Subjects/ClassPlans/TimeLayouts）
$requestedKey = isset($_GET['key']) ? $_GET['key'] : null;

// 检查请求的键是否有效
$validKeys = ['Subjects', 'ClassPlans', 'TimeLayouts', 'Policy', 'Settings'];
if ($requestedKey && !in_array($requestedKey, $validKeys)) {
    die(json_encode(['error' => 'Invalid key parameter. Valid keys are: Subjects, ClassPlans, TimeLayouts'], JSON_PRETTY_PRINT));
}

// 构建输出数据
$output = $requestedKey == "Policy" ? [] : [
    "Name" => "",
    "TimeLayouts" => new stdClass(),
    "ClassPlans" => new stdClass(),
    "Subjects" => new stdClass()
];

// 如果请求了特定的键，仅保留该键
if ($requestedKey) {
    // 确保 $jsonData 是数组
    if (!is_array($jsonData)) {
        die(json_encode(['error' => "Invalid JSON data format"], JSON_PRETTY_PRINT));
    }

    // 尝试获取请求的键
    if (isset($jsonData[$requestedKey])) {
        $output[$requestedKey] = $jsonData[$requestedKey];
    } elseif (isset($jsonData['extraKey']) && is_array($jsonData['extraKey'])) {
        if (isset($jsonData['extraKey'][$requestedKey])) {
            $output = $jsonData['extraKey'][$requestedKey];
        }
    } else {
        // 返回错误信息而不是直接终止脚本
        die(json_encode(['error' => "The requested key '$requestedKey' is not found in the JSON data"], JSON_PRETTY_PRINT));
    }
} else {
    $output = $jsonData;
}
// 输出格式化的JSON
header('Content-Type: application/json');
echo json_encode($output, JSON_PRETTY_PRINT);
?>