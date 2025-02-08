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