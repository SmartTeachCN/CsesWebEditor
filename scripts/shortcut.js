// 处理快捷键
document.addEventListener("keydown", (e) => {

  // Ctrl + S
  if (e.key.toLowerCase() === "s" && e.ctrlKey) {
    e.preventDefault();
    exportFile();
  } else if (event.keyCode === 112) {
    e.preventDefault();
    keyHelp();
  }

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
    const currentView = document.getElementById('explorerB').activeid;
    if (currentView === "scheduleB") {
      addNewClass();
    } else if (currentView === "subjectB") {
      addNewSubject();
    }
  }
});

// 在资源管理器中移动项目
function moveExplorerItem(direction) {
  const currentView = "";
  const currentView2 = document.getElementById('explorerB').activeid;
  if (currentView2 === "scheduleB") {
    currentView = "schedule";
  } else if (currentView2 === "subjectB") {
    currentView = "subject";
  }
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
  showModal(
    `<h3>快捷键帮助</h3>
    <b>Ctrl + ↑/↓:</b> 移动偏左栏中的项目
    <b>Ctrl + S:</b> 将现行配置保存到云端
    <b>Alt + N:</b> 新增课程或科目
    <b>Alt + ↑/↓:</b> 移动左栏中的项目
    <b>Delete:</b> 删除当前选中的项目
    <b>F1:</b> 打开本帮助菜单
  `
  );
}
