var currentTerminalId = localStorage.getItem("currentTerminalId");
let directoryId = null;

const terminal = {
  init() {
    showLoading(2, "正在拉取列表");
    const select = document.getElementById("cloud-list");
    select.innerHTML = "<center style='margin: 20px;'>正在加载终端列表...</center>";
    fetch(`function.php?action=getId`)
      .then((response) => {
        if (!response.ok) {
          alert("与服务器建立连接出现问题，确保您已连接网络，等待几分钟后刷新网页重试");
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          document.querySelectorAll(".directoryId").forEach((el) => {
            el.textContent = data.directoryId;
          });
          directoryId = data.directoryId;
          setTimeout(() => {
            fetch(`function.php?action=listTerminals`)
              .then((r) => {
                if (!r.ok) {
                  throw new Error(`HTTP error! status: ${r.status}`);
                }
                return r.json();
              })
              .then((d) => {
                if (d.success && d.terminals.length > 0) {
                  if (!currentTerminalId) currentTerminalId = d.terminals[0];
                  this.updateTag();
                  setTimeout(() => {
                    this.controlLoad();
                  }, 1000)
                }
                const terminals = d.terminals;
                select.innerHTML = "";
                terminals.forEach((t) => {
                  const option = document.createElement("fluent-option");
                  option.value = t;
                  option.className = "explorer-item";
                  option.innerHTML = `<i class="bi bi-terminal"></i>&nbsp;` + t;
                  option.onclick = () => {
                    terminal.load(option.value);
                  };
                  option.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    terminal.delUI(option.value);
                  });
                  select.appendChild(option);
                });
                if (terminals.length > 0) select.value = currentTerminalId;
              })
              .catch(error => {
                console.error('Error listing terminals:', error);
                select.innerHTML = "<center style='margin: 20px;'>加载终端列表失败</center>";
              });
            closeLoading(2);
          }, 1000)
        } else {
          throw new Error('Failed to get directory ID');
        }
      })
      .catch(error => {
        console.error('Error fetching directory ID:', error);
        select.innerHTML = "<center style='margin: 20px;'>获取目录ID失败</center>";
        alert("获取目录ID时出错，稍等几分钟后刷新网页或许能解决问题");
        closeLoading(2);
      });
  },
  load(terminalId) {
    currentTerminalId = terminalId;
    localStorage.setItem("currentTerminalId", terminalId);
    this.updateTag();
    this.controlLoad();
  },
  async controlLoad() {
    try {
      const terminalId = localStorage.getItem("currentTerminalId");
      if (terminalId == null) {
        throw new Error("您尚未选择终端，请选择/创建一个终端");
      }
      showLoading(2);
      const response = await fetch(`function.php?action=load&terminalId=${encodeURIComponent(terminalId)}`);
      const config = await response.text();
      file.importS(config);

      // 加载共享配置
      // const shareResponse = await fetch(`function.php?action=getSpaceConfig&terminalId=${encodeURIComponent(terminalId)}`);
      // if (shareResponse.ok) {
      //   const shareData = await shareResponse.json();
      //   updateShareUI(shareData.config);
      // }
      setTimeout(() => {
        controlMgr.init();
        closeLoading(2);
      }, 1000)
    } catch (error) {
      alert("加载配置" + error);
    }
  },
  add(a) {
    const newTerminalId = a;
    fetch("function.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `terminalId=${encodeURIComponent(newTerminalId)}&config=`,
    }).then(() => {
      currentTerminalId = newTerminalId;
      localStorage.setItem("currentTerminalId", newTerminalId);
      terminal.init();
    });
  },
  del(a) {
    try {
      fetch(
        `function.php?action=del&terminalId=${encodeURIComponent(a)}`
      );
      terminal.init();
    } catch (error) {
      console.error("删除失败:", error);
    }
  },
  updateTag() {
    document.querySelectorAll(".configId").forEach((el) => {
      el.textContent = currentTerminalId;
    });
    // trickAnimation();
  },
  addUI() {
    prompt("输入新终端ID", (a) => {
      if (a) {
        terminal.add(a);
      }
    });
  },
  delUI(b) {
    confirm(
      "确认删除终端：" + b + " 吗？删除后不可恢复",
      (a, b) => {
        if (a) {
          terminal.del(b);
        }
      },
      b
    );
  },
};



// 共享空间 - 尚未开始继续开发
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
    const response = await fetch('function.php?action=spaceConfig', {
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
    const response = await fetch(`function.php?action=joinSpace&targetUser=${encodeURIComponent(targetUser)}&targetTerminal=${encodeURIComponent(targetTerminal)}&localTerminal=${encodeURIComponent(localTerminal)}&password=${encodeURIComponent(password)}`);
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
