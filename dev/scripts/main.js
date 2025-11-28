// 初始化
const version = "2.4";
function init() {
  storage.init();
  activityBar.init();
  const params = new URLSearchParams(window.location.search);
  const v = params.get('view') || 'schedule';
  activityBar.toggle(v, false);
  if (v === 'schedule') {
    applyScheduleSubRoute(params);
  } else if ((v === 'cloud' || v === 'control')) {
    if (window.hasLogin) {
      const tid = params.get('terminal');
      if (tid) {
        try { terminal.load(tid, false); } catch {}
      } else {
        try { terminal.init(); } catch {}
      }
    } else {
      activityBar.toggle('schedule', false);
    }
  }
  storage.initEnv();
  initDragDrop();
  window.addEventListener('popstate', () => {
    const params2 = new URLSearchParams(window.location.search);
    const vv = params2.get('view') || 'schedule';
    activityBar.toggle(vv, false);
    if (vv === 'schedule') {
      applyScheduleSubRoute(params2);
    } else if (vv === 'cloud' || vv === 'control') {
      if (window.hasLogin) {
        const t = params2.get('terminal');
        if (t) { try { terminal.load(t, false); } catch {} }
      }
    }
  });
}

const activityBar = {
  init() {
    document.querySelectorAll(".activity-item").forEach((item) => {
      item.addEventListener("click", () => {
        const go = () => { document.querySelectorAll(".activity-item").forEach((i) => i.classList.remove("selected")); item.classList.add("selected"); document.getElementById("explorerTitle").innerHTML = item.dataset.des; this.toggle(item.dataset.view, true); };
        if (window.__unsynced || window.__unsaved) {
          saveConfirm((res) => {
            if (res === 'save') { try { file.export(false); } catch {} go(); }
            else if (res === 'discard') { try { window.__unsaved = false; window.__unsynced = false; } catch {} go(); }
          });
        } else { go(); }
      });
    });
    document.querySelectorAll("#mobile-bottomBar > button").forEach((item) => {
      item.addEventListener("click", () => {
        const go = () => { document.querySelectorAll("#mobile-bottomBar > button").forEach((i) => i.classList.remove("selected")); item.classList.add("selected"); this.toggle(item.dataset.view, true); document.getElementById("explorerTitle").innerHTML = item.dataset.des; };
        if (window.__unsynced || window.__unsaved) {
          saveConfirm((res) => {
            if (res === 'save') { try { file.export(false); } catch {} go(); }
            else if (res === 'discard') { try { window.__unsaved = false; window.__unsynced = false; } catch {} go(); }
          });
        } else { go(); }
      });
    });
  },
  toggle(view, push) {
    const titleMap = { schedule: '档案管理', source: '文件预览', cloud: '实例管理', control: '集控配置' };
    const titleEl = document.getElementById('explorerTitle');
    if (titleEl) titleEl.innerHTML = titleMap[view] || titleEl.innerHTML;
    try {
      document.querySelectorAll('.activity-item').forEach(i => i.classList.remove('selected'));
      const act = Array.from(document.querySelectorAll('.activity-item')).find(i => i.dataset.view === view);
      if (act) act.classList.add('selected');
      document.querySelectorAll('#mobile-bottomBar > button').forEach(i => i.classList.remove('selected'));
      const mob = Array.from(document.querySelectorAll('#mobile-bottomBar > button')).find(i => i.dataset.view === view);
      if (mob) mob.classList.add('selected');
    } catch {}
    const __ef = document.getElementById('editor-frame');
    document.getElementsByClassName("explorer")[0].style.display = "block";
    document.getElementsByClassName(`editor-area`)[0].style.borderRadius = "0px";
    if (view === "schedule") {
      document.getElementById("explorerB").style.display = "block";
      document.getElementById("cloud-list").style.display = "none";
      document.getElementsByClassName("explorer")[0].style.display = "block";
      document.getElementsByClassName("editor-area")[0].style.display = "block";
      if (__ef) { loadEditor('schedule'); }
      try {
        if (!window.__scheduleInitialized) { schedule.init(); window.__scheduleInitialized = true; }
        if (!window.__subjectsInitialized) { subjects.init(); window.__subjectsInitialized = true; }
        const params = new URLSearchParams(window.location.search);
        applyScheduleSubRoute(params);
      } catch {}
    } else if (view === "source") {
      document.getElementById("explorerB").style.display = "none";
      document.getElementById("cloud-list").style.display = "none";
      document.getElementsByClassName("explorer")[0].style.display = "none";
      if (__ef) { document.getElementsByClassName("editor-area")[0].style.display = "block"; loadEditor('source'); }
      document.getElementsByClassName(`editor-area`)[0].style.borderRadius = "10px 0px 0px 0px";
      if (checkDeviceType()) {
        location.href = "#";
        document.getElementsByClassName("editor-area")[0].style.display = "block";
      }
      console.log("source" + localStorage.getItem("output-mode"));
      try {
        const tid = new URLSearchParams(window.location.search).get('terminal');
        if (tid && (window.hasLogin ?? false)) { try { terminal.load(tid, false); } catch {} }
      } catch {}
    } else if (view === "cloud") {
      if (!(window.hasLogin ?? false)) {
        this.toggle("schedule");
        return;
      }
      document.getElementById("explorerB").style.display = "none";
      document.getElementById("cloud-list").style.display = "block";
      document.getElementsByClassName("editor-area")[0].style.display = "block";
      if (__ef) { loadEditor('cloud'); }
      try {
        const select = document.getElementById('cloud-list');
        if (select && select.children.length === 0 && typeof terminal !== 'undefined') terminal.init();
      } catch {}
      try {
        const t = new URLSearchParams(window.location.search).get('terminal');
        if (t && typeof terminal !== 'undefined') terminal.load(t, false);
      } catch {}
    } else if (view === "control") {
      if (!(window.hasLogin ?? false)) {
        this.toggle("schedule");
        return;
      }
      document.getElementsByClassName(`editor-area`)[0].style.borderRadius = "10px 0px 0px 0px";
      document.getElementById("explorerB").style.display = "none";
      document.getElementById("cloud-list").style.display = "none";
      document.getElementsByClassName("explorer")[0].style.display = "none";
      if (__ef) { document.getElementsByClassName("editor-area")[0].style.display = "block"; loadEditor('control'); }
      try {
        const t = new URLSearchParams(window.location.search).get('terminal');
        if (t && typeof terminal !== 'undefined') terminal.load(t, false);
      } catch {}
      if (
        localStorage.getItem("output-mode") == "cy" ||
        localStorage.getItem("output-mode") == undefined
      ) {
      } else if (localStorage.getItem("output-mode") == "cj") {
      } else if (localStorage.getItem("output-mode") == "ci") {
      }
      if (checkDeviceType()) {
        location.href = "#";
        document.getElementsByClassName("editor-area")[0].style.display = "block";
      }
      try {
        const need = localStorage.getItem('control_need_refresh');
        if (need === '1') {
          const win = document.getElementById('editor-frame')?.contentWindow;
          if (win && win.controlMgr) { win.controlMgr.init(true); }
          localStorage.removeItem('control_need_refresh');
        }
      } catch {}
    }
    if (push) {
      const p = new URLSearchParams(window.location.search);
      p.set('view', view);
      if (view === 'schedule') {
        const sub = p.get('sub');
        if (sub === 'subject') {
          // 仅保留 subjectName 与 sub
          const name = p.get('subjectName');
          p.delete('schedule');
          p.delete('timetable');
          p.delete('subject');
          p.delete('week');
          if (!name) p.delete('subjectName');
        } else if (sub === 'schedule') {
          // 仅保留 schedule 与 sub
          const sch = p.get('schedule');
          p.delete('subject');
          p.delete('subjectName');
          p.delete('timetable');
          p.delete('week');
          if (!sch) p.delete('schedule');
        } else if (sub === 'timetable') {
          // 仅保留 timetable 与 sub
          const tt = p.get('timetable');
          p.delete('subject');
          p.delete('subjectName');
          p.delete('schedule');
          p.delete('week');
          if (!tt) p.delete('timetable');
        } else if (sub === 'table') {
          // 表格视图保留 schedule 以减少参数
          const sch = p.get('schedule');
          p.delete('subject');
          p.delete('subjectName');
          p.delete('timetable');
          // 保留 week
          if (!sch) p.set('schedule', '0');
        } else {
          // 未声明 sub 时，按最小集归一
          const name = p.get('subjectName');
          const sch = p.get('schedule');
          const tt = p.get('timetable');
          if (name) { p.set('sub', 'subject'); p.delete('schedule'); p.delete('timetable'); p.delete('subject'); }
          else if (tt) { p.set('sub', 'timetable'); p.delete('schedule'); p.delete('subject'); p.delete('subjectName'); }
          else if (sch) { p.set('sub', 'schedule'); p.delete('subject'); p.delete('subjectName'); p.delete('timetable'); }
        }
      } else if (view === 'source') {
        p.delete('schedule');
        p.delete('subject'); p.delete('subjectName');
        p.delete('timetable');
        p.delete('sub');
        p.delete('week');
      } else if (view === 'cloud' || view === 'control') {
        p.delete('schedule');
        p.delete('subject'); p.delete('subjectName');
        p.delete('timetable');
        p.delete('sub');
        p.delete('week');
      }
      history.pushState(null, '', `${location.pathname}?${p.toString()}${location.hash}`);
    }
  }
}

