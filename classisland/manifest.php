<?php
// 检查是否有id参数
if (!isset($_GET['id'])) {
    die(json_encode(['error' => 'Missing ID parameter'], JSON_PRETTY_PRINT));
}

// 获取文件路径
$filePath = "../user/" . $_GET['id'];

// 获取文件的修改时间
// $editTime = filemtime($filePath);

$directory = $filePath; // 替换为你的文件夹路径

// 打开目录
if ($handle = opendir($directory)) {
    $latest_mtime = 0; // 初始化最新修改时间
    $latest_file = ''; // 初始化最新修改的文件名

    // 遍历目录中的文件
    while (($file = readdir($handle)) !== false) {
        // 跳过当前目录(.)和上级目录(..)
        if ($file === '.' || $file === '..') {
            continue;
        }

        // 获取文件的完整路径
        $file_path = $directory . '/' . $file;

        // 检查是否为文件
        if (is_file($file_path)) {
            // 获取文件的修改时间
            $mtime = filemtime($file_path);

            // 如果当前文件的修改时间比已记录的最新修改时间晚，则更新
            if ($mtime > $latest_mtime) {
                $latest_mtime = $mtime;
                $latest_file = $file;
            }
        }
    }

    // 关闭目录
    closedir($handle);

}

// 构建输出数据
$output = [
    "ServerKind" => 0,
    "OrganizationName" => "CSES Cloud (" . $_GET['id'] . ")",
    "ClassPlanSource" => [
        "Value" => "https://cses.3r60.top/classisland/file.php?id=".$_GET['id']."/{id}&key=ClassPlans",
        "Version" => $latest_mtime
    ],
    "TimeLayoutSource" => [
        "Value" => "https://cses.3r60.top/classisland/file.php?id=".$_GET['id']."/{id}&key=TimeLayouts",
        "Version" => $latest_mtime
    ],
    "SubjectsSource" => [
        "Value" => "https://cses.3r60.top/classisland/file.php?id=".$_GET['id']."/{id}&key=Subjects",
        "Version" => $latest_mtime
    ],
    "PolicySource" => [
        "Value" => "https://cses.3r60.top/classisland/file.php?id=".$_GET['id']."/{id}&key=Policy",
        "Version" => $latest_mtime
    ]
];

// 输出格式化的JSON
header('Content-Type: application/json'); // 设置内容类型为JSON
echo json_encode($output, JSON_PRETTY_PRINT);
?>