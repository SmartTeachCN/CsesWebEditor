let currentScheduleIndex = -1;
let currentClassIndex = -1;

function initSchedules() {
  const container = document.getElementById("schedule-list");
  container.innerHTML = "";
  currentData.schedules.forEach((schedule, index) => {
    const div = document.createElement("fluent-option");
    div.className = "explorer-item";
    const weekMode = schedule.weeks;
    const dayMode = schedule.enable_day;
    div.textContent =
      weekMap[weekMode] && dayMap[dayMode]
        ? weekMap[weekMode] + "_" + dayMap[dayMode]
        : `无规则计划 ${index + 1}`;
    div.addEventListener("click", () => {
      loadSchedule(index);
      document
        .querySelectorAll(".explorer-item")
        .forEach((item) => item.classList.remove("selected"));
      div.classList.add("selected");
    });
    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      confirm(
        `确定要删除计划 ${
          weekMap[weekMode] && dayMap[dayMode]
            ? weekMap[weekMode] + "_" + dayMap[dayMode]
            : `无规则计划 ${index + 1}`
        } 吗？`,
        (result, index) => {
          if (result) {
            currentData.schedules.splice(index, 1);
            saveSchedule();
            refreshScheduleList();
          }
        },
        index
      );
    });
    if (index === currentScheduleIndex) {
      div.classList.add("selected");
      div.setAttribute("aria-selected", "true");
    }
    container.appendChild(div);
  });
}

function loadSchedule(index) {
  document.getElementById(`schedule-editor`).style.display = "block";
  document.getElementById(`subject-editor`).style.display = "none";
  document.getElementById(`source-editor`).style.display = "none";
  if (checkDeviceType()) {
    location.href = "#schedule-editor";
    document.getElementById("schedule-editor").style.display = "block";
    document.getElementsByClassName("explorer")[0].style.display = "none";
    document.getElementsByClassName("editor-area")[0].style.display = "block";
  }
  currentScheduleIndex = index;
  document.getElementById("schedule-editor").style.display = "block";
  const schedule = currentData.schedules[index];
  const weekMode = schedule.weeks;
  const dayMode = schedule.enable_day;
  // const selectedWeekMode = weekMap[weekMode];
  // const selectedDayMode = dayMap[dayMode];
  document.getElementById("week-mode").value = weekMode;
  document.getElementById("day-mode").value = `${dayMode}`;
  refreshClassList();
  trickAnimation();
  initEditor();
}

function refreshClassList() {
  const listbox = document.getElementById("class-list");
  listbox.innerHTML = "";

  currentData.schedules[currentScheduleIndex].classes.forEach((cls, index) => {
    const item = document.createElement("fluent-option");
    item.value = index;
    item.addEventListener("click", () => {
      onClassSelect(index);
    });
    item.textContent = `${cls.subject} (${cls.start_time}-${cls.end_time})`;
    listbox.appendChild(item);
  });

  // 保持选中状态
  if (currentClassIndex !== -1) {
    listbox.value = currentClassIndex;
  }

  if (currentData.schedules[currentScheduleIndex].classes.length === 0) {
    listbox.innerHTML = "<fluent-option>暂无课程，点击下方添加</fluent-option>";
  }
}

function initEditor() {
  const select = document.getElementById("current-subject");
  select.innerHTML = "";

  currentData.subjects.forEach((s) => {
    console.log(s.name);
    const option = document.createElement("fluent-option");
    option.value = s.name;
    option.textContent = s.name;
    select.appendChild(option);
  });
  initQuickPanel();
}

// 初始化快速面板
function initQuickPanel() {
  const grid = document.querySelector(".subject-grid");
  grid.innerHTML = "";

  currentData.subjects.forEach((s) => {
    const btn = document.createElement("fluent-button");
    btn.appearance = "stealth";
    btn.textContent = s.name;
    btn.addEventListener("click", () => quickSetSubject(s.name));
    grid.appendChild(btn);
  });
}

function saveClass(index) {
  const container = document.getElementById("class-list").children[index];
  const subject = container.querySelector(".subject-select").value;
  const start_time = container.querySelectorAll(".time-input")[0].value;
  const end_time = container.querySelectorAll(".time-input")[1].value;
  currentData.schedules[currentScheduleIndex].classes[index] = {
    subject,
    start_time,
    end_time,
  };
  saveSchedule();
}

function deleteClass(index) {
  currentData.schedules[currentScheduleIndex].classes.splice(index, 1);
  saveSchedule();
  refreshClassList();
}

function addNewClass() {
  const newSchedule = {
    name: "无规则计划",
    classes: [],
  };
  currentData.schedules.push(newSchedule);
  saveSchedule();
  refreshScheduleList();
}