function loadEditor(view, params) {
  try {
    const iframe = document.getElementById('editor-frame');
    if (!iframe) return;
    let url = `dev/pages/editor/${view}.html`;
    if (params && typeof params === 'object') {
      const p = new URLSearchParams();
      Object.keys(params).forEach(k=>{ if (params[k] !== undefined && params[k] !== null) p.set(k, String(params[k])); });
      url = `${url}?${p.toString()}`;
    }
    iframe.src = url;
  } catch {}
}

function setEditorSrc(view, params){ try { loadEditor(view, params); } catch {} }

function callEditor(view, apiPath, args) {
  try {
    const iframe = document.getElementById('editor-frame');
    if (!iframe) return;
    // 确保已加载对应页面
    loadEditor(view);
    let tries = 0;
    const tryInvoke = () => {
      try {
        const win = iframe.contentWindow;
        let obj = win;
        const parts = apiPath.split('.');
        for (let i = 0; i < parts.length; i++) { obj = obj && obj[parts[i]]; }
        if (typeof obj === 'function') { obj.apply(win, args || []); return; }
      } catch {}
      if (tries++ < 20) setTimeout(tryInvoke, 100);
    };
    tryInvoke();
  } catch {}
}

function applyScheduleSubRoute(params) {
  const sub = params.get('sub');
  const subjectName = params.get('subjectName');
  const subjIdxRaw = parseInt(params.get('subject'));
  const subjIdx = !isNaN(subjIdxRaw) ? subjIdxRaw : (subjectName ? (currentData.subjects || []).findIndex(s=> s.name === subjectName) : NaN);
  const schIdx = parseInt(params.get('schedule'));
  const tName = params.get('timetable');
  const week = params.get('week');
  if (sub === 'subject') {
    if (!isNaN(subjIdx)) { subjects.load(subjIdx, false); try { const tabs = document.getElementById('explorerB'); if (tabs) tabs.setAttribute('activeid', 'subjectB'); } catch {} }
    return;
  }
  if (sub === 'schedule') {
    if (!isNaN(schIdx)) { schedule.load(schIdx, false); try { const tabs = document.getElementById('explorerB'); if (tabs) tabs.setAttribute('activeid', 'scheduleB'); } catch {} }
    return;
  }
  if (sub === 'timetable') {
    if (tName) { schedule.showTimeEditor(tName, false); try { const tabs = document.getElementById('explorerB'); if (tabs) tabs.setAttribute('activeid', 'timeB'); } catch {} }
    return;
  }
  if (sub === 'table') {
    try {
      if (week) schedule.setWeekView(week, false);
      schedule.openTableView(false);
    } catch {}
    return;
  }
  // 兼容旧参数
  if (!isNaN(subjIdx)) { subjects.load(subjIdx, false); try { const tabs = document.getElementById('explorerB'); if (tabs) tabs.setAttribute('activeid', 'subjectB'); } catch {} return; }
  if (!isNaN(schIdx)) { schedule.load(schIdx, false); try { const tabs = document.getElementById('explorerB'); if (tabs) tabs.setAttribute('activeid', 'scheduleB'); } catch {} return; }
  if (tName) { schedule.showTimeEditor(tName, false); try { const tabs = document.getElementById('explorerB'); if (tabs) tabs.setAttribute('activeid', 'timeB'); } catch {} return; }
}

// 文本成员路径

init();
