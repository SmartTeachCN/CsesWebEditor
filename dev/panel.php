<?php
// PYLXU 5/17
// 注意：这里必须是单个 PHP 块。旧写法 `<?php ... ?>\n<?php include(...)` 会在两个块之间
// 输出一个换行，导致 function.php 内的 setcookie()/header() 报「headers already sent」，
// 进而让 OAuth 回调与登出失效。
include('function.php');
?>
<!DOCTYPE html>
<html lang="zh-CN">

<head>
  <meta charset="UTF-8" />
  <title>CSES Cloud</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0,user-scalable=0" />
  <link href="/assets/cloud.css" rel="stylesheet" />
  <?php include('pages/include.html'); ?>
</head>

<body>
  <div class="menu-bar">
    <?php include('pages/topbar.html'); ?>
  </div>
  <div class="container">
    <?php ui::renderSideBar(uiConfig::leftBar()) ?>
    <?php include 'pages/explorer.html'; ?>

    <div class="editor-area">
      <?php ui::renderEditors(uiConfig::editors()); ?>
      <?php include 'pages/problems.html'; ?>
    </div>
  </div>
  <div class="mobile-only-flex" id="mobile-bottomBar">
    <?php ui::renderSideBar(uiConfig::leftBar(), true) ?>
  </div>
  </div>
  <?php include('pages/login.html'); ?>
  <fluent-dialog id="owner-subuser-dialog" modal hidden data-skip-unsaved>
    <div class="subuser-dialog">
      <div class="subuser-dialog-head">
        <div style="font-size:16px">管理子用户</div>
        <fluent-button onclick="closeOwnerSubModal()" title="关闭"><i class="bi bi-x-lg"></i></fluent-button>
      </div>
      <div class="subuser-hint">
        实例组标识：<span class="directoryId"></span> ·
        子用户属于整个实例组，可在「可管理实例」中限定其能编辑哪些实例。
      </div>
      <div class="subuser-create-row">
        <fluent-text-field id="owner-subuser-name" placeholder="子用户名" class="flex-input"></fluent-text-field>
        <fluent-text-field id="owner-subuser-pass" placeholder="密钥（留空随机生成）" type="password" class="flex-input"></fluent-text-field>
        <div id="owner-subuser-strength" class="subuser-strength"></div>
        <fluent-button appearance="accent" onclick="ownerSub_add()" class="subuser-create-btn">创建子用户</fluent-button>
      </div>
      <div class="subuser-create-row" style="margin-top:-4px">
        <label class="subuser-scope-label" onclick="ownerSub_labelToggle(event,'owner-subuser-only-current')" title="勾选后新子用户仅能管理当前实例">
          <fluent-checkbox id="owner-subuser-only-current"></fluent-checkbox>
          <span>仅授权当前实例</span>
        </label>
      </div>
      <table class="subuser-table">
        <thead>
          <tr>
            <th style="width:26%">用户名</th>
            <th style="width:34%">可管理实例</th>
            <th style="width:30%">密钥</th>
            <th style="width:10%;text-align:right">操作</th>
          </tr>
        </thead>
        <tbody id="owner-subuser-tbody"></tbody>
      </table>
      <div class="subuser-hint">
        子用户在 <b>/subuser.php</b> 使用「实例组标识 + 用户名 + 密钥」登录，
        面板复用主界面的配置 / 档案 / 文件区块。
      </div>
    </div>
  </fluent-dialog>
  <fluent-dialog id="owner-subuser-scope-dialog" modal hidden data-skip-unsaved>
    <div class="subuser-dialog" style="min-width:420px">
      <div class="subuser-dialog-head">
        <div style="font-size:16px">可管理实例 —— <span id="owner-subuser-scope-name"></span></div>
        <fluent-button onclick="closeOwnerSubScope()" title="关闭"><i class="bi bi-x-lg"></i></fluent-button>
      </div>
      <div class="settings-card" style="margin-top:0">
        <i class="bi bi-collection"></i>
        <div class="left-section">
          <div class="title">全部实例</div>
          <div class="description">开启后该子用户可管理实例组内的所有实例（含之后新建的实例）</div>
        </div>
        <div class="right-section">
          <fluent-switch id="owner-subuser-scope-all" onchange="ownerSub_scopeAllChanged()"></fluent-switch>
        </div>
      </div>
      <div id="owner-subuser-scope-list" class="subuser-scope-list"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
        <fluent-button onclick="closeOwnerSubScope()">取消</fluent-button>
        <fluent-button appearance="accent" onclick="ownerSub_scopeSave()">保存</fluent-button>
      </div>
    </div>
  </fluent-dialog>
<?php if (!empty($ICP_BEIAN)) : ?>
<span style="width: auto;margin: 0;border-radius: 0px;padding: 5px;" class="settings-card"><a href="https://beian.miit.gov.cn/" target="_blank" class="" style="color: black;width: 100%;display: block;text-align: center;"><?php echo htmlspecialchars($ICP_BEIAN, ENT_QUOTES, 'UTF-8'); ?></a></span>
<?php endif; ?>

</body>

</html>
