<?php

// 该功能仍在开发当中，可能会有一些问题，请耐心等待修复。

include_once(__DIR__ . '/../config.php');

$format = $_GET['format'] ?? "ci";

$manifestPath = __DIR__ . '/manifest.json';

$manifest = json_decode(file_get_contents($manifestPath), true);

$id = $_GET['id'] ?? null;
$key = $_GET['key'] ?? null;

if (!$format || !isset($manifest['formats'][$format])) {
    die(json_encode(['error' => 'Unsupported or missing format'], JSON_PRETTY_PRINT));
}

$formatConfig = $manifest['formats'][$format];
if (!$formatConfig['configUrl'] || !file_exists(__DIR__ . '/' . $formatConfig['configUrl'])) {
    die(json_encode(['error' => 'Configuration file for the format not found'], JSON_PRETTY_PRINT));
}

$formatSpecificConfig = json_decode(file_get_contents(__DIR__ . '/' . $formatConfig['configUrl']), true);

if (!$id) {
    die(json_encode(['error' => 'Missing ID parameter'], JSON_PRETTY_PRINT));
}

$filePath = "../user/" . $id;

if ($key) {
    // 针对特定键的操作
    if (!isset($formatSpecificConfig[$key]) || !$formatSpecificConfig[$key]['enabled']) {
        die(json_encode(['error' => "Invalid or disabled key parameter. Valid keys are: " . implode(', ', array_keys($formatSpecificConfig))], JSON_PRETTY_PRINT));
    }

    $filePath .= '.cses';
    if (!file_exists($filePath)) {
        die(json_encode(['error' => 'File not found'], JSON_PRETTY_PRINT));
    }

    $fileContent = file_get_contents($filePath);
    $jsonData = json_decode($fileContent, true);

    if (!is_array($jsonData) || !isset($jsonData[$key])) {
        die(json_encode(['error' => "The requested key '$key' is not found in the JSON data"], JSON_PRETTY_PRINT));
    }

    // 根据配置文件动态构建输出
    $output = [];
    foreach ($formatSpecificConfig[$key]['fields'] as $fieldKey => $fieldName) {
        $output[$fieldKey] = $jsonData[$key][$fieldName] ?? $formatSpecificConfig[$key]['defaultValues'][$fieldKey] ?? null;
    }
} else {
    // 针对目录的操作
    if (!is_dir($filePath)) {
        die(json_encode(['error' => 'Directory not found'], JSON_PRETTY_PRINT));
    }

    $latest_mtime = 0;
    $directory = $filePath;
    if ($handle = opendir($directory)) {
        while (($file = readdir($handle)) !== false) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $file_path = $directory . '/' . $file;
            if (is_file($file_path)) {
                $mtime = filemtime($file_path);
                if ($mtime > $latest_mtime) {
                    $latest_mtime = $mtime;
                }
            }
        }
        closedir($handle);
    }

    // 使用 manifestTemplete 动态生成输出
    $manifestTemplate = $formatSpecificConfig['manifestTemplete'] ?? [];
    $output = [];
    foreach ($manifestTemplate as $key => $value) {
        if (is_array($value)) {
            $output[$key] = [];
            foreach ($value as $subKey => $subValue) {
                $output[$key][$subKey] = str_replace(
                    ['{eid}', '{host}', '{updateTime}'],
                    [$id, $REDIRECT_URI2 . "control/file.php", $latest_mtime],
                    $subValue
                );
            }
        } else {
            $output[$key] = str_replace(
                ['{eid}', '{host}', '{updateTime}'],
                [$id, $REDIRECT_URI2 . "control/file.php", $latest_mtime],
                $value
            );
        }
    }
}

header('Content-Type: application/json');
echo json_encode($output, JSON_PRETTY_PRINT);
?>