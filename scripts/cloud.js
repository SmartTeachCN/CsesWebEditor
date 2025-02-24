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
        alert("获取目录ID失败: " + data.error);
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
    const response = await fetch(
      `?action=load&terminalId=${encodeURIComponent(currentTerminalId)}`
    );
    const config = await response.text();

    importFileFromStr(config);

    initializeSettings();
  } catch (error) {
    console.error("加载配置失败:", error);
  }
}
