<?php
/**
 * CSES Cloud 静态集控（ClassIsland）数据转换。
 *
 * 云端保存的是 CSES 文档（`subjects` / `schedules` / `extraKey`），而 ClassIsland 的集控
 * 数据源要求 ClassIsland 自己的 JSON 结构，因此这里在服务端做一次转换：
 *
 *   - ClassPlans / TimeLayouts / Subjects → ClassIsland 档案（Profile）
 *   - Policy                             → ClassIsland 限制策略（ManagementPolicy）
 *   - Credentials                        → ClassIsland 凭据设置（ManagementCredentialConfig）
 *   - Settings                           → ClassIsland 应用设置（Settings）
 *
 * 目标为 ClassIsland 2.0（核心版本 2.0.0.0）：
 *   - 时间点使用 TimeSpan（`StartTime` / `EndTime`，形如 `08:00:00`），旧版的
 *     `StartSecond` / `EndSecond`（ISO 日期时间）同时输出，以兼容 2.0 之前的客户端；
 *   - 2.0 中 `ExcludedFullscreenWindow` 为集合（数组），而 CSES 里是逗号分隔的文本；
 *   - 2.0 中 `Theme` 的 0/1/2 依次为「跟随系统 / 浅色 / 深色」。
 *
 * 为了兼容「按数据源分开拉取」的集控协议，所有 GUID 必须是稳定的：优先使用 CSES 文档
 * 中已有的 `uuid`，没有时用 UUID v5（SHA-1）从名称/序号推导，否则不同数据源之间的
 * 科目引用会错位（课表里出现空科目）。
 */

/** 集控数据核心版本，需与 ClassIsland 的 IAppHost.CoreVersion 主版本一致。 */
define('CSES_CI_CORE_VERSION', '2.0.0.0');

/**
 * 输出 JSON 响应并结束请求。
 *
 * 这些接口不依赖 function/tool.php 中的辅助方法（该类属于站内 WIP 接口），
 * 以保证静态集控接口在任何部署状态下都能独立工作。
 */
function cses_ci_json($data, $status = 200)
{
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        if ($status !== 200) {
            http_response_code($status);
        }
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * 实例组标识校验。规则与 function/tool.php 的 cses_ci_valid_dir_id() 一致：
 * 由 user::getDir() 生成（10 位小写字母/数字），这里放宽到 4~64 位。
 */
function cses_ci_valid_dir_id($id)
{
    if (!is_string($id)) {
        return false;
    }

    return preg_match('/^[A-Za-z0-9_-]{4,64}$/', $id) === 1;
}

/**
 * 实例标识校验。规则与 function/tool.php 的 cses_ci_valid_instance_id() 一致：
 * 允许中文等宽字符，但禁止路径分隔符、`..` 与首字符为 `.` 的隐藏文件。
 */
function cses_ci_valid_instance_id($id)
{
    if (!is_string($id) || $id === '') {
        return false;
    }
    if (strlen($id) > 180) {
        return false;
    }
    if ($id[0] === '.') {
        return false;
    }
    if (strpos($id, '..') !== false) {
        return false;
    }

    return preg_match('/^[^\/\\\\:*?"<>|\x00-\x1F]+$/u', $id) === 1;
}

/**
 * 生成一个随机 UUID（v4）。仅用于无法推导稳定标识的兜底场景。
 */
function cses_ci_uuid_v4()
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    $hex = bin2hex($data);

    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4)
        . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20, 12);
}

/**
 * 校验 GUID 字符串。CSES 文档里的 uuid 只有在合法时才能当作 ClassIsland 的字典键。
 */
function cses_ci_valid_uuid($value)
{
    if (!is_string($value)) {
        return false;
    }

    return preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $value) === 1;
}

/**
 * 由命名空间与名称确定性地生成 GUID（UUID v5 风格）。
 */
function cses_ci_stable_uuid($namespace, $name)
{
    $hex = substr(sha1($namespace . "\x00" . $name), 0, 32);
    $hex[12] = '5'; // 版本位
    $hex[16] = dechex((hexdec($hex[16]) & 0x3) | 0x8); // 变体位

    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4)
        . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20, 12);
}

