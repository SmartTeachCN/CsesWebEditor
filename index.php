<?php

// echo '系统正在升级！';

// exit;
// 瑞思账户系统
// $APPID = "";
// $TOKEN = "";
$CASDOOR_CLIENT_ID = "";
$CASDOOR_CLIENT_SECRET = "";
$CASDOOR_ENDPOINT = "";
$REDIRECT_URI = "";
$ENCYC = ""; // 加密名称

session_start();

// 获取 X-Real-IP
// $xRealIp = isset($_SERVER['HTTP_X_REAL_IP']) ? $_SERVER['HTTP_X_REAL_IP'] : $_SERVER['REMOTE_ADDR'] ?? '未知';

// 处理认证回调
if (isset($_GET['code'])) {
  // 获取回调请求中的token参数
  $token = isset($_GET['code']) ? $_GET['code'] : '';

  // 目标URL
  $url = "$CASDOOR_ENDPOINT/api/login/oauth/access_token";

  // 要发送的POST数据
  $data = [
    "client_id" => $CASDOOR_CLIENT_ID,
    "client_secret" => $CASDOOR_CLIENT_SECRET,
    "code" => $token,
    "grant_type" => "authorization_code",
    "redirect_uri" => $REDIRECT_URI
  ];

  // 初始化cURL会话
  $ch = curl_init($url);

  // 设置cURL选项
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); // 返回结果而不是直接输出
  curl_setopt($ch, CURLOPT_POST, true);           // 指定使用POST方法
  curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data)); // 设置POST数据

  // 执行cURL请求
  $response = curl_exec($ch);

  // 检查是否有错误发生
  if (curl_errno($ch)) {
    echo 'cURL error: ' . curl_error($ch);
    exit;
  }

  // 关闭cURL会话
  curl_close($ch);

  // echo $response;


  $result = json_decode($response);

  setcookie('accessToken', $result->access_token, time() + 3600 * 24 * 10, '/');


  // 重定向回主页
  header('Location: /');
  exit;
}


// Casdoor的API URL
$url = "$CASDOOR_ENDPOINT/api/userinfo";

// 访问令牌
$accessToken = $_COOKIE['accessToken'];

// 初始化cURL会话
$ch = curl_init($url);

// 设置cURL选项
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); // 返回结果而不是直接输出
curl_setopt($ch, CURLOPT_HTTPGET, true);        // 指定使用GET方法
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Authorization: Bearer $accessToken" // 设置Authorization头
]);

// 执行cURL请求
$response = curl_exec($ch);

// 检查是否有错误发生
if (curl_errno($ch)) {
  echo 'cURL error: ' . curl_error($ch);
  exit;
}

$userData = json_decode($response, true);

// 关闭cURL会话
curl_close($ch);

// 处理用户信息
$_SESSION['user'] = [
  'id' => $userData['sub'],
  'name' => $userData['name'],
  'email' => $userData['email'],
  'preferred_username' => $userData['preferred_username']
];

// echo json_encode($_SESSION['user']);

