function initSubjects() {
  const container = document.getElementById("subject-list");
  container.innerHTML = "";
  if (currentData.subjects.length === 0) {
    currentData.subjects = [
      { name: "语文", simplified_name: "语", teacher: "", room: "" },
      { name: "数学", simplified_name: "数", teacher: "", room: "" },
      { name: "英语", simplified_name: "英", teacher: "", room: "" },
      { name: "物理", simplified_name: "物", teacher: "", room: "" },
      { name: "化学", simplified_name: "化", teacher: "", room: "" },
      { name: "生物", simplified_name: "生", teacher: "", room: "" },
      { name: "历史", simplified_name: "历", teacher: "", room: "" },
      { name: "地理", simplified_name: "地", teacher: "", room: "" },
      { name: "政治", simplified_name: "政", teacher: "", room: "" },
      { name: "信息技术", simplified_name: "信", teacher: "", room: "" },
      { name: "通用技术", simplified_name: "通", teacher: "", room: "" },
      { name: "班会", simplified_name: "班", teacher: "", room: "" },
    ];
    saveSchedule();
  }
  currentData.subjects.forEach((subject, index) => {
    const div = document.createElement("fluent-option");
    div.className = "explorer-item";
    div.textContent = subject.name;
    div.addEventListener("click", () => loadSubject(index));
    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      confirm(
        `确定要删除科目 ${subject.name}吗？`,
        (result, index) => {
          if (result) {
            currentData.subjects.splice(index, 1);
            saveSchedule();
            refreshSubjectList();
          }
        },
        index
      );
    });
    container.appendChild(div);
  });
}

function loadSubject(index) {
  const subject = currentData.subjects[index];
  document.getElementById("subject-name").value = subject.name;
  document.getElementById("subject-simple").value =
    subject.simplified_name || "";
  document.getElementById("subject-teacher").value = subject.teacher || "";
  document.getElementById("subject-room").value = subject.room || "";
  document.getElementById("subject-editor").style.display = "block";
}

function saveSubject() {
  const name = document.getElementById("subject-name").value;
  const simplified_name = document.getElementById("subject-simple").value;
  const room = document.getElementById("subject-room").value;
  const teacher = document.getElementById("subject-teacher").value;
  if (name) {
    let subjectIndex = currentData.subjects.findIndex(
      (subject) => subject.name === name
    );
    if (subjectIndex !== -1) {
      currentData.subjects[subjectIndex].simplified_name = simplified_name;
      currentData.subjects[subjectIndex].room = room;
      currentData.subjects[subjectIndex].teacher = teacher;
    } else {
      currentData.subjects.push({ name, simplified_name, room, teacher });
      subjectIndex = currentData.subjects.length - 1;
    }
    saveSchedule();
    refreshSubjectList();
    document.querySelectorAll(".explorer-item").forEach((item, index) => {
      item.classList.toggle("selected", index === subjectIndex);
    });
  } else {
    alert("请填写完整的科目信息");
  }
}

function addNewSubject() {
  prompt("请输入科目名称:", (name) => {
    if (name) {
      currentData.subjects.push({ name });
      saveSchedule();
      refreshSubjectList();
    }
  });
}

function refreshSubjectList() {
  initSubjects();
}