/**
 * 时间统一为 ClassIsland 2.0 的 TimeSpan 文本（HH:MM:SS）。
 *
 * 接受 `8:00`、`08:00:00`、ISO 日期时间（`2025-01-01T08:00:00`）等写法，
 * 无法解析时返回空字符串。
 */
function cses_ci_norm_time($value)
{
    if (!is_string($value) && !is_numeric($value)) {
        return '';
    }

    if (preg_match('/(\d{1,2}):(\d{2})(?::(\d{2}))?/', (string)$value, $match) !== 1) {
        return '';
    }

    $hour = (int)$match[1];
    $minute = (int)$match[2];
    $second = isset($match[3]) ? (int)$match[3] : 0;
    if ($hour > 23 || $minute > 59 || $second > 59) {
        return '';
    }

    return sprintf('%02d:%02d:%02d', $hour, $minute, $second);
}

/**
 * 启用日统一为 1~7 的整数数组（CSES v1 为整数，v2 为数组）。
 */
function cses_ci_norm_days($value)
{
    if ($value === null || $value === '' || $value === false) {
        return array();
    }

    $items = is_array($value) ? $value : array($value);
    $days = array();
    foreach ($items as $item) {
        if (!is_numeric($item)) {
            continue;
        }
        $day = (int)$item;
        if ($day >= 1 && $day <= 7 && !in_array($day, $days, true)) {
            $days[] = $day;
        }
    }

    return $days;
}

/**
 * 空数组在 json_encode 后会变成 `[]`，而 ClassIsland 的字典/对象需要 `{}`。
 */
function cses_ci_object($value)
{
    return empty($value) ? new stdClass() : $value;
}

/**
 * 模板替换后所有值都会变成字符串，而集控清单里的版本号、服务器类型必须是 JSON 数字，
 * 否则 ClassIsland 反序列化清单时会直接失败。这里把数字字符串还原成数字。
 */
function cses_ci_template_value($value)
{
    if (!is_string($value)) {
        return $value;
    }
    if (preg_match('/^-?\d+$/', $value) === 1) {
        return (int)$value;
    }
    if (preg_match('/^-?\d+\.\d+$/', $value) === 1) {
        return (float)$value;
    }

    return $value;
}

/**
 * 在 CSES 文档中按名称查找区块（先顶层，再 extraKey），不区分大小写。
 */function cses_ci_section($document, $name)
{
    if (!is_array($document)) {
        return array();
    }

    $scopes = array($document);
    if (isset($document['extraKey']) && is_array($document['extraKey'])) {
        $scopes[] = $document['extraKey'];
    }

    foreach ($scopes as $scope) {
        foreach ($scope as $key => $value) {
            if (is_string($key) && strcasecmp($key, $name) === 0 && is_array($value)) {
                return $value;
            }
        }
    }

    return array();
}

/**
 * 读取实例配置文档。
 *
 * @return array `document` 为解析后的数组（失败时为 null），`error` 为错误信息（成功时为 null）。
 */
function cses_ci_read_document($directoryId, $instanceId)
{
    if (!cses_ci_valid_dir_id($directoryId)) {
        return array('document' => null, 'error' => '实例组标识不合法');
    }
    if (!cses_ci_valid_instance_id($instanceId)) {
        return array('document' => null, 'error' => '实例标识不合法');
    }

    $base = realpath(__DIR__ . '/../user');
    if ($base === false) {
        return array('document' => null, 'error' => '服务器上还没有任何实例数据');
    }

    $path = realpath($base . '/' . $directoryId . '/' . $instanceId . '.cses');
    if ($path === false || strpos($path, $base . DIRECTORY_SEPARATOR) !== 0) {
        return array('document' => null, 'error' => '找不到该实例的配置，请确认实例名称是否与 CSES Cloud 中的一致');
    }
    // realpath 已经保证了路径存在且位于 user 目录内。

    $content = file_get_contents($path);
    if ($content === false) {
        return array('document' => null, 'error' => '无法读取实例配置');
    }

    $document = json_decode($content, true);
    if (!is_array($document)) {
        return array('document' => null, 'error' => '实例配置不是合法的 JSON 文档');
    }

    return array('document' => $document, 'error' => null);
}