// 处理API请求
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  header('Content-Type: application/json');
  if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => '未登录']);
    exit;
  }

  // 保存配置处理
  // $deviceId = $_POST['deviceId'] ?? '';
  $config = $_POST['config'] ?? '';
  $terminalId = $_POST['terminalId'] ?? '';
  if (empty($terminalId)) {
    echo json_encode(['success' => false, 'error' => '终端ID不能为空']);
    exit;
  }

  // 获取用户信息
  // $userInfo = json_decode(file_get_contents("https://api.3r60.top/v2/account/getUserInfo.php?token=" . $TOKEN . "&deviceId=" . $deviceId), true);

  // if ($userInfo['code'] !== 200) {
  //   echo json_encode(['success' => false, 'error' => '无效设备ID']);
  //   exit;
  // }

  if (mb_strlen($config) >= 250000) {
    echo json_encode(['success' => false, 'error' => '当前终端配置长度超过最大限制(250000)']);
    exit;
  }

  $userId = $_SESSION['user']['id'];

  // 创建用户目录
  $mappingFile = __DIR__ . '/user/' . $ENCYC . '.json';
  $mappings = [];

  if (file_exists($mappingFile)) {
    $mappings = json_decode(file_get_contents($mappingFile), true);
  }

  if (!isset($mappings[$userId])) {
    $randomDir = substr(str_shuffle(str_repeat('abcdefghijklmnopqrstuvwxyz0123456789', 10)), 0, 10);
    $mappings[$userId] = $randomDir;
    file_put_contents($mappingFile, json_encode($mappings));
    mkdir(__DIR__ . '/user/' . $randomDir, 0755, true); // 创建目录
  }

  $userDir = __DIR__ . '/user/' . $mappings[$userId];

  // 保存配置文件
  $configPath = $userDir . '/' . $terminalId . '.cses';
  file_put_contents($configPath, $config);
  echo json_encode(['success' => true]);
  exit;
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action'])) {
  switch ($_GET['action']) {
    case 'load':
      // 加载配置处理
      // $deviceId = $_GET['deviceId'] ?? '';
      $terminalId = $_GET['terminalId'] ?? '';

      // $userInfo = json_decode(file_get_contents("https://api.3r60.top/v2/account/getUserInfo.php?token=" . $TOKEN . "&deviceId=" . $deviceId), true);

      // if ($userInfo['code'] !== 200) {
      //   echo json_encode(['success' => false, 'error' => '无效设备ID']);
      //   exit;
      // }

      $userId = $_SESSION['user']['id'];
      $mappingFile = __DIR__ . '/user/' . $ENCYC . '.json';

      if (!file_exists($mappingFile)) {
        echo json_encode([]);
        exit;
      }

      $mappings = json_decode(file_get_contents($mappingFile), true);
      if (!isset($mappings[$userId])) {
        echo json_encode([]);
        exit;
      }

      $userDir = __DIR__ . '/user/' . $mappings[$userId];
      $configFile = $userDir . '/' . $terminalId . '.cses';

      if (file_exists($configFile)) {
        echo file_get_contents($configFile);
      } else {
        echo json_encode(['success' => false, 'error' => '配置文件不存在']);
      }
      exit;

    case 'getNewDeviceId':
      // echo file_get_contents("https://api.3r60.top/v2/account/spawnDeviceID.php?app_id=" . $APPID . "&token=" . $TOKEN . "&ip=" . $xRealIp);
      exit;

    case 'getId':
      // $deviceId = $_GET['deviceId'] ?? '';
      $terminalId = $_GET['terminalId'] ?? '';

      // $userInfo = json_decode(file_get_contents("https://api.3r60.top/v2/account/getUserInfo.php?token=" . $TOKEN . "&deviceId=" . $deviceId), true);

      // if ($userInfo['code'] !== 200) {
      //   echo json_encode(['success' => false, 'error' => '无效设备ID']);
      //   exit;
      // }

      $userId = $_SESSION['user']['id'];
      $mappingFile = __DIR__ . '/user/' . $ENCYC . '.json';

      if (!file_exists($mappingFile)) {
        echo json_encode([]);
        exit;
      }

      $mappings = json_decode(file_get_contents($mappingFile), true);
      if (!isset($mappings[$userId])) {
        echo json_encode([]);
        exit;
      }

      echo json_encode(['success' => true, 'directoryId' => $mappings[$userId]]);
      exit;

    case 'del':
      // $deviceId = $_GET['deviceId'] ?? '';
      $terminalId = $_GET['terminalId'] ?? '';

      // 验证设备ID和终端ID
      if (empty($terminalId)) {
        echo json_encode(['success' => false, 'error' => '设备ID或终端ID不能为空']);
        exit;
      }

      // 获取用户信息
      // $userInfo = json_decode(file_get_contents("https://api.3r60.top/v2/account/getUserInfo.php?token=" . $TOKEN . "&deviceId=" . $deviceId), true);

      // if ($userInfo['code'] !== 200) {
      //   echo json_encode(['success' => false, 'error' => '无效设备ID']);
      //   exit;
      // }

      // $userId = $userInfo['userInfo']['basicInfo']['userId'];
      $userId = $_SESSION['user']['id'];
      $mappingFile = __DIR__ . '/user/' . $ENCYC . '.json';

      if (!file_exists($mappingFile)) {
        echo json_encode(['success' => false, 'error' => '用户目录映射文件不存在']);
        exit;
      }

      $mappings = json_decode(file_get_contents($mappingFile), true);
      if (!isset($mappings[$userId])) {
        echo json_encode(['success' => false, 'error' => '用户ID未找到']);
        exit;
      }

      $userDir = __DIR__ . '/user/' . $mappings[$userId];
      $configFile = $userDir . '/' . $terminalId . '.cses';

      // 检查配置文件是否存在
      if (!file_exists($configFile)) {
        echo json_encode(['success' => false, 'error' => '终端配置文件不存在']);
        exit;
      }

      // 删除配置文件
      if (unlink($configFile)) {
        echo json_encode(['success' => true, 'message' => '终端配置删除成功']);
      } else {
        echo json_encode(['success' => false, 'error' => '删除终端配置失败']);
      }
      exit;
    case 'listTerminals':
      header('Content-Type: application/json');
      // $deviceId = $_GET['deviceId'] ?? '';

      // $userInfo = json_decode(file_get_contents("https://api.3r60.top/v2/account/getUserInfo.php?token=" . $TOKEN . "&deviceId=" . $deviceId), true);

      // if ($userInfo['code'] !== 200) {
      //   echo json_encode(['success' => false, 'error' => '无效设备ID']);
      //   exit;
      // }

      $userId = $_SESSION['user']['id'];
      // $userId = $userInfo['userInfo']['basicInfo']['userId'];
      $mappingFile = __DIR__ . '/user/' . $ENCYC . '.json';

      if (!file_exists($mappingFile)) {
        echo json_encode([]);
        exit;
      }

      $mappings = json_decode(file_get_contents($mappingFile), true);
      if (!isset($mappings[$userId])) {
        echo json_encode([]);
        exit;
      }

      $userDir = __DIR__ . '/user/' . $mappings[$userId];
      $terminals = [];

      if (is_dir($userDir)) {
        $files = scandir($userDir);
        foreach ($files as $file) {
          if (pathinfo($file, PATHINFO_EXTENSION) === 'cses') {
            $terminals[] = pathinfo($file, PATHINFO_FILENAME);
          }
        }
      }

      echo json_encode(['success' => true, 'terminals' => $terminals]);
      exit;
    case "logout":
      session_destroy();
      setcookie('accessToken', "");
      header('Location: /');
      exit;
  }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">

