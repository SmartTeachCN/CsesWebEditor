<?php

header("location: ./exam/index.html?configUrl=" . urlencode("https://cloud.smart-teach.cn/user/" . $_GET['id'] . ".cses"));