/**
 * 取实例组下所有实例配置的最新修改时间，作为集控数据源版本号。
 */
function cses_ci_directory_version($directoryId)
{
    if (!cses_ci_valid_dir_id($directoryId)) {
        return 0;
    }

    $directory = __DIR__ . '/../user/' . $directoryId;
    if (!is_dir($directory)) {
        return 0;
    }

    $version = 0;
    $handle = opendir($directory);
    if ($handle === false) {
        return 0;
    }

    while (($file = readdir($handle)) !== false) {
        if ($file === '.' || $file === '..') {
            continue;
        }
        $path = $directory . '/' . $file;
        if (!is_file($path) || strtolower(pathinfo($file, PATHINFO_EXTENSION)) !== 'cses') {
            continue;
        }
        $mtime = filemtime($path);
        if ($mtime !== false && $mtime > $version) {
            $version = $mtime;
        }
    }
    closedir($handle);

    return (int)$version;
}

/**
 * 生成 ClassIsland 2.0 格式的集控清单。
 *
 * 数据源地址中的 `{id}` 由 ClassIsland 用用户填写的实例标识替换（URL 模板占位符）。
 */
function cses_ci_manifest($directoryId, $version, $baseUrl, $organizationName = null)
{
    if ($organizationName === null) {
        $organizationName = 'CSES Cloud (' . $directoryId . ')';
    }

    $manifest = array(
        'ServerKind' => 0, // Serverless：静态清单
        'CoreVersion' => CSES_CI_CORE_VERSION,
        'OrganizationName' => $organizationName,
    );

    $sources = array(
        'ClassPlanSource' => 'ClassPlans',
        'TimeLayoutSource' => 'TimeLayouts',
        'SubjectsSource' => 'Subjects',
        'DefaultSettingsSource' => 'Settings',
        'PolicySource' => 'Policy',
        'CredentialSource' => 'Credentials',
    );

    foreach ($sources as $name => $key) {
        $manifest[$name] = array(
            'Value' => $baseUrl . '?id=' . rawurlencode($directoryId) . '/{id}&key=' . $key,
            'Version' => (int)$version,
        );
    }

    return $manifest;
}

/**
 * 时间点。同时输出 2.0 的 TimeSpan 与旧版的 ISO 日期时间。
 */
function cses_ci_time_point($start, $end, $timeType, $defaultClassId)
{
    return array(
        'StartTime' => $start,
        'EndTime' => $end,
        'StartSecond' => '2025-01-01T' . $start,
        'EndSecond' => '2025-01-01T' . $end,
        'TimeType' => $timeType,
        'DefaultClassId' => $defaultClassId,
    );
}

/**
 * CSES 文档 → ClassIsland 档案数据。
 *
 * @param string $namespace 稳定 GUID 的命名空间（应包含实例组与实例标识）
 * @param string $section   只输出指定数据源（`ClassPlans` / `TimeLayouts` / `Subjects`），null 表示全部
 */
