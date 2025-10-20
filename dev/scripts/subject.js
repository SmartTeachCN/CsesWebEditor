const subjects = {
  defaultCourses: [
    { name: "语文", simplified_name: "语", teacher: "", room: "" },
    { name: "数学", simplified_name: "数", teacher: "", room: "" },
    { name: "英语", simplified_name: "英", teacher: "", room: "" },
    { name: "物理", simplified_name: "物", teacher: "", room: "" },
    { name: "化学", simplified_name: "化", teacher: "", room: "" },
    { name: "生物", simplified_name: "生", teacher: "", room: "" },
    { name: "历史", simplified_name: "历", teacher: "", room: "" },
    { name: "地理", simplified_name: "地", teacher: "", room: "" },
    { name: "政治", simplified_name: "政", teacher: "", room: "" },
    { name: "体育", simplified_name: "体", teacher: "", room: "" },
    { name: "早读", simplified_name: "早", teacher: "", room: "" },
    { name: "晚读", simplified_name: "晚", teacher: "", room: "" },
    { name: "听力", simplified_name: "听", teacher: "", room: "" },
    { name: "美术", simplified_name: "美", teacher: "", room: "" },
    { name: "音乐", simplified_name: "音", teacher: "", room: "" },
    { name: "信息技术", simplified_name: "信", teacher: "", room: "" },
    { name: "通用技术", simplified_name: "通", teacher: "", room: "" },
    { name: "班会", simplified_name: "班", teacher: "", room: "" },
  ],
  init(currentIndex) {
    const container = document.getElementById("subject-list");
    if (currentData.subjects.length === 0) {
      currentData.subjects = this.defaultCourses;
      storage.save();
      subjects.init();
      return;
    }
    container.innerHTML = "";
    currentData.subjects.forEach((subject, index) => {
      const div = document.createElement("fluent-option");
      div.className = "explorer-item";
      div.innerHTML = `<i class="bi bi-bookmark-dash"></i>&nbsp;` + subject.name;
      div.addEventListener("click", () => {
        document
          .querySelectorAll(".explorer-item")
          .forEach((item) => item.classList.remove("selected"));
        div.classList.add("selected");
        this.load(index);
      });
      if (index === currentIndex) {
        div.classList.add("selected");
        div.setAttribute("aria-selected", "true");
        this.load(index);
      }
      div.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        confirm(
          `确定要删除科目 ${subject.name} 吗？`,
          (result, index) => {
            if (result) {
              currentData.subjects.splice(index, 1);
              subjects.init();
            }
          },
          index
        );
      });
      container.appendChild(div);
    });
  },
  load(index) {
    document.getElementById(`schedule-editor`).style.display = "none";
    document.getElementById(`subject-editor`).style.display = "block";
    document.getElementById(`source-editor`).style.display = "none";
    // 隐藏时间表编辑器（选择科目时）
    const timeEl = document.getElementById('time-editor');
    if (timeEl) timeEl.style.display = 'none';
    if (checkDeviceType()) {
      location.href = "#subject-editor";
      document.getElementById("subject-editor").style.display = "block";
      document.getElementsByClassName("explorer")[0].style.display = "none";
      document.getElementsByClassName("editor-area")[0].style.display = "block";
    }
    const subject = currentData.subjects[index];
    document.getElementById("subject-name").value = subject.name;
    document.getElementById("subject-simple").value =
      subject.simplified_name || "";
    document.getElementById("subject-teacher").value = subject.teacher || "";
    document.getElementById("subject-room").value = subject.room || "";
    document.getElementById("subject-editor").style.display = "block";
    // trickAnimation();
  },
  save() {
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
      storage.save();
      subjects.init(subjectIndex);
    } else {
      alert("请填写完整的科目信息");
    }
  },
  add() {
    prompt("请输入科目名称:", (name) => {
      if (name) {
        currentData.subjects.push({ name });
        subjects.init();
      }
    });
  }
}