function addNewClassTime() {
  currentData.schedules[currentScheduleIndex].classes.push({
    subject: "",
    start_time: "",
    end_time: "",
  });
  currentClassIndex =
    currentData.schedules[currentScheduleIndex].classes.length - 1; // 设置新增课程为当前选中
  saveSchedule();
  refreshClassList();
}

function copySchdule() {
  const newSchedule = JSON.parse(
    JSON.stringify(currentData.schedules[currentScheduleIndex])
  );
  newSchedule.name = "无规则计划";
  currentData.schedules.push(newSchedule);
  saveSchedule();
  refreshScheduleList();
}

function refreshScheduleList() {
  initSchedules();
}

function updateSchedule() {
  const weekMode = document.getElementById("week-mode").value ?? "all";
  const dayMode = document.getElementById("day-mode").value ?? "1";
  const selectedWeekMode = Object.keys(weekMap).find(
    (key) => weekMap[key] === weekMode
  );
  const selectedDayMode = Object.keys(dayMap).find(
    (key) => dayMap[key] === dayMode
  );
  const scheduleName = `${
    weekMode.charAt(0).toUpperCase() + weekMode.slice(1)
  }_${dayMap_Full[dayMode]}`;
  currentData.schedules[currentScheduleIndex].name = scheduleName;
  currentData.schedules[currentScheduleIndex].enable_day = parseInt(
    dayMode,
    10
  );
  currentData.schedules[currentScheduleIndex].weeks = weekMode;
  saveSchedule();
  refreshScheduleList();
}

function autoFillClass() {
  alert(
    `<b>提示:</b> 本功能将会自动填充当前课程表中的所有课程，您可以在下方选择填充的科目。
  <br>
  <fluent-button appearance="accent" onclick="autoFill()">批量添加通用周星期一~星期日</fluent-button>
  `,
    "快速填充课程表"
  );
}

function autoFill() {
  const subjects = currentData.subjects;
  if (subjects.length === 0) {
    alert("请先添加科目");
    return;
  }

  const days = ["1", "2", "3", "4", "5", "6", "7"];
  days.forEach((day) => {
    const newSchedule = {
      name: `All_${dayMap_Full[day]}`,
      classes: [],
      weeks: "all",
      enable_day: parseInt(day, 10),
    };

    currentData.schedules.push(newSchedule);
  });

  saveSchedule();
  refreshScheduleList();
  alert("快速创建周一~周日通用周成功");
}

const weekMap = {
  odd: "单周",
  even: "双周",
  all: "通用",
};

const dayMap = {
  1: "星期一",
  2: "星期二",
  3: "星期三",
  4: "星期四",
  5: "星期五",
  6: "星期六",
  7: "星期日",
};

const dayMap_Full = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

function onClassSelect(index) {
  currentClassIndex = parseInt(index); // 更新课程索引
  const currentClass =
    currentData.schedules[currentScheduleIndex].classes[currentClassIndex];
  console.log(index);
  // 更新控件
  document.getElementById("current-subject").value = currentClass.subject;
  document.querySelectorAll(".time-input")[0].value = currentClass.start_time;
  document.querySelectorAll(".time-input")[1].value = currentClass.end_time;
}

function saveCurrentClass() {
  if (currentClassIndex === -1) return;

  const currentClass =
    currentData.schedules[currentScheduleIndex].classes[currentClassIndex];
  currentClass.subject = document.getElementById("current-subject").value;
  saveSchedule();
  refreshClassList();
}

function deleteCurrentClass() {
  if (currentClassIndex === -1) return;

  currentData.schedules[currentScheduleIndex].classes.splice(
    currentClassIndex,
    1
  );
  saveSchedule();
  refreshClassList();
  currentClassIndex = -1; // 重置课程索引
}

function quickSetSubject(subject) {
  if (currentClassIndex === -1) return;

  currentData.schedules[currentScheduleIndex].classes[
    currentClassIndex
  ].subject = subject;
  saveSchedule();
  refreshClassList();

  // 自动下移焦点
  const maxIndex =
    currentData.schedules[currentScheduleIndex].classes.length - 1;
  currentClassIndex = Math.min(currentClassIndex + 1, maxIndex);
  document.getElementById("class-list").value = currentClassIndex;
  document.getElementById("current-subject").value = subject;
}

function quickSetTime() {
  if (currentClassIndex === -1) return;
  currentData.schedules[currentScheduleIndex].classes[
    currentClassIndex
  ].start_time = document.querySelectorAll(".time-input")[0].value;
  currentData.schedules[currentScheduleIndex].classes[
    currentClassIndex
  ].end_time = document.querySelectorAll(".time-input")[1].value;
  saveSchedule();
  refreshClassList();
}