function cses_ci_profile($document, $namespace, $section = null)
{
    $subjects = array();
    $timeLayouts = array();
    $classPlans = array();
    $subjectIdsByName = array();

    $rawSubjects = isset($document['subjects']) && is_array($document['subjects']) ? $document['subjects'] : array();
    foreach ($rawSubjects as $subject) {
        if (!is_array($subject)) {
            continue;
        }
        $name = isset($subject['name']) ? (string)$subject['name'] : '';
        $uuid = isset($subject['uuid']) ? $subject['uuid'] : null;
        $id = cses_ci_valid_uuid($uuid) ? $uuid : cses_ci_stable_uuid($namespace . '/subject', $name);
        $subjectIdsByName[$name] = $id;
        $subjects[$id] = array(
            'Name' => $name,
            'Initial' => isset($subject['simplified_name']) ? (string)$subject['simplified_name'] : '',
            'TeacherName' => isset($subject['teacher']) ? (string)$subject['teacher'] : '',
            'IsOutDoor' => false,
        );
    }

    $rawSchedules = isset($document['schedules']) && is_array($document['schedules']) ? $document['schedules'] : array();
    foreach ($rawSchedules as $scheduleIndex => $schedule) {
        if (!is_array($schedule)) {
            continue;
        }

        $scheduleName = isset($schedule['name']) ? (string)$schedule['name'] : '';
        $timeLayoutUuid = isset($schedule['time_layout_uuid']) ? $schedule['time_layout_uuid'] : null;
        $timeLayoutId = cses_ci_valid_uuid($timeLayoutUuid)
            ? $timeLayoutUuid
            : cses_ci_stable_uuid($namespace . '/timelayout', 'schedule-' . $scheduleIndex);

        $days = cses_ci_norm_days(isset($schedule['enable_day']) ? $schedule['enable_day'] : null);
        if (!$days) {
            $days = array(1);
        }
        $weeks = isset($schedule['weeks']) ? (string)$schedule['weeks'] : 'all';
        $weekCountDiv = $weeks === 'even' ? 2 : ($weeks === 'odd' ? 1 : 0);

        $layouts = array();
        $classOrder = array();
        $lastEnd = '';
        $rawClasses = isset($schedule['classes']) && is_array($schedule['classes']) ? $schedule['classes'] : array();
        foreach ($rawClasses as $class) {
            if (!is_array($class)) {
                continue;
            }
            $start = cses_ci_norm_time(isset($class['start_time']) ? $class['start_time'] : null);
            $end = cses_ci_norm_time(isset($class['end_time']) ? $class['end_time'] : null);
            if ($start === '' || $end === '') {
                continue;
            }

            $subjectName = isset($class['subject']) ? (string)$class['subject'] : '';
            if ($subjectName !== '' && !isset($subjectIdsByName[$subjectName])) {
                // 课表里出现了科目列表中没有的科目：补一个，避免课表里出现空科目
                $newId = cses_ci_stable_uuid($namespace . '/subject', $subjectName);
                $subjectIdsByName[$subjectName] = $newId;
                $subjects[$newId] = array(
                    'Name' => $subjectName,
                    'Initial' => '',
                    'TeacherName' => '',
                    'IsOutDoor' => false,
                );
            }
            $subjectId = isset($subjectIdsByName[$subjectName])
                ? $subjectIdsByName[$subjectName]
                : cses_ci_stable_uuid($namespace . '/subject', 'unknown-' . $start);

            if ($lastEnd !== '') {
                // 两节课之间的空隙作为课间
                $layouts[] = cses_ci_time_point($lastEnd, $start, 1, $subjectId);
            }
            $lastEnd = $end;
            $layouts[] = cses_ci_time_point($start, $end, 0, $subjectId);
            $classOrder[] = $subjectId;
        }

        $timeLayouts[$timeLayoutId] = array(
            'Name' => $scheduleName,
            'Layouts' => $layouts,
        );

        $classes = array();
        foreach ($classOrder as $subjectId) {
            $classes[] = array('SubjectId' => $subjectId);
        }

        // CSES v2 中一张课表可以对应多个启用日，为每个启用日生成一个课程计划
        foreach ($days as $dayIndex => $day) {
            $scheduleUuid = isset($schedule['uuid']) ? $schedule['uuid'] : null;
            $classPlanId = ($dayIndex === 0 && cses_ci_valid_uuid($scheduleUuid))
                ? $scheduleUuid
                : cses_ci_stable_uuid($namespace . '/classplan', 'schedule-' . $scheduleIndex . '-day-' . $day);
            $classPlans[$classPlanId] = array(
                'TimeLayoutId' => $timeLayoutId,
                'TimeRule' => array(
                    'WeekDay' => $day === 7 ? 0 : $day, // ClassIsland 中 0 代表周日
                    'WeekCountDiv' => $weekCountDiv,
                    'WeekCountDivTotal' => $weekCountDiv > 0 ? 2 : 0,
                ),
                'Classes' => $classes,
                'Name' => count($days) > 1 ? ($scheduleName . ' (' . $day . ')') : $scheduleName,
                'IsOverlay' => false,
                'IsEnabled' => true,
            );
        }
    }

    return array(
        'Name' => '',
        'ClassPlans' => $section === null || $section === 'ClassPlans' ? cses_ci_object($classPlans) : new stdClass(),
        'TimeLayouts' => $section === null || $section === 'TimeLayouts' ? cses_ci_object($timeLayouts) : new stdClass(),
        'Subjects' => $section === null || $section === 'Subjects' ? cses_ci_object($subjects) : new stdClass(),
    );
}

