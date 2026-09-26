<?php
// PYLXU 5/17
// 注意：这里必须是单个 PHP 块。旧写法把开启标签与 include 拆成两个 PHP 段，
// 两段之间会输出一个换行，导致 function.php 内的 setcookie()/header()
// 报「headers already sent」，进而让 OAuth 回调与登出失效。
// 另：本注释内不可出现 PHP 结束标签，否则会提前结束 PHP 段并触发语法错误。
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
  <?php include __DIR__ . '/pages/owner_subuser.html'; ?>
<?php if (!empty($ICP_BEIAN)) : ?>
<span style="width: auto;margin: 0;border-radius: 0px;padding: 5px;" class="settings-card"><a href="https://beian.miit.gov.cn/" target="_blank" class="" style="color: black;width: 100%;display: block;text-align: center;"><?php echo htmlspecialchars($ICP_BEIAN, ENT_QUOTES, 'UTF-8'); ?></a></span>
<?php endif; ?>

</body>

</html>
