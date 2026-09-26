<?php

// 该功能仍在开发当中，可能会有一些问题，请耐心等待修复。

include_once(__DIR__ . '/../config.php');
require_once __DIR__ . '/../classisland/convert.php';

$format = isset($_GET['format']) ? (string)$_GET['format'] : 'ci';
$id = isset($_GET['id']) ? (string)$_GET['id'] : '';
$key = isset($_GET['key']) ? (string)$_GET['key'] : '';

$manifestPath = __DIR__ . '/manifest.json';

$manifest = json_decode((string)file_get_contents($manifestPath), true);
if (!is_array($manifest) || !isset($manifest['formats'][$format])) {
    cses_ci_json(array('error' => 'Unsupported or missing format'), 400);
}

$formatConfig = $manifest['formats'][$format];
if (empty($formatConfig['configUrl']) || !file_exists(__DIR__ . '/' . $formatConfig['configUrl'])) {
    cses_ci_json(array('error' => 'Configuration file for the format not found'), 404);
}

$formatSpecificConfig = json_decode((string)file_get_contents(__DIR__ . '/' . $formatConfig['configUrl']), true);
if (!is_array($formatSpecificConfig)) {
    $formatSpecificConfig = array();
}

if ($id === '') {
    cses_ci_json(array('error' => 'Missing ID parameter'), 400);
}

// id 形如「实例组标识/实例标识」
$idParts = explode('/', $id, 2);
$directoryId = $idParts[0];
$instanceId = isset($idParts[1]) ? $idParts[1] : '';

/*
 * ClassIsland 静态集控（format=ci）的数据源
 *
 * 云端保存的是 CSES 文档，而 ClassIsland 需要的是 ClassIsland 自己的结构，
 * 因此这里统一交给 classisland/convert.php 转换，保证与 classisland/*.php 输出一致。
 * 清单（不带 key 的请求）由下方 ci-config.json 的 manifestTemplete 生成。
 */
if ($format === 'ci' && $key !== '') {
    $result = cses_ci_read_document($directoryId, $instanceId);
    if ($result['error'] !== null) {
        cses_ci_json(array('error' => $result['error']), 404);
    }

    $document = cses_ci_document(
        $result['document'],
        $key,
        'cses-cloud/' . $directoryId . '/' . $instanceId
    );
    if ($document === null) {
        cses_ci_json(array(
            'error' => "Invalid key parameter. Valid keys are: "
                . implode(', ', array('ClassPlans', 'TimeLayouts', 'Subjects', 'Settings', 'Policy', 'Credentials')),
        ), 400);
    }

    cses_ci_json($document, 200);
}

/*
 * 其它格式：按格式配置里的字段映射输出（保持原有行为）。
 */
if ($key !== '') {
    // 针对特定键的操作
    if (!isset($formatSpecificConfig[$key]) || empty($formatSpecificConfig[$key]['enabled'])) {
        cses_ci_json(array(
            'error' => 'Invalid or disabled key parameter. Valid keys are: '
                . implode(', ', array_keys($formatSpecificConfig)),
        ), 400);
    }

    $filePath = __DIR__ . '/../user/' . $id . '.cses';
    if (!file_exists($filePath)) {
        cses_ci_json(array('error' => 'File not found'), 404);
    }

    $fileContent = file_get_contents($filePath);
    $jsonData = json_decode($fileContent, true);

    if (!is_array($jsonData)) {
        cses_ci_json(array('error' => 'The file content is not valid JSON'), 400);
    }

    // 键名不区分大小写，且允许存放在 extraKey 中
    $section = cses_ci_section($jsonData, $key);
    if (!$section) {
        cses_ci_json(array('error' => "The requested key '$key' is not found in the JSON data"), 404);
    }

    // 根据配置文件动态构建输出
    $output = array();
    $fields = isset($formatSpecificConfig[$key]['fields']) && is_array($formatSpecificConfig[$key]['fields'])
        ? $formatSpecificConfig[$key]['fields']
        : array();
    $defaultValues = isset($formatSpecificConfig[$key]['defaultValues']) && is_array($formatSpecificConfig[$key]['defaultValues'])
        ? $formatSpecificConfig[$key]['defaultValues']
        : array();
    foreach ($fields as $fieldKey => $fieldName) {
        $output[$fieldKey] = isset($section[$fieldName])
            ? $section[$fieldName]
            : (isset($defaultValues[$fieldKey]) ? $defaultValues[$fieldKey] : null);
    }

    cses_ci_json($output, 200);
}

// 针对目录的操作
$directory = __DIR__ . '/../user/' . $id;
if (!is_dir($directory)) {
    cses_ci_json(array('error' => 'Directory not found'), 404);
}

$latest_mtime = 0;
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
$manifestTemplate = isset($formatSpecificConfig['manifestTemplete']) && is_array($formatSpecificConfig['manifestTemplete'])
    ? $formatSpecificConfig['manifestTemplete']
    : array();
$output = array();
foreach ($manifestTemplate as $templateKey => $value) {
    if (is_array($value)) {
        $output[$templateKey] = array();
        foreach ($value as $subKey => $subValue) {
            $output[$templateKey][$subKey] = cses_ci_template_value(str_replace(
                ['{eid}', '{host}', '{updateTime}'],
                [$id, cses_ci_base_url() . '/control/file.php', $latest_mtime],
                $subValue
            ));
        }
    } else {
        $output[$templateKey] = cses_ci_template_value(str_replace(
            ['{eid}', '{host}', '{updateTime}'],
            [$id, cses_ci_base_url() . '/control/file.php', $latest_mtime],
            $value
        ));
    }
}

cses_ci_json($output, 200);