/**
 * 将值转换为布尔值，无法转换时返回 null。
 */
function cses_ci_to_bool($value)
{
    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value) || is_float($value)) {
        return $value != 0;
    }
    if (is_string($value)) {
        $normalized = strtolower(trim($value));
        if ($normalized === 'true' || $normalized === '1') {
            return true;
        }
        if ($normalized === 'false' || $normalized === '0' || $normalized === '') {
            return false;
        }
    }

    return null;
}

/**
 * 将值转换为整数，无法转换时返回 null。
 */
function cses_ci_to_int($value)
{
    if (is_bool($value) || $value === null || $value === '') {
        return null;
    }
    if (!is_numeric($value)) {
        return null;
    }
    $number = (float)$value;

    return (int)round($number);
}

/**
 * 将值转换为浮点数，无法转换时返回 null。
 */
function cses_ci_to_float($value)
{
    if (is_bool($value) || $value === null || $value === '') {
        return null;
    }
    if (!is_numeric($value)) {
        return null;
    }

    return (float)$value;
}

/**
 * extraKey 中的设置项 → ClassIsland 2.0 的对应字段。
 *
 * 只输出 ClassIsland 2.0 中确实存在且类型兼容的条目：ClassIsland 反序列化应用设置时
 * 是严格的，一旦某个字段类型不匹配，整份设置都会读取失败并回退到默认值。
 */
function cses_ci_settings($document)
{
    $raw = cses_ci_section($document, 'Settings');
    $output = array();
    if (!$raw) {
        return new stdClass();
    }

    // 取值时忽略大小写
    $values = array();
    foreach ($raw as $key => $value) {
        if (is_string($key)) {
            $values[strtolower($key)] = $value;
        }
    }

    $boolKeys = array(
        'IsMainWindowVisible', 'IsWelcomeWindowShowed',
        'IsClassPrepareNotificationEnabled', 'IsClassChangingNotificationEnabled',
        'IsClassOffNotificationEnabled', 'HideOnFullscreen', 'AutoInstallUpdateNextStartup',
    );
    $intKeys = array('ClassPrepareNotifySeconds', 'Theme', 'HideMode', 'UpdateMode');
    $floatKeys = array('MainWindowBodyFontSize', 'MainWindowEmphasizedFontSize');
    $stringKeys = array('SelectedProfile', 'MainWindowFont');

    foreach ($boolKeys as $key) {
        $name = strtolower($key);
        if (!array_key_exists($name, $values)) {
            continue;
        }
        $value = cses_ci_to_bool($values[$name]);
        if ($value !== null) {
            $output[$key] = $value;
        }
    }
    foreach ($intKeys as $key) {
        $name = strtolower($key);
        if (!array_key_exists($name, $values)) {
            continue;
        }
        $value = cses_ci_to_int($values[$name]);
        if ($value !== null) {
            $output[$key] = $value;
        }
    }
    foreach ($floatKeys as $key) {
        $name = strtolower($key);
        if (!array_key_exists($name, $values)) {
            continue;
        }
        $value = cses_ci_to_float($values[$name]);
        if ($value !== null) {
            $output[$key] = $value;
        }
    }
    foreach ($stringKeys as $key) {
        $name = strtolower($key);
        if (!array_key_exists($name, $values)) {
            continue;
        }
        if (is_string($values[$name])) {
            $output[$key] = $values[$name];
        }
    }

    // 2.0 中该字段是集合，CSES 控制面板里是逗号分隔的文本
    $excluded = strtolower('ExcludedFullscreenWindow');
    if (array_key_exists($excluded, $values)) {
        $rawExcluded = $values[$excluded];
        if (is_array($rawExcluded)) {
            $output['ExcludedFullscreenWindow'] = array_values(array_filter($rawExcluded, 'is_string'));
        } elseif (is_string($rawExcluded)) {
            $items = preg_split('/[,，\\s]+/u', trim($rawExcluded), -1, PREG_SPLIT_NO_EMPTY);
            $output['ExcludedFullscreenWindow'] = $items === false ? array() : array_values($items);
        }
    }

    // 2.0 中该字段是 DateTime，非法值会让整份设置读取失败
    $lastCheck = strtolower('LastCheckUpdateTime');
    if (array_key_exists($lastCheck, $values) && is_string($values[$lastCheck])) {
        $text = trim($values[$lastCheck]);
        if ($text !== '' && strtotime($text) !== false) {
            $output['LastCheckUpdateTime'] = $text;
        }
    }

    return cses_ci_object($output);
}

