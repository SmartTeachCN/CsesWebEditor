// 初始化
const version = "2.2";
function init() {
  loadFromStorage();
  initActivityBar();
  initSchedules();
  initSubjects();
  initDragDrop();
}

// 文本成员路径
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKeyIndex = keys.length - 1;
  for (let i = 0; i < lastKeyIndex; i++) {
      const key = keys[i];
      if (!obj[key]) {
          obj[key] = {};
      }
      obj = obj[key];
  }
  obj[keys[lastKeyIndex]] = value;
}
function getNestedValue(obj, path) {
  const keys = path.split('.');

  for (let key of keys) {
      if (!obj || typeof obj !== 'object' || !obj.hasOwnProperty(key)) {
          return undefined;
      }
      obj = obj[key];
  }
  return obj;
}

// 初始化功能切换栏
function initActivityBar() {
  document.querySelectorAll(".activity-item").forEach((item) => {
    item.addEventListener("click", () => {
      document
        .querySelectorAll(".activity-item")
        .forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");
      showView(item.dataset.view);
      document.getElementById("explorerTitle").innerHTML = item.dataset.des;
    });
  });
  document.querySelectorAll("#mobile-bottomBar > button").forEach((item) => {
    item.addEventListener("click", () => {
      document
        .querySelectorAll("#mobile-bottomBar > button")
        .forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");
      showView(item.dataset.view, true);
      document.getElementById("explorerTitle").innerHTML = item.dataset.des;
    });
  });
}

// 显示对应视图
function showView(view) {
  document.querySelectorAll(".editor-area > div").forEach((div) => {
    div.style.display = "none";
  });
  document.getElementsByClassName("explorer")[0].style.display = "block";
  document.getElementById(`${view}-editor`).style.display = "none";
  document.getElementsByClassName(`editor-area`)[0].style.borderRadius = "0px";
  if (view === "schedule") {
    document.getElementById("explorerB").style.display = "block";
    document.getElementById("cloud-list").style.display = "none";
    document.getElementById("add-cloud-btn").style.display = "none";
    document.getElementById("add-schedule-btn").style.display = "flex";
    if (checkDeviceType()) {
      location.href = "#";
      document.getElementsByClassName("editor-area")[0].style.display = "none";
    }
    refreshScheduleList();
    refreshSubjectList();
  } else if (view === "source") {
    document.getElementById("explorerB").style.display = "none";
    document.getElementById("cloud-list").style.display = "none";
    document.getElementsByClassName("explorer")[0].style.display = "none";
    document.getElementById(`${view}-editor`).style.display = "block";
    document.getElementsByClassName(`editor-area`)[0].style.borderRadius = "10px 0px 0px 0px";
    if (
      localStorage.getItem("output-mode") == "cy" ||
      localStorage.getItem("output-mode") == undefined
    ) {
      document.getElementById("yaml-editor").value = jsyaml.dump(currentData);
    } else if (localStorage.getItem("output-mode") == "cj") {
      document.getElementById("yaml-editor").value = JSON.stringify(
        currentData,
        null,
        2
      );
    } else if (localStorage.getItem("output-mode") == "ci") {
      document.getElementById("yaml-editor").value = JSON.stringify(
        CsestoCiFromat(currentData),
        null,
        2
      );
    }
    if (checkDeviceType()) {
      location.href = "#";
      document.getElementsByClassName("editor-area")[0].style.display = "block";
    }
  } else if (view === "cloud") {
    if (!hasLogin) {
      showView("schedule");
      return;
    }
    document.getElementById("explorerB").style.display = "none";
    document.getElementById("cloud-list").style.display = "block";
    document.getElementById("add-cloud-btn").style.display = "flex";
    document.getElementsByClassName("editor-area")[0].style.display = "block";
    document.getElementById(`${view}-editor`).style.display = "block";
  } else if (view === "control") {
    if (!hasLogin) {
      showView("schedule");
      return;
    }
    document.getElementsByClassName(`editor-area`)[0].style.borderRadius = "10px 0px 0px 0px";
    document.getElementById("explorerB").style.display = "none";
    document.getElementById("cloud-list").style.display = "none";
    document.getElementsByClassName("explorer")[0].style.display = "none";
    document.getElementById(`${view}-editor`).style.display = "block";
    if (
      localStorage.getItem("output-mode") == "cy" ||
      localStorage.getItem("output-mode") == undefined
    ) {
    } else if (localStorage.getItem("output-mode") == "cj") {
    } else if (localStorage.getItem("output-mode") == "ci") {
    }
    if (checkDeviceType()) {
      location.href = "#";
      document.getElementsByClassName("editor-area")[0].style.display = "block";
    }
  }
  trickAnimation();
}

function about() {
  showModal(`<h2 style="margin-bottom:6px">CSES Cloud</h2>
  <i>这是一款为集控平台统一而诞生的云平台 基于CSES Editor</i>

  <i>CSES是指The Course Schedule Exchange Schema，
  是一种用于课程表交换的数据格式。</i>

  <b>当前版本:</b>${version}
    <b>开发人员:</b>PYLXU、RinLit、MKStoler1024
    <b>项目地址:</b><a href="https://github.com/CSES-org/CsesWebEditor">GitHub</a>
   <b>开放许可:</b>MIT License`);
}

// 启动应用
init();
