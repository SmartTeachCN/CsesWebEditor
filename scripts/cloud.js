// 添加全局变量
var currentTerminalId = localStorage.getItem("currentTerminalId");
let directoryId = null;

// 修改getCloudId函数
function getDirectoryAndTerminal() {

  // 获取目录ID
  fetch(`./?action=getId`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        document.querySelectorAll(".directoryId").forEach((el) => {
          el.textContent = data.directoryId;
        });
        directoryId = data.directoryId;

        // 获取终端列表
        fetch(`?action=listTerminals`)
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.terminals.length > 0) {
              if (!currentTerminalId) currentTerminalId = d.terminals[0];
              updateTerminalDisplay();
              loadCloudConfig();
            }
            populateTerminalSelect(d.terminals);
          });
      } else {
        // alert("获取目录ID失败: " + data.error);
      }
    });
}

// 新增终端操作函数
function populateTerminalSelect(terminals) {
  const select = document.getElementById("cloud-list");
  select.innerHTML = "";
  terminals.forEach((t) => {
    const option = document.createElement("fluent-option");
    option.value = t;
    option.className = "explorer-item";
    option.textContent = t;
    option.onclick = () => {
      switchTerminal(option.value);
    };
    option.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      delTerminal(option.value);
    });
    select.appendChild(option);
  });
  if (terminals.length > 0) select.value = currentTerminalId;
}

function addNewTerminal() {
  prompt("输入新终端ID", (a) => {
    if (a) {
      addNewTerminalA(a);
    }
  });
}

function delTerminal(b) {
  confirm(
    "确认删除终端：" + b + " 吗？删除后不可恢复",
    (a, b) => {
      if (a) {
        delTerminalA(b);
      }
    },
    b
  );
}

function delTerminalA(a) {
  try {
    fetch(
      `?action=del&terminalId=${encodeURIComponent(a)}`
    );
    getDirectoryAndTerminal();
  } catch (error) {
    console.error("删除失败:", error);
  }
}

function addNewTerminalA(a) {
  const newTerminalId = a;

  fetch("", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `terminalId=${encodeURIComponent(newTerminalId)}&config=`,
  }).then(() => {
    currentTerminalId = newTerminalId;
    localStorage.setItem("currentTerminalId", newTerminalId);
    getDirectoryAndTerminal();
  });
}

function switchTerminal(terminalId) {
  currentTerminalId = terminalId;
  localStorage.setItem("currentTerminalId", terminalId);
  updateTerminalDisplay();
  loadCloudConfig();
}

function updateTerminalDisplay() {
  document.querySelectorAll(".configId").forEach((el) => {
    el.textContent = currentTerminalId;
  });
  trickAnimation();
}

async function loadCloudConfig() {
  try {
    const terminalId = localStorage.getItem("currentTerminalId");
    const response = await fetch(`?action=load&terminalId=${encodeURIComponent(terminalId)}`);
    const config = await response.text();
    importFileFromStr(config);

    // 加载共享配置
    const shareResponse = await fetch(`api.php?action=getSpaceConfig&terminalId=${encodeURIComponent(terminalId)}`);
    if (shareResponse.ok) {
      const shareData = await shareResponse.json();
      updateShareUI(shareData.config);
    }

    initializeSettings();
  } catch (error) {
    console.error("加载配置失败:", error);
  }
}

function updateShareUI(config) {
  return;

  const shareSwitch = document.getElementById('share-switch');
  const shareMode = document.getElementById('share-mode');
  const passwordCard = document.getElementById('password-card');
  const whitelistCard = document.getElementById('whitelist-card');

  shareSwitch.checked = config.enabled || false;
  shareMode.value = config.mode || 'password';
  document.getElementById('share-password').value = config.password || '';
  document.getElementById('share-whitelist').value = (config.whitelist || []).join(', ');

  // 更新UI显示状态
  toggleShareSettings();
}

// 共享空间

// 显示/隐藏共享设置
function toggleShareSettings() {
  const enabled = document.getElementById('share-switch').checked;
  document.getElementById('share-mode-card').style.display = enabled ? 'flex' : 'none';
  if (!enabled) {
    document.getElementById('password-card').style.display = 'none';
    document.getElementById('whitelist-card').style.display = 'none';
  } else {
    toggleAuthMethod();
  }
}

document.getElementById('share-mode').addEventListener('change', function () {
  if (this.value === 'password') {
    document.getElementById('share-whitelist').value = '';
  } else {
    document.getElementById('share-password').value = '';
  }
});

function toggleAuthMethod() {
  const mode = document.getElementById('share-mode').value;
  document.getElementById('password-card').style.display = mode === 'password' ? 'flex' : 'none';
  document.getElementById('whitelist-card').style.display = mode === 'whitelist' ? 'flex' : 'none';
}

// 保存空间配置
async function saveSpaceConfig() {
  const terminalId = localStorage.getItem("currentTerminalId");
  const enabled = document.getElementById('share-switch').checked;
  const mode = document.getElementById('share-mode').value;
  const password = document.getElementById('share-password').value;
  const whitelist = document.getElementById('share-whitelist').value.split(',').map(id => id.trim()).join(',');

  const formData = new URLSearchParams();
  formData.append('terminalId', terminalId);
  formData.append('enabled', enabled ? 'true' : 'false'); // 转换为字符串
  formData.append('mode', mode);
  formData.append('password', password);
  formData.append('whitelist', whitelist);

  try {
    const response = await fetch('api.php?action=spaceConfig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });
    const result = await response.json();
    alert(result.success ? '保存成功' : '保存失败: ' + result.error);
  } catch (error) {
    console.error('保存失败:', error);
    alert('保存配置时发生错误');
  }
}

async function joinSpace() {
  const targetUser = document.getElementById('target-user').value;
  const targetTerminal = document.getElementById('target-terminal').value;
  const localTerminal = document.getElementById('local-terminal').value || targetTerminal;

  if (!targetUser || !targetTerminal || !localTerminal) {
    alert('请填写所有必填字段');
    return;
  }

  let password = '';
  if (confirm('是否需要密码访问？')) {
    password = prompt('请输入访问密码');
  }

  try {
    const response = await fetch(`api.php?action=joinSpace&targetUser=${encodeURIComponent(targetUser)}&targetTerminal=${encodeURIComponent(targetTerminal)}&localTerminal=${encodeURIComponent(localTerminal)}&password=${encodeURIComponent(password)}`);
    const result = await response.json();
    if (result.success) {
      alert('成功加入共享空间！');
      location.reload(); // 刷新以加载新终端
    } else {
      alert('加入失败: ' + result.error);
    }
  } catch (error) {
    console.error('加入失败:', error);
    alert('请求过程中发生错误');
  }
}
