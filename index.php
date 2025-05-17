<?php $debug = false;
include 'function.php'; ?>
<!DOCTYPE html>
<html lang="zh-CN">

<head>
  <meta charset="UTF-8" />
  <title>CSES云服务</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0,user-scalable=0" />
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
    </div>
  </div>
  <div class="mobile-only-flex" id="mobile-bottomBar">
    <?php ui::renderSideBar(uiConfig::leftBar(), true) ?>
  </div>
  </div>
  <?php include('pages/login.html'); ?>
</body>

</html>