<head>
  <meta charset="UTF-8" />
  <title>CSES云服务</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0,user-scalable=0" />
  <link href="https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/bootstrap-icons/1.8.1/font/bootstrap-icons.css"
    type="text/css" rel="stylesheet" />
  <script src="https://lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/js-yaml/4.1.0/js-yaml.min.js"
    type="application/javascript"></script>
  <script src="https://assets.3r60.top/Jquery/jquery-3.5.1.js"></script>
  <!-- <script
      type="module"
      src="https://unpkg.com/@fluentui/web-components"
    ></script> -->
  <script type="module" src="https://npm.elemecdn.com/@fluentui/web-components"></script>
  <link rel="stylesheet" href="style.css?ver=250222" />
  <script src="scripts/device.js" defer></script>
  <script src="scripts/ui.js" defer></script>
  <script src="scripts/storage.js" defer></script>
  <script src="scripts/schedule.js" defer></script>
  <script src="scripts/subject.js" defer></script>
  <script src="scripts/classisland.js" defer></script>
  <script src="scripts/loading.js" defer></script>
  <script src="scripts/shortcut.js" defer></script>
  <script src="scripts/main.js" defer></script>
  <script src="scripts/cloud.js" defer></script>
  <script src="scripts/control.js" defer></script>
</head>

