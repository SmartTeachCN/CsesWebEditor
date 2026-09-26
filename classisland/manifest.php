<?php
/**
 * 静态集控清单（ClassIsland 集控清单）。
 *
 * 客户端在「加入管理」时填写的配置文件里指向本地址（`ManifestUrlTemplate`），
 * 之后每次启动/同步都会重新拉取，因此这里必须输出完整的 2.0 清单：
 * 核心版本、服务器类型与六类数据源。
 *
 * 数据源地址中的 `{id}` 由客户端用实例标识替换，所以本接口只需要实例组标识。
 */

require_once __DIR__ . '/convert.php';

$directoryId = isset($_GET['id']) ? (string)$_GET['id'] : '';

if (!cses_ci_valid_dir_id($directoryId)) {
    cses_ci_json(array('error' => '缺少或非法的实例组标识（id）'), 400);
}

$version = cses_ci_directory_version($directoryId);
if ($version === 0) {
    cses_ci_json(array('error' => '实例组不存在或还没有任何实例，请先在 CSES Cloud 中保存一次实例配置'), 404);
}

cses_ci_json(
    cses_ci_manifest($directoryId, $version, cses_ci_base_url() . '/classisland/file.php'),
    200
);
