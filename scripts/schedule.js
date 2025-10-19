let currentScheduleIndex = -1;
let currentClassIndex = -1;

const schedule = {
  weekMap: {
    odd: "单周",
    even: "双周",
    all: "通用",
  },
  dayMap: {
    1: "星期一",
    2: "星期二",
    3: "星期三",
    4: "星期四",
    5: "星期五",
    6: "星期六",
    7: "星期日",
  },
  dayMap_Full: {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
  },
  init() {
    const container = document.getElementById("schedule-list");
    container.innerHTML = "";
    if (storage.getOutputMode() == "es") { } else {
      const div = document.createElement("fluent-option");
      div.className = "explorer-item";
      div.innerHTML = `<i class="bi bi-table"></i> 表格视图`;
      div.addEventListener("click", () => {
        document.getElementById(`schedule-editor`).style.display = "none";
        document.getElementById(`subject-editor`).style.display = "none";
        document.getElementById(`source-editor`).style.display = "none";
        document.getElementById(`change-editor`).style.display = "block";
        if (checkDeviceType()) {
          location.href = "#schedule-editor";
          document.getElementById("change-editor").style.display = "block";
          document.getElementsByClassName("explorer")[0].style.display = "none";
          document.getElementsByClassName("editor-area")[0].style.display = "block";
        }
        this.view(this.viewMode);
      });
      container.appendChild(div);
      if (currentScheduleIndex == -1) {
        div.classList.add("selected");
        div.setAttribute("aria-selected", "true");
      }
    }
    currentData.schedules.forEach((schedule2, index) => {
      const div = document.createElement("fluent-option");
      div.className = "explorer-item";
      if (storage.getOutputMode() == "es") {
        div.innerHTML = schedule2.date ? `<i class="bi bi-calendar3-week"></i>&nbsp;` + schedule2.date
          : `<i class="bi bi-calendar3-week"></i>&nbsp;` + `未设定日期 ${index + 1}`;;
      } else {
        const weekMode = schedule2.weeks;
        const dayMode = schedule2.enable_day;
        div.innerHTML =
          this.weekMap[weekMode] && this.dayMap[dayMode]
            ? `<i class="bi bi-calendar3-week"></i>&nbsp;` + this.weekMap[weekMode] + "_" + this.dayMap[dayMode]
            : `<i class="bi bi-calendar3-week"></i>&nbsp;` + `无规则计划 ${index + 1}`;
      }
      div.addEventListener("click", () => {
        this.load(index);
        document
          .querySelectorAll(".explorer-item")
          .forEach((item) => item.classList.remove("selected"));
        div.classList.add("selected");
      });
      div.addEventListener("contextmenu", (e) => {
        e.preventDefault();

        confirm(
          storage.getOutputMode() == "es" ? (
            `确定要删除计划 ${schedule2.date
              ? schedule2.date
              : `未设定日期 ${index + 1}`
            } 吗？`) : (
            `确定要删除计划 ${this.weekMap[weekMode] && this.dayMap[dayMode]
              ? this.weekMap[weekMode] + "_" + this.dayMap[dayMode]
              : `无规则计划 ${index + 1}`
            } 吗？`),
          (result, index) => {
            if (result) {
              currentData.schedules.splice(index, 1);
              storage.save();
              schedule.init();
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
  },
  viewMode: "odd",
  view(viewMode = 'odd') {
    this.viewMode = viewMode;
    const viewtable = document.getElementById("change-table");
    viewtable.innerHTML = "";
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const schedules = currentData.schedules;

    if (!schedules || schedules.length === 0) return;

    const table = document.createElement("table");
    table.className = "preview-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    days.forEach(day => {
      const th = document.createElement("th");
      th.textContent = day;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    const dailyClasses = days.map((_, dayIndex) => {
      const matchingSchedules = schedules
        .filter(s => s.enable_day === (dayIndex + 1))
        .filter(schedule => {
          if (viewMode === 'odd' && schedule.weeks === 'odd') return true;
          if (viewMode === 'even' && schedule.weeks === 'even') return true;
          if (schedule.weeks === 'all') return true;
          return false;
        });

      const lastSchedule = matchingSchedules[matchingSchedules.length - 1];
      return {
        classes: lastSchedule ? [...lastSchedule.classes].sort((a, b) =>
          a.start_time.localeCompare(b.start_time)) : [],
        scheduleIndex: schedules.indexOf(lastSchedule)
      };
    });

    const maxClassesPerDay = Math.max(...dailyClasses.map(day => day.classes.length));

    const subjectSelector = document.createElement('div');
    subjectSelector.className = 'subject-selector2';
    subjectSelector.style.cssText = `
      position: fixed;
      display: none;
      flex-wrap: wrap;
      gap: 5px;
      padding: 10px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      z-index: 1000;
    `;
    document.body.appendChild(subjectSelector);

    for (let classIndex = 0; classIndex < maxClassesPerDay; classIndex++) {
      const row = document.createElement("tr");

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const td = document.createElement("td");
        const dayData = dailyClasses[dayIndex];
        const classData = dayData.classes[classIndex];

        td.textContent = classData ? classData.subject : '';

        td.addEventListener('click', (e) => {
          e.target.style.backgroundColor = '#f0f0f0';
          document.querySelectorAll('#selected-cell').forEach(cell => {
            if (cell !== e.target) {
              cell.style.backgroundColor = '';
              cell.id = '';
            }
          });
          e.target.id = 'selected-cell';

          if (dayData.scheduleIndex === -1) return;

          subjectSelector.innerHTML = '';
          currentData.subjects.forEach(subject => {
            const button = document.createElement('fluent-button');
            button.appearance = 'stealth';
            button.textContent = subject.name;
            button.addEventListener('click', () => {
              const schedule = currentData.schedules[dayData.scheduleIndex];
              const classIndex = schedule.classes.indexOf(classData);
              if (classIndex !== -1) {
                schedule.classes[classIndex].subject = subject.name;
                td.textContent = subject.name;
                storage.save();
              }
              subjectSelector.style.display = 'none';
              e.target.style.backgroundColor = '';
            });
            subjectSelector.appendChild(button);
          });

          const rect = td.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;

          subjectSelector.style.display = 'flex';
          let left = rect.left;
          let top = rect.bottom + 5;

          if (left + 200 > viewportWidth) {
            left = viewportWidth - 200;
          }

          if (top + subjectSelector.offsetHeight > viewportHeight) {
            top = rect.top - subjectSelector.offsetHeight - 5;
          }

          subjectSelector.style.left = Math.max(0, left) + 'px';
          subjectSelector.style.top = Math.max(0, top) + 'px';
          subjectSelector.style.maxWidth = '200px';
        });

        row.appendChild(td);
      }

      tbody.appendChild(row);
    }

    document.addEventListener('click', (e) => {
      if (!subjectSelector.contains(e.target) && !e.target.closest('td')) {
        subjectSelector.style.display = 'none';
        document.querySelectorAll('#selected-cell').forEach(cell => {
          if (cell !== e.target) {
            cell.style.backgroundColor = '';
            cell.id = '';
          }
        });
      }
    });

    table.appendChild(tbody);
    viewtable.appendChild(table);
  },
  quickPanel() {
    const grid = document.querySelector(".subject-grid");
    grid.innerHTML = "";

    currentData.subjects.forEach((s) => {
      const btn = document.createElement("fluent-button");
      btn.appearance = "stealth";
      btn.textContent = s.name;
      btn.addEventListener("click", () => this.setSubject(s.name, true));
      grid.appendChild(btn);
    });
  },
  save() {
    const weekMode = document.getElementById("week-mode").value ?? "all";
    const dayMode = document.getElementById("day-mode").value ?? "1";
    const ParticularDate = document.getElementById("schedule-date").value ?? null;
    const selectedWeekMode = Object.keys(this.weekMap).find(
      (key) => this.weekMap[key] === weekMode
    );
    const selectedDayMode = Object.keys(this.dayMap).find(
      (key) => this.dayMap[key] === dayMode
    );
    if (storage.getOutputMode() == "es") {
      const scheduleName = ParticularDate;
      console.log(scheduleName);
      currentData.schedules[currentScheduleIndex].date = scheduleName;
    } else {
      const scheduleName = `${weekMode.charAt(0).toUpperCase() + weekMode.slice(1)
        }_${this.dayMap_Full[dayMode]}`;
      currentData.schedules[currentScheduleIndex].name = scheduleName;
      currentData.schedules[currentScheduleIndex].enable_day = parseInt(
        dayMode,
        10
      );
      currentData.schedules[currentScheduleIndex].weeks = weekMode;
    }
    storage.save();
    this.init();
  },
  del(index) {
    currentData.schedules[currentScheduleIndex].classes.splice(index, 1);
    storage.save();
    this.refresh();
  },
  add() {
    const newSchedule = {
      name: "无规则计划",
      classes: [],
    };
    currentData.schedules.push(newSchedule);
    storage.save();
    this.init();
  },
  load(index) {
    document.getElementById(`change-editor`).style.display = "none";
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
    // const selectedWeekMode = this.weekMap[weekMode];
    // const selectedDayMode = this.dayMap[dayMode];
    document.getElementById("week-mode").value = weekMode;
    document.getElementById("day-mode").value = `${dayMode}`;
    this.refresh();
    const select = document.getElementById("current-subject");
    select.innerHTML = "";
    currentData.subjects.forEach((s) => {
      const option = document.createElement("fluent-option");
      option.value = s.name;
      option.textContent = s.name;
      select.appendChild(option);
    });
    this.quickPanel();
    const dateSelector = document.getElementById('card-schedule2');
    if (storage.getOutputMode() == "es") {
      dateSelector.style.display = checkDeviceType() ? 'block' : 'flex';
      document.getElementById('schedule-date').value = schedule.date;
      document.getElementById("card-schedule0").style.display = 'none';
      document.getElementById("card-schedule1").style.display = 'none';
    } else {
      dateSelector.style.display = 'none';
      document.getElementById("card-schedule0").style.display = checkDeviceType() ? 'block' : 'flex';
      document.getElementById("card-schedule1").style.display = checkDeviceType() ? 'block' : 'flex';
    }
  },
  refresh() {
    const listbox = document.getElementById("class-list");
    listbox.innerHTML = "";

    currentData.schedules[currentScheduleIndex].classes.forEach((cls, index) => {
      const item = document.createElement("fluent-option");
      item.value = index;
      item.addEventListener("click", () => {
        currentClassIndex = parseInt(index);
        const currentClass =
          currentData.schedules[currentScheduleIndex].classes[currentClassIndex];
        console.log(index);
        document.getElementById("current-subject").value = currentClass.subject;
        document.querySelectorAll(".time-input")[0].value = currentClass.start_time;
        document.querySelectorAll(".time-input")[1].value = currentClass.end_time;
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
  },
  addClass() {
    currentData.schedules[currentScheduleIndex].classes.push({
      subject: document.querySelector('#current-subject').value ?? "",
      start_time: document.querySelectorAll('.time-input')[0].value ?? "",
      end_time: document.querySelectorAll('.time-input')[1].value ?? "",
    });
    currentClassIndex =
      currentData.schedules[currentScheduleIndex].classes.length - 1; // 设置新增课程为当前选中
    storage.save();
    schedule.refresh();
  },
  delClass() {
    if (currentClassIndex === -1) return;

    currentData.schedules[currentScheduleIndex].classes.splice(
      currentClassIndex,
      1
    );
    storage.save();
    schedule.refresh();
    currentClassIndex = -1; // 重置课程索引
  },
  clone() {
    const newSchedule = JSON.parse(
      JSON.stringify(currentData.schedules[currentScheduleIndex])
    );
    newSchedule.name = "无规则计划";
    currentData.schedules.push(newSchedule);
    storage.save();
    this.init();
  },
  fastFillUI() {
    alert(
      `<b>提示:</b> 本功能将会自动填充当前课程表中的所有课程，您可以在下方选择填充的科目。
  <br>
  <fluent-button appearance="accent" onclick="schedule.fastFill()">批量添加通用周星期一~星期日</fluent-button>
  `,
      "快速填充课程表"
    );
  },
  fastFill() {
    const subjects = currentData.subjects;
    if (subjects.length === 0) {
      alert("请先添加科目");
      return;
    }

    const days = ["1", "2", "3", "4", "5", "6", "7"];
    days.forEach((day) => {
      const newSchedule = {
        name: `All_${this.dayMap_Full[day]}`,
        classes: [],
        weeks: "all",
        enable_day: parseInt(day, 10),
      };

      currentData.schedules.push(newSchedule);
    });

    storage.save();
    this.init();
    alert("快速创建周一~周日通用周成功");
  },
  setSubject(subject, autoAdd) {
    if (currentClassIndex === -1) return;
    currentData.schedules[currentScheduleIndex].classes[
      currentClassIndex
    ].subject = subject;
    storage.save();
    schedule.refresh();
    if (autoAdd) {
      const maxIndex =
        currentData.schedules[currentScheduleIndex].classes.length - 1;
      currentClassIndex = Math.min(currentClassIndex + 1, maxIndex);
    }
    document.getElementById("class-list").value = currentClassIndex;
    document.getElementById("current-subject").value = subject;
  },
  setTime() {
    if (currentClassIndex === -1) return;
    currentData.schedules[currentScheduleIndex].classes[
      currentClassIndex
    ].start_time = document.querySelectorAll(".time-input")[0].value;
    currentData.schedules[currentScheduleIndex].classes[
      currentClassIndex
    ].end_time = document.querySelectorAll(".time-input")[1].value;
    storage.save();
    schedule.refresh();
  }
}