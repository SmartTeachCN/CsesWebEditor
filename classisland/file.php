<?php
/**
 * 静态集控数据源（ClassIsland 集控数据）。
 *
 * URL 形如：`file.php?id=<实例组标识>/<实例标识>&key=<数据源>`
 * 其中 `key` 取值：ClassPlans / TimeLayouts / Subjects / Policy / Credentials / Settings。
 *
 * 云端保存的是 CSES 文档，这里通过 convert.php 转换成 ClassIsland 需要的结构后输出。
 */

require_once __DIR__ . '/convert.php';

$id = isset($_GET['id']) ? (string)$_GET['id'] : '';
$key = isset($_GET['key']) ? (string)$_GET['key'] : '';

if ($id === '') {
    cses_ci_json(array('error' => '缺少实例参数（id）'), 400);
}

$parts = explode('/', $id, 2);
if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
    cses_ci_json(array('error' => '实例参数格式应为「实例组标识/实例标识」'), 400);
}

$directoryId = $parts[0];
$instanceId = $parts[1];

$result = cses_ci_read_document($directoryId, $instanceId);
if ($result['error'] !== null) {
    cses_ci_json(array('error' => $result['error']), 404);
}

$namespace = 'cses-cloud/' . $directoryId . '/' . $instanceId;
$document = cses_ci_document($result['document'], $key, $namespace);

if ($document === null) {
    cses_ci_json(array(
        'error' => '不支持的数据源：' . $key,
        'validKeys' => array('ClassPlans', 'TimeLayouts', 'Subjects', 'Policy', 'Credentials', 'Settings'),
    ), 400);
}

cses_ci_json($document, 200);