<body>
  <div class="menu-bar">
    <span id="leftArea" style="display: flex; align-items: center; flex: auto">
      <span id="titleArea" style="display: flex; align-items: center">
        <h2 onclick="about()" id="webTitle">CSES Cloud&nbsp;</h2>
        <button onclick="getUserInfo()" class="online">登录信息</button>
        <button onclick="exportFile_Local()">导出</button>
        <!-- <button class="desktop-only" onclick="location.href = 'https://edit.cses-org.cn/'">本地编辑</button> -->
        <!-- <button class="desktop-only" onclick="keyHelp()">快捷键</button> -->
        <button class="desktop-only" onclick="about()">关于</button>
      </span>
      <span id="separator" style="flex: 1"></span>
      <!-- <button id="clearButton" onclick="clearData()">清空</button> -->
    </span>
    <span id="fileArea" style="display: flex; align-items: center">
      <span class="configId"></span>&nbsp;&nbsp;
      <fluent-button style="margin-right: 10px" onclick="importFile()">
        <i class="bi bi-box-arrow-in-right"></i>&nbsp;导入文件
      </fluent-button>
      <fluent-button appearance="accent" onclick="exportFile()" class="online">
        <i class="bi bi-cloud-upload"></i>&nbsp;保存到云
      </fluent-button>
      <input type="file" id="file-input" hidden accept=".yaml,.yml,.json" />
    </span>
  </div>

  <div class="container">
    <fluent-listbox class="activity-bar">
      <fluent-option class="activity-item selected online" aria-selected="true" data-view="cloud">
        <i class="bi bi-cloud"></i>&nbsp;终端管理
      </fluent-option>
      <fluent-option class="activity-item online" data-view="control">
        <i class="bi bi-gear-wide-connected"></i>&nbsp;集控管理
      </fluent-option>
      <fluent-option class="activity-item" data-view="schedule">
        <i class="bi bi-calendar"></i>&nbsp;课程档案
      </fluent-option>
      <fluent-option class="activity-item" data-view="source">
        <i class="bi bi-file-earmark-text"></i>&nbsp;文件预览
      </fluent-option>
    </fluent-listbox>

    <div class="explorer">
      <fluent-tabs activeid="scheduleB" id="explorerB" style="display: none;">
        <fluent-tab id="scheduleB"> &nbsp;&nbsp;<i class="bi bi-calendar"></i>&nbsp;课程表&nbsp;</fluent-tab>
        <fluent-tab id="timeB">&nbsp;<i class="bi bi-clock-history"></i>&nbsp;时间表&nbsp;</fluent-tab>
        <fluent-tab id="subjectB">&nbsp;<i class="bi bi-journal-bookmark"></i>&nbsp;科目&nbsp;</fluent-tab>
        <fluent-tab-panel id="scheduleBPanel">
          <fluent-listbox id="schedule-list" style="margin-top: 5px;"></fluent-listbox>
          <fluent-button id="add-schedule-btn" class="explorer-item" onclick="addNewClass()" style="margin-top: 5px">
            + 添加课程
          </fluent-button>
          <fluent-button id="auto-fill-btn" class="explorer-item" onclick="autoFillClass()"
            style="display: flex; margin-top: 5px">
            <i class="bi bi-lightning-fill"></i>&nbsp;快速填充
          </fluent-button>
        </fluent-tab-panel>
        <fluent-tab-panel id="timeBPanel">
          本功能尚未完成。
        </fluent-tab-panel>
        <fluent-tab-panel id="subjectBPanel">
          <fluent-listbox id="subject-list" style="margin-top: 5px;"></fluent-listbox>
          <fluent-button id="add-subject-btn" class="explorer-item" style="margin-top: 5px" onclick="addNewSubject()">
            + 添加科目
          </fluent-button>
        </fluent-tab-panel>

      </fluent-tabs>


      <fluent-listbox id="cloud-list" style="display: block"></fluent-listbox>
      <fluent-button id="add-cloud-btn" class="explorer-item" onclick="addNewTerminal()"
        style="display: flex; margin-top: 5px">
        + 添加终端
      </fluent-button>



    </div>

    <div class="editor-area">

      <div id="cloud-editor" style="display: block">
        <h2>云服务</h2>
        <h4>终端信息</h4>
        <div class="settings-card">
          <i class="bi bi-info-circle"></i>
          <div class="left-section">
            <div class="title">终端组标识</div>
            <div class="description">在受支持的程序中选择终端组,此ID是唯一的</div>
          </div>
          <div class="right-section">
            <span style="user-select:text" class="directoryId"></span>
          </div>
        </div>
        <div class="settings-card">
          <i class="bi bi-bookmark"></i>
          <div class="left-section">
            <div class="title">终端标识符</div>
            <div class="description">在受支持的程序中选择终端的标识符</div>
          </div>
          <div class="right-section">
            <span class="configId" style="user-select:text"></span>
          </div>
        </div>
        <div class="settings-card">
          <i class="bi bi-link-45deg"></i>
          <div class="left-section">
            <div class="title">源文件地址</div>
            <div class="description">可以通过此链接访问此终端的完整配置</div>
          </div>
          <div class="right-section">
            <fluent-button onclick="copyUrl()">
              复制
            </fluent-button>
            <span style="user-select:text;display:none" id="url2">https://cses.3r60.top/user/<span
                class="directoryId"></span>/<span class="configId"></span>.cses</span>
          </div>
          <script>
            function copyUrl() {
              navigator.clipboard.writeText(document.getElementById('url2').textContent).then(() => {
                console.log("文本已成功复制到剪贴板！");
              }).catch(err => {
                console.error("复制失败：", err);
              });
            }
          </script>
        </div>
        <h4>终端配置</h4>
        <div class="settings-card">
          <i class="bi bi-code-slash"></i>
          <div class="left-section">
            <div class="title">终端类型</div>
            <div class="description">选择该终端要使用的配置类型</div>
          </div>
          <div class="right-section">
            <fluent-button id="donwCiCB" onclick="donwCiC()">下载配置清单</fluent-button>
            <fluent-select id="output-mode" onchange="outputSet()" title="选择导出格式">
              <fluent-option value="ci">ClassIsland静态集控</fluent-option>
              <fluent-option value="cy">通用CSES</fluent-option>
              <fluent-option value="cj">通用CSES(JSON)</fluent-option>
            </fluent-select>
          </div>
        </div>
        <h4>操作空间</h4>
        <div class="settings-card">
          <i class="bi bi-bookmark"></i>
          <div class="left-section">
            <div class="title">空间名称</div>
            <div class="description">填写学校名称或其他名称帮助他人识别</div>
          </div>
          <div class="right-section">

          </div>
        </div>
        <div class="settings-card">
          <i class="bi bi-box-arrow-in-right"></i>
          <div class="left-section">
            <div class="title">加入空间</div>
            <div class="description">当其他人允许时加入他人的编辑空间</div>
          </div>
          <div class="right-section">

          </div>
        </div>
        <div class="settings-card">
          <i class="bi bi-list-ul"></i>
          <div class="left-section">
            <div class="title">空间白名单</div>
            <div class="description">按逗号分隔用户ID,填写后他人可以直接将空间绑定到您的空间（移除后他人将失去权利）</div>
          </div>
          <div class="right-section">

          </div>
        </div>



        <script>
          function donwCiC() {
            // 创建一个JSON对象
            const data = {
              "ManagementServerKind": 0,
              "ManagementServer": "",
              "ManagementServerGrpc": "",
              "ManifestUrlTemplate": "https://cses.3r60.top/classisland/manifest.php?id=" + document.querySelectorAll(".directoryId")[0].innerHTML
            };

            // 将JSON对象转换为字符串
            const jsonString = JSON.stringify(data, null, 2);

            // 创建一个Blob对象，设置文件类型为JSON
            const blob = new Blob([jsonString], { type: "application/json" });

            // 创建一个下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "file.json"; // 设置下载文件的名称
            a.click(); // 触发下载
            URL.revokeObjectURL(url); // 释放对象URL
          }
        </script>

      </div>

      <div id="schedule-editor" style="display: none">
        <h2>课程计划编辑</h2>
        <div class="settings-card">
          <i class="bi bi-calendar-day"></i>
          <div class="left-section">
            <div class="title">启用星期</div>
            <div class="description">选择此张课表的作用星期</div>
          </div>
          <div class="right-section">
            <fluent-select id="day-mode" onchange="updateSchedule()">
              <fluent-option value="1">星期一</fluent-option>
              <fluent-option value="2">星期二</fluent-option>
              <fluent-option value="3">星期三</fluent-option>
              <fluent-option value="4">星期四</fluent-option>
              <fluent-option value="5">星期五</fluent-option>
              <fluent-option value="6">星期六</fluent-option>
              <fluent-option value="7">星期日</fluent-option>
            </fluent-select>
          </div>
        </div>
        <div class="settings-card">
          <i class="bi bi-arrow-repeat"></i>
          <div class="left-section">
            <div class="title">轮周设定</div>
            <div class="description">设置该课表在哪些特定周使用</div>
          </div>
          <div class="right-section">
            <fluent-select id="week-mode" onchange="updateSchedule()">
              <fluent-option value="odd">单周</fluent-option>
              <fluent-option value="even">双周</fluent-option>
              <fluent-option value="all">通用</fluent-option>
            </fluent-select>
          </div>
        </div>
        <br />
        <div class="editor-layout">
          <div class="editor-left">
            <span style="height: 300px; overflow-y: auto;display: block;">
              <fluent-listbox id="class-list" style="width: 100%;"></fluent-listbox>
            </span>

            <div class="class-controls">
              <fluent-button appearance="accent" onclick="addNewClassTime()">
                + 添加课时
              </fluent-button>
              <fluent-select onchange="quickSetSubject(this.value)" id="current-subject"
                style="width: 150px"></fluent-select>
              <fluent-button onclick="deleteCurrentClass()">删除当前</fluent-button>
              <input type="time" class="time-input" onchange="quickSetTime(currentClassIndex)">
              <input type="time" class="time-input" onchange="quickSetTime(currentClassIndex)">
            </div>
          </div>

          <div class="quick-add-panel">
            <h3>快速添加课程</h3>
            <br>
            <div class="subject-grid"></div>
          </div>
        </div>
        <fluent-button onclick="copySchdule()" style="margin-top: 1rem; margin-left: 5px">
          复制副本
        </fluent-button>
        <!-- <fluent-button
            onclick="autoFillClass()"
            style="margin-top: 1rem; margin-left: 5px"
          >
            <i class="bi bi-lightning-fill"></i>&nbsp;快速填充
          </fluent-button> -->
      </div>

      <div id="source-editor" style="display: none">
        <h3 class="offline">本地导出</h3>
        <span class="offline">导出格式:</span><br class="offline">
        <fluent-select class="offline" id="output-mode2" onchange="outputSet()" title="选择导出格式">
          <fluent-option value="ci">ClassIsland课表档案</fluent-option>
          <fluent-option value="cy">通用CSES</fluent-option>
          <fluent-option value="cj">通用CSES(JSON)</fluent-option>
        </fluent-select>
        <br class="offline">
        <h3>导出预览</h3><br>
        <fluent-text-area readonly="true" aria-placeholder="生产文件的内容将在这里显示" id="yaml-editor"></fluent-text-area>
      </div>

      <div id="control-editor" style="display: none">
        <h3>集控选项</h3>
        <span>此处设置项内容取决于您设定的终端类型</span>
        <div id="settingsTabs">
          <!-- 动态生成的tab和tab-panel -->
        </div>
        <div id="settingsContainer"></div>
      </div>

      <div id="subject-editor" style="display: none">
        <h2>科目信息管理</h2>
        <div id="subject-form">
          <div class="settings-card">
            <i class="bi bi-bookmark"></i>
            <div class="left-section">
              <div class="title">科目名称</div>
              <div class="description">科目的完整名称</div>
            </div>
            <div class="right-section">
              <fluent-text-field type="text" id="subject-name" placeholder="科目名称">
              </fluent-text-field>
            </div>
          </div>
          <div class="settings-card">
            <i class="bi bi-bookmark-dash"></i>
            <div class="left-section">
              <div class="title">科目简称</div>
              <div class="description">科目的简写名称</div>
            </div>
            <div class="right-section">
              <fluent-text-field type="text" id="subject-simple" placeholder="简称">
              </fluent-text-field>
            </div>
          </div>
          <div class="settings-card">
            <i class="bi bi-person-check"></i>
            <div class="left-section">
              <div class="title">任科教师</div>
              <div class="description">[可选]任课教师的姓名</div>
            </div>
            <div class="right-section">
              <fluent-text-field type="text" id="subject-teacher" placeholder="任课教师">
              </fluent-text-field>
            </div>
          </div>
          <div class="settings-card">
            <i class="bi bi-flag"></i>
            <div class="left-section">
              <div class="title">教学教室</div>
              <div class="description">[可选]上课的教室标识</div>
            </div>
            <div class="right-section">
              <fluent-text-field type="text" id="subject-room" placeholder="教室">
              </fluent-text-field>
            </div>
          </div>
          <div class="settings-card" style="background-color: transparent;border:none">
            <div class="left-section">
            </div>
            <div class="right-section">
              <fluent-button appearance="accent" onclick="saveSubject()" style="margin-left: auto;width: 178px">
                保存
              </fluent-button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="mobile-only-flex" id="mobile-bottomBar">
      <button data-view="cloud" class="selected online">
        <i class="bi bi-cloud"></i><span>终端管理</span>
      </button>
      <button data-view="control">
        <i class="bi bi-gear-wide-connected"></i><span>集控管理</span>
      </button>
      <button data-view="schedule">
        <i class="bi bi-calendar"></i><span>课程档案</span>
      </button>
      <button data-view="source">
        <i class="bi bi-file-earmark-text"></i><span>文件预览</span>
      </button>
    </div>
  </div>
  <script>

    var hasLogin = true;

    function getUserInfo() {
      confirm(`用户标识: <?php echo $_SESSION['user']['id'] ?><br>
                    用户名称: <?php echo $_SESSION['user']['name'] ?><br>
                    点击“确认”清除登录痕迹`, (r) => {
        if (r) {
          location.href = './?action=logout';
        }
      });
      ;
    }

    async function saveToCloud(config, format, noNotice) {
      try {
        const response = await fetch('', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `terminalId=${encodeURIComponent(localStorage.getItem("currentTerminalId"))}&config=${encodeURIComponent(config)}`
        });

        const result = await response.json();
        if (noNotice) return;
        if (result.success) {
          alert('配置保存成功！');
        } else {
          alert('保存失败: ' + (result.error || '未知错误'));
        }
      } catch (error) {
        console.error('保存失败:', error);
        alert('保存配置时发生错误');
      }
    }
    document.addEventListener("DOMContentLoaded", (event) => {
      if (!"<?php echo $_SESSION['user']['id'] ?>") {
        confirm("您好，您尚未登录，云功能将不可用。如需加载云功能，请点击“确认”按钮登录", (r) => {
          if (r) window.location.href = ''
        })
        hasLogin = false;
        document.querySelectorAll(".online").forEach(element => {
          element.disabled = true;
        });
      }
      if (hasLogin) {
        getDirectoryAndTerminal();
        document.querySelectorAll(".offline").forEach(element => {
          element.style.display = "none";
        });
      } else {
        showView('schedule');
      }
    });

    const content = document.getElementsByClassName("editor-area")[0];

    function trickAnimation() {
      let start = null;
      const duration = 200;
      const initialPaddingTop = 16;
      const finalPaddingTop = 100;

      function animate(timestamp) {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);

        // 二次缓出函数（ease-out）
        const easedProgress = 1 - (1 - progress) * (1 - progress); // t^2
        const currentPaddingTop = initialPaddingTop + (finalPaddingTop - initialPaddingTop) * (1 - easedProgress);

        content.style.paddingTop = `${currentPaddingTop}px`;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          content.style.paddingTop = `${initialPaddingTop}px`;
        }
      }

      requestAnimationFrame(animate);
    }

    trickAnimation();
  </script>
</body>

</html>