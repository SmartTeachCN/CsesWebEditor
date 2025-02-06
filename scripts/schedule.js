let currentScheduleIndex = -1;

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
                `确定要删除计划 ${weekMap[weekMode] && dayMap[dayMode]
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
    const selectedWeekMode = weekMap[weekMode];
    const selectedDayMode = dayMap[dayMode];
    document.getElementById("week-mode").value = selectedWeekMode;
    document.getElementById("day-mode").value = selectedDayMode;
    refreshClassList();
}

function refreshClassList() {
    const container = document.getElementById("class-list");
    container.innerHTML = "";

    currentData.schedules[currentScheduleIndex].classes.forEach(
        (cls, index) => {
            const card = document.createElement("fluent-card");
            card.className = "class-card";
            card.innerHTML = `
    <select class="subject-select" onchange="saveClass(${index})">
      ${currentData.subjects
                    .map(
                        (s) =>
                            `<option value="${s.name}" ${s.name === cls.subject ? "selected" : ""
                            }>${s.name}</option>`
                    )
                    .join("")}
    </select>
    <input type="time" class="time-input" value="${cls.start_time
                }" onchange="saveClass(${index})">
    <input type="time" class="time-input" value="${cls.end_time
                }" onchange="saveClass(${index})">
    <fluent-button appearance="accent" onclick="deleteClass(${index})">删除</fluent-button>
  `;
            container.appendChild(card);
        }
    );

    // 初始化拖拽排序
    new Sortable(container, {
        animation: 150,
        onEnd: saveSchedule,
    });
}

function saveClass(index) {
    const container = document.getElementById("class-list").children[index];
    const subject = container.querySelector(".subject-select").value;
    const start_time = container.querySelector(".time-input").value;
    const end_time = container.querySelector(".time-input").value;
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
    const weekMode = document.getElementById("week-mode").value;
    const dayMode = document.getElementById("day-mode").value;
    const selectedWeekMode = Object.keys(weekMap).find(
        (key) => weekMap[key] === weekMode
    );
    const selectedDayMode = Object.keys(dayMap).find(
        (key) => dayMap[key] === dayMode
    );
    const scheduleName = `${selectedWeekMode.charAt(0).toUpperCase() + selectedWeekMode.slice(1)
        }_${dayMap_Full[selectedDayMode]}`;
    currentData.schedules[currentScheduleIndex].name = scheduleName;
    currentData.schedules[currentScheduleIndex].enable_day = parseInt(
        selectedDayMode,
        10
    );
    currentData.schedules[currentScheduleIndex].weeks = selectedWeekMode;
    saveSchedule();
    refreshScheduleList();
}

function autoFillClass() {
    alert(`<b>提示:</b> 本功能将会自动填充当前课程表中的所有课程，您可以在下方选择填充的科目。
  <br>
  <fluent-button appearance="accent" onclick="autoFill()">批量添加通用周星期一~星期日</fluent-button>
  `, "快速填充课程表");
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
