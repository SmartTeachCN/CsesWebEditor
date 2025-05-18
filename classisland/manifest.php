<?php
if (!isset($_GET['id'])) {
    die(json_encode(['error' => 'Missing ID parameter'], JSON_PRETTY_PRINT));
}

$filePath = "../user/" . $_GET['id'];


$directory = $filePath;

if ($handle = opendir($directory)) {
    $latest_mtime = 0;
    $latest_file = '';

    while (($file = readdir($handle)) !== false) {
        if ($file === '.' || $file === '..') {
            continue;
        }

        $file_path = $directory . '/' . $file;

        if (is_file($file_path)) {
            $mtime = filemtime($file_path);

            if ($mtime > $latest_mtime) {
                $latest_mtime = $mtime;
                $latest_file = $file;
            }
        }
    }

    closedir($handle);

}

$output = [
    "ServerKind" => 0,
    "OrganizationName" => "CSES Cloud (" . $_GET['id'] . ")",
    "ClassPlanSource" => [
        "Value" => "https://cloud.cses-org.cn/classisland/file.php?id=".$_GET['id']."/{id}&key=ClassPlans",
        "Version" => $latest_mtime
    ],
    "TimeLayoutSource" => [
        "Value" => "https://cloud.cses-org.cn/classisland/file.php?id=".$_GET['id']."/{id}&key=TimeLayouts",
        "Version" => $latest_mtime
    ],
    "SubjectsSource" => [
        "Value" => "https://cloud.cses-org.cn/classisland/file.php?id=".$_GET['id']."/{id}&key=Subjects",
        "Version" => $latest_mtime
    ],
    "DefaultSettingsSource" => [
        "Value" => "https://cloud.cses-org.cn/classisland/file.php?id=".$_GET['id']."/{id}&key=Settings",
        "Version" => $latest_mtime
    ],
    "PolicySource" => [
        "Value" => "https://cloud.cses-org.cn/classisland/file.php?id=".$_GET['id']."/{id}&key=Policy",
        "Version" => $latest_mtime
    ]
];

header('Content-Type: application/json');
echo json_encode($output, JSON_PRETTY_PRINT);
?>