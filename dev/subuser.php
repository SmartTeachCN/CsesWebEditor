<?php
// 子用户面板
// ---------------------------------------------------------------------------
// 与主面板 (panel.php) 保持同样的骨架：功能栏 + 资源管理器 + 编辑器 iframe，
// 「实例 / 配置 / 档案 / 文件」四个区块都直接复用主面板的 pages/editor/*.html
// （「实例」区块用 ?subuser=1 隐藏主人专属的子用户管理入口），
// 因此 editor-area 的样式与边距和主面板完全一致。
//
// 打开方式：/subuser.php?dir=<实例组标识>
// 凭据（子用户名 / 密钥）不通过 URL 传递：由独立登录窗口输入，
// 且只保存在本标签页的 sessionStorage 中。
include('function.php');

$subDir = isset($_GET['dir']) ? (string)$_GET['dir'] : '';
$subTerminal = isset($_GET['tid']) ? (string)$_GET['tid'] : '';
$subDirJs = tool::validDirId($subDir) ? $subDir : '';
$subTerminalJs = tool::validTerminalId($subTerminal) ? $subTerminal : '';
?>
<!DOCTYPE html>
<html lang="zh-CN">

<head>
  <meta charset="UTF-8" />
  <title>子用户面板 · CSES Cloud</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0,user-scalable=0" />
  <link href="/assets/cloud.css" rel="stylesheet" />
  <?php include('pages/include_subuser.html'); ?>
  <script>window.__SUBUSER_DIR = <?php echo json_encode($subDirJs, JSON_UNESCAPED_UNICODE); ?>;window.__SUBUSER_TERMINAL = <?php echo json_encode($subTerminalJs, JSON_UNESCAPED_UNICODE); ?>;</script>
</head>

<body>
  <div class="menu-bar">
    <span id="leftArea" style="display: flex; align-items: center; flex: auto">
      <span id="titleArea" style="display: flex; align-items: center">
        <i class="bi bi-people" style="font-size: 20px; margin-right: 8px"></i>
        <h3 id="webTitle" style="display: flex">子用户面板&nbsp;</h3>
        <div class="topbarBtnGroup">
          <button onclick="subOpenLogin()" id="subuser-login-toggle" title="登录 / 更换凭据">
            <i class="bi bi-box-arrow-in-right"></i>
          </button>
          <button onclick="toggleColorMode()" title="深色模式">
            <i class="bi bi-moon"></i>
          </button>
        </div>
        <span class="subuser-session" id="subuser-session">
          <i class="bi bi-person"></i>&nbsp;子用户：<b id="subuser-session-name">未登录</b>
        </span>
      </span>
      <span id="separator" style="flex: 1"></span>
    </span>
    <span id="fileArea" style="display: flex; align-items: center">
      <span class="configId desktop-only" style="margin-right: 10px"></span>
      <fluent-button style="margin-right: 10px" onclick="file.exportL()">
        <span class="desktop-only"><i class="bi bi-box-arrow-up-right"></i>&nbsp;导出文件</span>
        <span class="mobile-only"><i class="bi bi-box-arrow-up-right"></i></span>
      </fluent-button>
      <fluent-button appearance="accent" id="save-button" onclick="subAuth.save()">
        <span class="desktop-only"><i class="bi bi-cloud-upload"></i>&nbsp;保存到实例</span>
        <span class="mobile-only"><i class="bi bi-cloud-upload"></i></span>
      </fluent-button>
      <input type="file" id="file-input" hidden accept=".yaml,.yml,.json" />
    </span>
  </div>
  <div class="container">
    <?php ui::renderSideBar(uiConfig::subuserLeftBar()) ?>
    <?php // 资源管理器与主面板共用同一份定义（档案区块 + 可管理实例列表） ?>
    <?php include 'pages/explorer.html'; ?>

    <div class="editor-area">
      <!-- 未登录 / 未选择实例时的占位。边距与编辑器页面一致（同为 padding:0 12px 12px），
           避免出现"内容贴边 / 排布异常"。 -->
      <div id="subuser-placeholder" class="editor-page subuser-placeholder">
        <p class="pageTitle pageTitle_main">子用户面板</p>
        <h3>尚未选择实例</h3>
        <ol>
          <li>点击右上角的 <i class="bi bi-box-arrow-in-right"></i> 图标（或左侧「登录 / 更换凭据」）；</li>
          <li>填写 <b>实例组标识</b>、<b>子用户名</b> 与 <b>密钥</b>；</li>
          <li>登录后左侧会列出你 <b>可管理的实例</b>，点击实例即可开始编辑；</li>
          <li>编辑区块与主面板完全一致：<b>配置 / 档案 / 文件</b>，保存时直接写回该实例。</li>
        </ol>
      </div>
      <?php ui::renderEditors(uiConfig::subuserLeftBar()); ?>
      <?php include 'pages/problems.html'; ?>
    </div>
  </div>
  <div class="mobile-only-flex" id="mobile-bottomBar">
    <?php ui::renderSideBar(uiConfig::subuserLeftBar(), true) ?>
  </div>

  <!-- 凭据输入区：独立窗口 -->
  <fluent-dialog id="subuser-login-dialog" modal hidden data-skip-unsaved style="--dialog-width: min(440px, 94vw); --dialog-height: auto">
    <div class="subuser-dialog subuser-login">
      <div class="subuser-dialog-head">
        <div style="font-size:16px">子用户登录</div>
        <fluent-button onclick="subCloseLogin()" title="关闭"><i class="bi bi-x-lg"></i></fluent-button>
      </div>
      <div class="subuser-hint">
        使用 <b>实例组标识</b>、<b>子用户名</b> 与 <b>密钥</b> 登录；认证通过后会列出你可管理的实例。
      </div>
      <fluent-text-field id="subuser-dir" placeholder="实例组标识"></fluent-text-field>
      <fluent-text-field id="subuser-user" placeholder="子用户名"></fluent-text-field>
      <fluent-text-field id="subuser-key" type="password" placeholder="密钥"></fluent-text-field>
      <label class="subuser-scope-label" onclick="subToggleCheckbox(event,'subuser-remember')" title="仅保存在本标签页的 sessionStorage 中，关闭标签页即失效">
        <fluent-checkbox id="subuser-remember"></fluent-checkbox>
        <span>记住密钥（仅本标签页）</span>
      </label>
      <div id="subuser-auth-msg" class="subuser-hint"></div>
      <div class="subuser-login-actions">
        <fluent-button onclick="subAuth.forget()">清除凭据</fluent-button>
        <fluent-button appearance="accent" id="subuser-login-btn" onclick="subAuth.login()">登录</fluent-button>
      </div>
    </div>
  </fluent-dialog>

</body>

</html>
