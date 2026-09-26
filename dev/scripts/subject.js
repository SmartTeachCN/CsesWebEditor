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
  // 当前正在编辑的科目下标（-1 = 未选中 / 新建）。
  // 保存时按它定位要改写的科目，避免「改名」被当成「新增」。
  currentIndex: -1,
  init(currentIndex) {
    if (typeof currentIndex === "number" && currentIndex >= 0) {
      this.currentIndex = currentIndex;
    }
    const container = document.getElementById("subject-list");
    if (!container) {
      if (currentData.subjects.length === 0) {
        currentData.subjects = this.defaultCourses;
        storage.save();
      }
      return;
    }
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
      if (index === this.currentIndex) {
        div.classList.add("selected");
        div.setAttribute("aria-selected", "true");
        this.load(index);
      }
      div.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        confirm(`确定要删除科目 ${subject.name} 吗？`, (result) => {
          if (!result) return;
          // 按对象标识定位：confirm 回调的 index 参数可能缺失，直接用它有误删第一项的风险
          const byIdentity = currentData.subjects.indexOf(subject);
          const removeAt = byIdentity !== -1 ? byIdentity : index;
          if (removeAt < 0 || removeAt >= currentData.subjects.length) return;
          currentData.subjects.splice(removeAt, 1);
          if (subjects.currentIndex === removeAt) subjects.currentIndex = -1;
          else if (subjects.currentIndex > removeAt) subjects.currentIndex -= 1;
          storage.save();
          try { window.markUnsynced && window.markUnsynced(); } catch {}
          subjects.init();
        });
      });
      container.appendChild(div);
    });
  },
  load(index, push) {
    // 主面板会在这里直接切到编辑器 iframe 并提前返回，
    // 因此下标必须在提前返回之前记录，删除科目时才能修正选中项。
    this.currentIndex = index;
    try {
      const name = currentData?.subjects?.[index]?.name || '';
      if (typeof setEditorSrc === 'function') { setEditorSrc('subject', { sub: 'subject', subject: index, subjectName: name }); return; }
    } catch {}
    try {
      if (push !== false && (window.__unsynced || window.__unsaved)) {
        saveConfirm((res) => {
          if (res === 'save') { try { file.export(false); } catch {} subjects.load(index, false); }
          else if (res === 'discard') { try { window.__unsaved = false; window.__unsynced = false; } catch {} subjects.load(index, false); }
        });
        return;
      }
    } catch {}
    try { const el = document.getElementById('schedule-editor'); if (el) el.style.display = 'none'; } catch {}
    try { const el = document.getElementById('subject-editor'); if (el) el.style.display = 'block'; } catch {}
    try { const el = document.getElementById('source-editor'); if (el) el.style.display = 'none'; } catch {}
    try { const changeEl = document.getElementById('change-editor'); if (changeEl) changeEl.style.display = 'none'; } catch {}
    // 隐藏时间表编辑器（选择科目时）
    const timeEl = document.getElementById('time-editor');
    if (timeEl) timeEl.style.display = 'none';
    if (checkDeviceType()) {
      location.href = "#subject-editor";
      try { const el = document.getElementById('subject-editor'); if (el) el.style.display = 'block'; } catch {}
      try { const el = document.getElementsByClassName("explorer")[0]; if (el) el.style.display = 'none'; } catch {}
      try { const el = document.getElementsByClassName("editor-area")[0]; if (el) el.style.display = 'block'; } catch {}
    }
    try { const tabs = document.getElementById('explorerB'); if (tabs) tabs.setAttribute('activeid', 'subjectB'); } catch {}
    try {
      if (push !== false) {
        const p = new URLSearchParams(window.location.search);
        p.set('view', 'schedule');
        p.set('sub', 'subject');
        const name = currentData?.subjects?.[index]?.name || '';
        if (name) { p.set('subjectName', name); }
        p.delete('schedule');
        p.delete('timetable');
        p.delete('subject');
        p.delete('week');
        history.pushState(null, '', `${location.pathname}?${p.toString()}${location.hash}`);
      }
    } catch {}
    const subject = currentData.subjects[index];
    try { const el = document.getElementById("subject-name"); if (el) el.value = subject?.name || ''; } catch {}
    try { const el = document.getElementById("subject-simple"); if (el) el.value = subject?.simplified_name || ""; } catch {}
    try { const el = document.getElementById("subject-teacher"); if (el) el.value = subject?.teacher || ""; } catch {}
    try { const el = document.getElementById("subject-room"); if (el) el.value = subject?.room || ""; } catch {}
    try { const el = document.getElementById("subject-editor"); if (el) el.style.display = "block"; } catch {}
    // trickAnimation();
  },
  // 科目改名后，课程表里引用旧名称的课时要一起改，否则导出时会出现
  // 「subject 未在 subjects 中定义」的悬空引用。
  renameInSchedules(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return 0;
    let changed = 0;
    try {
      (currentData.schedules || []).forEach((sch) => {
        (sch && sch.classes ? sch.classes : []).forEach((cls) => {
          if (cls && cls.subject === oldName) { cls.subject = newName; changed++; }
        });
      });
    } catch (e) { console.warn('rename subject in schedules failed', e); }
    return changed;
  },
  save() {
    const name = (document.getElementById("subject-name").value || '').trim();
    const simplified_name = document.getElementById("subject-simple").value;
    const room = document.getElementById("subject-room").value;
    const teacher = document.getElementById("subject-teacher").value;
    if (!name) {
      alert("请填写完整的科目信息");
      return;
    }
    const list = currentData.subjects;
    // 优先按「当前编辑项」定位：改名时不能按新名称查找，否则会被当成新增科目
    let subjectIndex = (this.currentIndex >= 0 && this.currentIndex < list.length) ? this.currentIndex : -1;
    if (subjectIndex === -1) subjectIndex = list.findIndex((s) => s && s.name === name);
    // 与其它科目重名时拒绝，避免把两个科目混成一个
    const clash = list.findIndex((s, i) => s && s.name === name && i !== subjectIndex);
    if (clash !== -1) {
      alert(`已存在同名科目「${name}」，请更换名称`);
      return;
    }
    if (subjectIndex !== -1) {
      const target = list[subjectIndex];
      const oldName = target.name;
      target.name = name;
      target.simplified_name = simplified_name;
      target.room = room;
      target.teacher = teacher;
      this.renameInSchedules(oldName, name);
    } else {
      list.push({ name, simplified_name, room, teacher });
      subjectIndex = list.length - 1;
    }
    this.currentIndex = subjectIndex;
    storage.save();
    try { window.markUnsynced && window.markUnsynced(); } catch {}
    subjects.init(subjectIndex);
  },
  add() {
    prompt("请输入科目名称:", (name) => {
      const newName = (name || '').trim();
      if (!newName) return;
      // 已存在同名科目时直接选中它，不再重复新增
      let subjectIndex = currentData.subjects.findIndex((s) => s && s.name === newName);
      if (subjectIndex === -1) {
        currentData.subjects.push({ name: newName, simplified_name: '', teacher: '', room: '' });
        subjectIndex = currentData.subjects.length - 1;
      }
      storage.save();
      try { window.markUnsynced && window.markUnsynced(); } catch {}
      // init(index) 会选中并打开该科目，方便继续补全简称 / 教师 / 教室
      subjects.init(subjectIndex);
    });
  }
} 
try { window.subjects = subjects; } catch {}
