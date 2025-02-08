// 初始化
const version = "1.6";
function init() {
  loadFromStorage();
  initActivityBar();
  initSchedules();
  initSubjects();
  initDragDrop();
}

// 初始化功能切换栏
function initActivityBar() {
  document.querySelectorAll(".activity-item").forEach((item) => {
    item.addEventListener("click", () => {
      document
        .querySelectorAll(".activity-item")
        .forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");
      if (edited) {
        confirm("您已对当前科目变更且未保存,是否继续切换页面?", (r) => {
          if (r) showView(item.dataset.view);
        });
      } else {
        showView(item.dataset.view);
      }
    });
  });
  document.querySelectorAll("#mobile-bottomBar > button").forEach((item) => {
    item.addEventListener("click", () => {
      document
        .querySelectorAll("#mobile-bottomBar > button")
        .forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");
      if (edited) {
        confirm("您已对当前科目变更且未保存,是否继续切换页面?", (r) => {
          if (r) showView(item.dataset.view);
        });
      } else {
        showView(item.dataset.view);
      }
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
  if (view === "schedule") {
    document.getElementById("schedule-list").style.display = "block";
    document.getElementById("subject-list").style.display = "none";
    document.getElementById("add-subject-btn").style.display = "none";
    document.getElementById("auto-fill-btn").style.display = "flex";
    document.getElementById("add-schedule-btn").style.display = "flex";
    if (checkDeviceType()) {
      location.href = "#";
      document.getElementsByClassName("editor-area")[0].style.display = "none";
    }
    refreshScheduleList();
  } else if (view === "source") {
    document.getElementById("schedule-list").style.display = "none";
    document.getElementById("subject-list").style.display = "none";
    document.getElementsByClassName("explorer")[0].style.display = "none";
    document.getElementById("add-subject-btn").style.display = "none";
    document.getElementById("auto-fill-btn").style.display = "none";
    document.getElementById("add-schedule-btn").style.display = "none";
    document.getElementById(`${view}-editor`).style.display = "block";
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
  } else if (view === "subject") {
    document.getElementById("schedule-list").style.display = "none";
    document.getElementById("subject-list").style.display = "block";
    document.getElementById("add-subject-btn").style.display = "flex";
    document.getElementById("auto-fill-btn").style.display = "none";
    document.getElementById("add-schedule-btn").style.display = "none";
    refreshSubjectList();
    if (checkDeviceType()) {
      location.href = "#";
      document.getElementsByClassName("editor-area")[0].style.display = "none";
    }
  }
}

function about() {
  showModal(`<h2 style="margin-bottom:6px">CSES课程表编辑器 v${version} FluentUI</h2>
  <i>CSES是指The Course Schedule Exchange Schema，
  是一种用于课程表交换的数据格式。
  本工具旨在帮助用户快速编辑CSES格式的课程表。</i>

  <b>当前版本:</b>${version}
    <b>开发人员:</b>PYLXU、RinLit、MKStoler1024
    <b>项目地址:</b><a href="https://github.com/CSES-org/CsesWebEditor">GitHub</a>
   <b>开放许可:</b>MIT License`);
}

// 启动应用
init();
