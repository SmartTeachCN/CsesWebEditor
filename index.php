<?php
include('api.php');
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
  <link rel="stylesheet" href="style.css?ver=2503209" />
  <script src="scripts/device.js" defer></script>
  <script src="scripts/ui.js" defer></script>
  <script src="scripts/storage.js" defer></script>
  <script src="scripts/schedule.js" defer></script>
  <script src="scripts/subject.js" defer></script>
  <script src="scripts/classisland.js" defer></script>
  <script src="scripts/loading.js" defer></script>
  <script src="scripts/shortcut.js" defer></script>
  <script src="scripts/main.js?ver=250319" defer></script>
  <script src="scripts/cloud.js?ver=25030202" defer></script>
  <script src="scripts/control.js?ver=2503202" defer></script>
</head>

<body>
  <div class="menu-bar">
    <span id="leftArea" style="display: flex; align-items: center; flex: auto">
      <span id="titleArea" style="display: flex; align-items: center">
        <h2 onclick="about()" id="webTitle">CSES Cloud&nbsp;</h2>
        <div class="topbarBtnGroup">
        <button onclick="getUserInfo()" class="online" title="登录信息"><i class="bi bi-person-check"></i></button>
        <button onclick="exportFile_Local()" title="导出"><i class="bi bi-box-arrow-up-right"></i></button>
        <!-- <button class="desktop-only" onclick="location.href = 'https://edit.cses-org.cn/'">本地编辑</button> -->
        <!-- <button class="desktop-only" onclick="keyHelp()">快捷键</button> -->
        <button onclick="about()" title="关于软件"><i class="bi bi-info-circle"></i></button>
        </div>
      </span>
      <span id="separator" style="flex: 1"></span>
      <!-- <button id="clearButton" onclick="clearData()">清空</button> -->
    </span>
    <span id="fileArea" style="display: flex; align-items: center">
      <span class="configId desktop-only"></span>&nbsp;&nbsp;
      <fluent-button style="margin-right: 10px" onclick="importFile()">
        <span class="desktop-only"><i class="bi bi-box-arrow-in-right"></i>&nbsp;导入文件</span><span class="mobile-only"><i class="bi bi-box-arrow-in-right"></i></span>
      </fluent-button>
      <fluent-button appearance="accent" onclick="exportFile()" class="online">
        <span class="desktop-only"><i class="bi bi-cloud-upload"></i>&nbsp;保存到云</span><span class="mobile-only"><i class="bi bi-cloud-upload"></i></span>
      </fluent-button>
      <input type="file" id="file-input" hidden accept=".yaml,.yml,.json" />
    </span>
  </div>

  <div class="container">
    <fluent-listbox class="activity-bar">
      <button class="activity-item selected online" aria-selected="true" data-view="cloud" data-des="终端管理">
        <i class="bi bi-cloud"></i>终端
      </button>
      <button class="activity-item online" data-view="control" data-des="集控配置">
        <i class="bi bi-gear-wide-connected"></i>配置
      </button>
      <button class="activity-item" data-view="schedule" data-des="课程档案">
        <i class="bi bi-calendar"></i>档案
      </button>
      <button class="activity-item" data-view="source" data-des="文件预览">
        <i class="bi bi-file-earmark-text"></i>文件
      </button>
    </fluent-listbox>

    <div class="explorer">
      <p class="pageTitle" id="explorerTitle">终端管理</p>
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
        <p class="pageTitle pageTitle_main">终端信息</p>
        <h4>基本</h4>
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
            <span style="user-select:text;display:none" id="url2">https://cloud.cses-org.cn/user/<span
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
        <h4>配置</h4>
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
              <fluent-option value="ea">ExamAware云控</fluent-option>
              <fluent-option value="cy">通用CSES</fluent-option>
              <fluent-option value="cj">通用CSES(JSON)</fluent-option>
            </fluent-select>
          </div>
        </div>
        <h4 style="display:none">空间共享</h4>
        <div class="settings-card" style="display:none">
            <i class="bi bi-people"></i>
            <div class="left-section">
                <div class="title">加入其他空间</div>
                <div class="description">输入用户ID、目标终端ID及本地终端ID</div>
            </div>
            <div class="right-section">
                <fluent-text-field id="target-user" placeholder="用户ID"></fluent-text-field>
                <fluent-text-field id="target-terminal" placeholder="目标终端ID"></fluent-text-field>
                <fluent-text-field id="local-terminal" placeholder="本地终端ID"></fluent-text-field>
                <fluent-button onclick="joinSpace()">加入</fluent-button>
            </div>
        </div>
        <div class="settings-card" style="display:none">
          <i class="bi bi-share"></i>
          <div class="left-section">
            <div class="title">共享当前空间</div>
            <div class="description">启用后其他用户可加入此空间</div>
          </div>
          <div class="right-section">
            <fluent-switch id="share-switch" onchange="toggleShareSettings()"></fluent-switch>
          </div>
        </div>
        <div class="settings-card" id="share-mode-card" style="display:none">
          <i class="bi bi-shield-lock"></i>
          <div class="left-section">
            <div class="title">访问控制</div>
            <div class="description">选择加入空间的验证方式</div>
          </div>
          <div class="right-section">
            <fluent-select id="share-mode" onchange="toggleAuthMethod()">
              <fluent-option value="password">密码验证</fluent-option>
              <fluent-option value="whitelist">白名单</fluent-option>
            </fluent-select>
          </div>
        </div>
        <div class="settings-card" id="password-card" style="display:none">
          <i class="bi bi-key"></i>
          <div class="left-section">
            <div class="title">共享密码</div>
            <div class="description">设置其他用户加入时需要的密码</div>
          </div>
          <div class="right-section">
            <fluent-text-field type="password" id="share-password" placeholder="输入密码"></fluent-text-field>
          </div>
        </div>
        <div class="settings-card" id="whitelist-card" style="display:none">
          <i class="bi bi-person-check"></i>
          <div class="left-section">
            <div class="title">用户白名单</div>
            <div class="description">输入允许的用户ID，用逗号分隔</div>
          </div>
          <div class="right-section">
            <fluent-text-area id="share-whitelist" placeholder="用户ID列表"></fluent-text-area>
          </div>
        </div>
        <div class="settings-card" style="display:none">
          <div class="left-section"></div>
          <div class="right-section">
            <fluent-button appearance="accent" onclick="saveSpaceConfig()">
              保存空间设置
            </fluent-button>
          </div>
        </div>



        <script>
        
          function donwCiC() {
            // 创建一个JSON对象
            const data = {
              "ManagementServerKind": 0,
              "ManagementServer": "",
              "ManagementServerGrpc": "",
              "ManifestUrlTemplate": "https://cloud.cses-org.cn/classisland/manifest.php?id=" + document.querySelectorAll(".directoryId")[0].innerHTML
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
        <p class="pageTitle pageTitle_main">课表编辑</p>
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
      <p class="pageTitle pageTitle_main2">导出设定</p>
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
      <p class="pageTitle pageTitle_main2">集控选项</p>
        <div id="settingsTabs">
          <!-- 动态生成的tab和tab-panel -->
        </div>
        <div id="settingsContainer"></div>
      </div>

      <div id="subject-editor" style="display: none">
        <p class="pageTitle pageTitle_main">科目编辑</p>
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
      <button data-view="cloud" class="selected online" data-des="终端管理">
        <i class="bi bi-cloud"></i><span>终端管理</span>
      </button>
      <button data-view="control" data-des="集控管理">
        <i class="bi bi-gear-wide-connected"></i><span>集控管理</span>
      </button>
      <button data-view="schedule" data-des="课程档案">
        <i class="bi bi-calendar"></i><span>课程档案</span>
      </button>
      <button data-view="source" data-des="文件预览">
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
        const response = await fetch('api.php', {
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
          if (r) window.location.href = 'https://auth.smart-teach.cn/login/oauth/authorize?client_id=&response_type=code&redirect_uri=https://cloud.cses-org.cn/&scope=openid%20profile%20email'
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