/**
 * extraKey 中的策略项 → ClassIsland 限制策略。字段名与 2.0 的 ManagementPolicy 一一对应。
 */
function cses_ci_policy($document)
{
    $raw = cses_ci_section($document, 'Policy');
    $keys = array(
        'DisableProfileClassPlanEditing', 'DisableProfileTimeLayoutEditing',
        'DisableProfileSubjectsEditing', 'DisableProfileEditing', 'DisableSettingsEditing',
        'DisableSplashCustomize', 'DisableDebugMenu', 'AllowExitManagement', 'DisableEasterEggs',
    );

    $values = array();
    foreach ($raw as $key => $value) {
        if (is_string($key)) {
            $values[strtolower($key)] = $value;
        }
    }

    $output = array();
    foreach ($keys as $key) {
        $name = strtolower($key);
        if (!array_key_exists($name, $values)) {
            continue;
        }
        $value = cses_ci_to_bool($values[$name]);
        if ($value !== null) {
            $output[$key] = $value;
        }
    }

    return cses_ci_object($output);
}

/**
 * extraKey 中的认证项 → ClassIsland 凭据设置。字段名与 2.0 的 ManagementCredentialConfig 一一对应。
 */
function cses_ci_credentials($document)
{
    $raw = cses_ci_section($document, 'Credentials');
    $stringKeys = array('UserCredential', 'AdminCredential');
    $levelKeys = array(
        'EditAuthorizeSettingsAuthorizeLevel', 'EditPolicyAuthorizeLevel', 'ExitManagementAuthorizeLevel',
        'EditProfileAuthorizeLevel', 'EditSettingsAuthorizeLevel', 'ExitApplicationAuthorizeLevel',
        'ChangeLessonsAuthorizeLevel',
    );

    $values = array();
    foreach ($raw as $key => $value) {
        if (is_string($key)) {
            $values[strtolower($key)] = $value;
        }
    }

    $output = array();
    foreach ($stringKeys as $key) {
        $name = strtolower($key);
        if (array_key_exists($name, $values) && is_string($values[$name])) {
            $output[$key] = $values[$name];
        }
    }
    foreach ($levelKeys as $key) {
        $name = strtolower($key);
        if (!array_key_exists($name, $values)) {
            continue;
        }
        $value = cses_ci_to_int($values[$name]);
        if ($value !== null && $value >= 0 && $value <= 2) { // 0 无 / 1 用户 / 2 管理员
            $output[$key] = $value;
        }
    }

    return cses_ci_object($output);
}

/**
 * 按数据源名称取出对应的 ClassIsland 文档。不支持时返回 null。
 */
function cses_ci_document($document, $key, $namespace)
{
    switch (strtolower((string)$key)) {
        case 'classplans':
            return cses_ci_profile($document, $namespace, 'ClassPlans');
        case 'timelayouts':
            return cses_ci_profile($document, $namespace, 'TimeLayouts');
        case 'subjects':
            return cses_ci_profile($document, $namespace, 'Subjects');
        case 'policy':
            return cses_ci_policy($document);
        case 'credentials':
            return cses_ci_credentials($document);
        case 'settings':
            return cses_ci_settings($document);
        default:
            return null;
    }
}

/**
 * 由当前请求推导站点根地址，避免写死域名（便于自建部署）。
 */
function cses_ci_base_url()
{
    $host = isset($_SERVER['HTTP_HOST']) ? (string)$_SERVER['HTTP_HOST'] : '';
    $host = preg_replace('/[^A-Za-z0-9\.\-:\[\]]/', '', $host);
    if ($host === '') {
        $host = 'cloud.smart-teach.cn';
    }
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';

    return $scheme . $host;
}
