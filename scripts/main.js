// 初始化
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
      showView(item.dataset.view);
    });
  });
  document.querySelectorAll("#mobile-bottomBar > button").forEach((item) => {
    item.addEventListener("click", () => {
      document
        .querySelectorAll("#mobile-bottomBar > button")
        .forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");
      showView(item.dataset.view, true);
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
    document.getElementById("yaml-editor").value = jsyaml.dump(currentData);
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

// 文件导入
async function importFile() {
  const fileInput = document.getElementById("file-input");
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = jsyaml.load(e.target.result);
        currentData = data;
        saveSchedule();
        location.reload();
      } catch (error) {
        alert(`导入失败: ${error}`);
      }
    };
    reader.readAsText(file);
  };
  fileInput.click();
}

// 文件导出
function exportFile() {
  const yamlStr = jsyaml.dump(currentData);
  const blob = new Blob([yamlStr], { type: "text/yaml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "schedule.yaml";
  link.click();
}

// 清空数据
function clearData() {
  confirm("确定要清空所有数据吗？", (result) => {
    if (result) {
      localStorage.clear();
      currentData = { version: 1, subjects: [], schedules: [] };
      location.reload();
    }
  });
}

// 初始化拖拽导入
function initDragDrop() {
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) await importFile(file);
  });
}

// 处理快捷键
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    moveExplorerItem(e.key === "ArrowUp" ? -1 : 1);
  } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    moveActivityItem(e.key === "ArrowUp" ? -1 : 1);
  }
  // 删除当前选中的项目
  else if (e.key === "Delete") {
    e.preventDefault();
    const activeItem = document.querySelector(".explorer-item.selected");
    if (activeItem) {
      const currentView = document.querySelector(".activity-item.selected")
        .dataset.view;
      if (currentView === "schedule") {
        const index = Array.from(
          document.querySelectorAll("#schedule-list .explorer-item")
        ).indexOf(activeItem);
        if (index !== -1) {
          currentData.schedules.splice(index, 1);
          saveSchedule();
          refreshScheduleList();
        }
      } else if (currentView === "subject") {
        const index = Array.from(
          document.querySelectorAll("#subject-list .explorer-item")
        ).indexOf(activeItem);
        if (index !== -1) {
          currentData.subjects.splice(index, 1);
          saveSchedule();
          refreshSubjectList();
        }
      }
    }
  }

  // 新增课程或科目
  else if (e.altKey && e.key === "n") {
    e.preventDefault();
    const currentView = document.querySelector(".activity-item.selected")
      .dataset.view;
    if (currentView === "schedule") {
      addNewClass();
    } else if (currentView === "subject") {
      addNewSubject();
    }
  }
});

// 在资源管理器中移动项目
function moveExplorerItem(direction) {
  const activeItem = document.querySelector(".explorer-item.selected");
  if (!activeItem) return;
  const currentView = document.querySelector(".activity-item.selected").dataset
    .view;
  const items = Array.from(
    document.querySelectorAll(`#${currentView}-list .explorer-item`)
  );
  const currentIndex = items.indexOf(activeItem);
  const newIndex = currentIndex + direction;
  if (newIndex >= 0 && newIndex < items.length) {
    items[currentIndex].classList.remove("selected");
    items[newIndex].classList.add("selected");
    items[newIndex].click();
  }
}

// 在活动栏中移动项目
function moveActivityItem(direction) {
  const activeItem = document.querySelector(".activity-item.selected");
  if (!activeItem) return;
  const items = Array.from(document.querySelectorAll(".activity-item"));
  const currentIndex = items.indexOf(activeItem);
  const newIndex = currentIndex + direction;
  if (newIndex >= 0 && newIndex < items.length) {
    items[currentIndex].classList.remove("selected");
    items[newIndex].classList.add("selected");
    items[newIndex].click();
  }
}

function keyHelp() {
  alert(
    `<b>Ctrl + ↑/↓:</b> 移动偏左栏中的项目<br>
    <b>Alt + ↑/↓:</b> 移动左栏中的项目<br>
    <b>Alt + N:</b> 新增课程或科目<br>
    <b>Delete:</b> 删除当前选中的项目<br>
  `,
    "快捷键帮助"
  );
}

function about() {
  showModal(`<h2 style="margin-bottom:6px">CSES课程表编辑器 v1.2 FluentUI</h2>
  <i>CSES是指The Course Schedule Exchange Schema，
  是一种用于课程表交换的数据格式。
  本工具旨在帮助用户快速编辑CSES格式的课程表。</i>

  <b>当前版本:</b>1.2[25020600]
    <b>开发人员:</b>PYLXU、RinLit、MKStoler1024
    <b>项目地址:</b><a href="https://github.com/CSES-org/CsesWebEditor">GitHub</a>
   <b>开放许可:</b>MIT License`);
}

// 启动应用
init();
