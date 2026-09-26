let currentScheduleIndex = -1;
let currentClassIndex = -1;
let timeEditorCollapsed = true;
const TIMETABLE_LOCAL_KEY = 'cses_timetable_state';
let timetableState = (() => {
  try { return JSON.parse(localStorage.getItem(TIMETABLE_LOCAL_KEY)) || { schedules: {} }; } catch { return { schedules: {} }; }
})();
const TIMETABLE_CUSTOM_KEY = 'cses_timetable_templates';
let customTimetables = (() => {
  try {
    const d = JSON.parse(localStorage.getItem(TIMETABLE_CUSTOM_KEY));
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.templates)) return d.templates;
    return [];
  } catch {
    return [];
  }
})();

/* ---------- CSES 格式辅助：时间统一 HH:MM:SS、enable_day 统一数组 ---------- */
function csesTime(value) {
  try { if (window.cses) return window.cses.normalizeTime(value); } catch {}
  return (value === undefined || value === null) ? '' : String(value);
}
function csesDays(value) {
  try { if (window.cses) return window.cses.normalizeEnableDay(value); } catch {}
  const arr = Array.isArray(value) ? value : (value === undefined || value === null || value === '' ? [] : [value]);
  return arr.map((x) => parseInt(x, 10)).filter((n) => n >= 1 && n <= 7);
}
function csesTimeToMinutes(value) {
  try { if (window.cses) return window.cses.timeToMinutes(value); } catch {}
  const m = /^(\d{1,2}):(\d{1,2})/.exec(String(value || ''));
  return m ? (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) : null;
}
function csesMinutesToTime(mins) {
  try { if (window.cses) return window.cses.minutesToTime(mins); } catch {}
  const total = ((Math.round(mins) % 1440) + 1440) % 1440;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 60))}:${p(total % 60)}:00`;
}

function saveCustomTimetables(){
  try { localStorage.setItem(TIMETABLE_CUSTOM_KEY, JSON.stringify(customTimetables)); } catch {}
  try {
    // 同步到导出数据结构：times 使用包含 starttime/endtime 的对象，时间统一 HH:MM:SS
    const toExport = customTimetables.map(t => {
      const key = (t.key || t.name || '').trim();
      const timesObj = Array.isArray(t.times) ? t.times.map(([s,e]) => ({ starttime: csesTime(s), endtime: csesTime(e) })) : [];
      return { name: t.name, times: timesObj };
    });
    currentData.timetables = toExport;
    storage.save();
  } catch (e) {
    console.warn('Failed to sync timetables to currentData', e);
  }
}
const timetableTemplates = [
  { name: '标准8节', times: [
      ['08:00:00','08:45:00'], ['08:55:00','09:40:00'], ['10:00:00','10:45:00'], ['10:55:00','11:40:00'],
      ['13:30:00','14:15:00'], ['14:25:00','15:10:00'], ['15:30:00','16:15:00'], ['16:25:00','17:10:00'],
  ]},
  { name: '标准10节', times: [
      ['08:00:00','08:45:00'], ['08:55:00','09:40:00'], ['10:00:00','10:45:00'], ['10:55:00','11:40:00'],
      ['13:00:00','13:45:00'], ['13:55:00','14:40:00'], ['14:50:00','15:35:00'], ['15:45:00','16:30:00'], ['18:30:00','19:15:00'], ['19:25:00','20:10:00'],
  ]},
];
function saveTimetableState(){ try{ localStorage.setItem(TIMETABLE_LOCAL_KEY, JSON.stringify(timetableState)); }catch{} }
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
  currentTimetableName: null,
  // 课表的可读标签（兼容 CSES v1 单双周 + 单日 / v2 多启用日）
  scheduleLabel(sch, index) {
    if (!sch) return '';
    if (storage.getOutputMode() === 'es') {
      return sch.date ? sch.date : `未设定日期 ${(index ?? 0) + 1}`;
    }
    const days = csesDays(sch.enable_day);
    if (storage.getCsesVersion() === 2) {
      const names = days.map((d) => this.dayMap[d]).filter(Boolean);
      return names.length ? names.join('、') : '';
    }
    const weekMode = sch.weeks;
    const dayMode = days[0];
    if (this.weekMap[weekMode] && this.dayMap[dayMode]) {
      return `${this.weekMap[weekMode]}_${this.dayMap[dayMode]}`;
    }
    return '';
  },
  // CSES v1 自动命名的形式：All_Monday / Odd_Monday / Even_Monday
  isAutoScheduleName(name) {
    if (!name) return true;
    if (name === '无规则计划' || name === '未命名课表') return true;
    return /^(All|Odd|Even)_(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(name);
  },
  autoScheduleName(days, weeks) {
    const cn = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const list = csesDays(days).map((d) => cn[d - 1]).filter(Boolean);
    const base = list.length ? `${list.join('、')}课表` : '课表';
    if (weeks === 'odd') return `${base}（单周）`;
    if (weeks === 'even') return `${base}（双周）`;
    return base;
  },
  // 按输出模式与 CSES 版本切换设置卡片
  applyVersionUI() {
    const isES = storage.getOutputMode() === 'es';
    const v = storage.getCsesVersion();
    const single = document.getElementById('card-schedule0');
    const weeksCard = document.getElementById('card-schedule1');
    const daysCard = document.getElementById('card-schedule-days');
    const dateCard = document.getElementById('card-schedule2');
    const flexOrBlock = () => (checkDeviceType() ? 'block' : 'flex');
    if (isES) {
      if (single) single.style.display = 'none';
      if (weeksCard) weeksCard.style.display = 'none';
      if (daysCard) daysCard.style.display = 'none';
      if (dateCard) dateCard.style.display = flexOrBlock();
      return;
    }
    if (dateCard) dateCard.style.display = 'none';
    if (v === 2) {
      if (single) single.style.display = 'none';
      if (weeksCard) weeksCard.style.display = 'none';
      if (daysCard) daysCard.style.display = flexOrBlock();
    } else {
      if (daysCard) daysCard.style.display = 'none';
      if (single) single.style.display = flexOrBlock();
      if (weeksCard) weeksCard.style.display = flexOrBlock();
    }
  },
  // CSES v2：启用日多选
  renderDayChips() {
    const box = document.getElementById('day-mode-multi');
    if (!box) return;
    const sch = currentData.schedules[currentScheduleIndex];
    const selected = csesDays(sch && sch.enable_day);
    box.innerHTML = '';
    [1, 2, 3, 4, 5, 6, 7].forEach((d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day-chip' + (selected.indexOf(d) !== -1 ? ' selected' : '');
      btn.dataset.day = String(d);
      btn.textContent = this.dayMap[d];
      btn.addEventListener('click', () => this.toggleDay(d));
      box.appendChild(btn);
    });
  },
  toggleDay(day) {
    const sch = currentData.schedules[currentScheduleIndex];
    if (!sch) return;
    let days = csesDays(sch.enable_day);
    const i = days.indexOf(day);
    if (i === -1) days.push(day);
    else if (days.length > 1) days.splice(i, 1);
    days.sort((a, b) => a - b);
    if (!days.length) days = [day];
    sch.enable_day = days;
    const weeks = storage.getCsesVersion() === 2 ? 'all' : sch.weeks;
    if (this.isAutoScheduleName(sch.name)) sch.name = this.autoScheduleName(days, weeks);
    storage.save();
    try { window.markUnsynced && window.markUnsynced(); } catch {}
    this.renderDayChips();
    this.init();
  },
  openDocEditor(push) {
    try {
      if (typeof setEditorSrc === 'function') { setEditorSrc('doc', { sub: 'doc' }); return; }
    } catch {}
    try { const el = document.getElementById('schedule-editor'); if (el) el.style.display = 'none'; } catch {}
    try { const el = document.getElementById('doc-editor'); if (el) el.style.display = 'block'; } catch {}
  },
  init() {
    // 同步时间表模板到 currentData 并从 currentData 载入
    try {
      if (Array.isArray(currentData?.timetables) && currentData.timetables.length > 0) {
        // 从导出结构（对象形式的 times）恢复为编辑器内部使用的数组形式
        customTimetables = currentData.timetables.map(t => {
          const timesArr = Array.isArray(t.times) ? t.times.map(it => {
            if (Array.isArray(it)) return [csesTime(it[0]), csesTime(it[1])];
            const s = (it && it.starttime) ? csesTime(it.starttime) : '';
            const e = (it && it.endtime) ? csesTime(it.endtime) : '';
            return [s, e];
          }) : [];
          return { key: t.key || t.name, name: t.name, times: timesArr };
        });
        localStorage.setItem(TIMETABLE_CUSTOM_KEY, JSON.stringify(customTimetables));
      } else if (Array.isArray(customTimetables) && customTimetables.length > 0) {
        // 将编辑器内部数组形式转换为导出结构（对象形式的 times）
        currentData.timetables = customTimetables.map(t => ({
          name: t.name,
          times: (t.times || []).map(([s,e]) => ({ starttime: s, endtime: e }))
        }));
        storage.save();
      }
    } catch (e) { console.warn('sync timetables on init failed', e); }
    const container = document.getElementById("schedule-list");
    if (!container) {
      try {
        if (Array.isArray(currentData.schedules) && currentData.schedules.length > 0 && (typeof currentScheduleIndex !== 'number' || currentScheduleIndex < 0)) {
          currentScheduleIndex = 0;
        }
        this.renderTimetableList();
        this.loadTimetableOptions();
        this.updateTimetableLabel();
      } catch {}
      return;
    }
    container.innerHTML = "";
    if (storage.getOutputMode() == "es") { } else {
      const div = document.createElement("fluent-option");
      div.className = "explorer-item";
      div.innerHTML = `<i class="bi bi-table"></i> 表格视图`;
      div.addEventListener("click", () => {
        schedule.openTableView(true);
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
      // 使用flex以便右侧显示标签
      div.style.display = 'flex';
      div.style.width = '100%';
      div.style.alignItems = 'center';
      const plain = this.scheduleLabel(schedule2, index);
      const leftLabel = plain
        ? `<i class="bi bi-calendar3-week"></i>&nbsp;${plain}`
        : `<i class="bi bi-calendar3-week"></i>&nbsp;无规则计划 ${index + 1}`;
      const st = timetableState?.schedules?.[index];
      const tagText = (st && st.templateName && st.templateName !== '' && st.templateName !== '未选择')
        ? `${st.modified ? '*' : ''}${st.templateName}` : '';
      div.innerHTML = tagText
        ? `${leftLabel}<span class="schedule-timetable-tag" style="margin-left:auto;color:#666;">&nbsp;${tagText}</span>`
        : leftLabel;
      div.addEventListener("click", () => {
        this.load(index);
        document
          .querySelectorAll(".explorer-item")
          .forEach((item) => item.classList.remove("selected"));
        div.classList.add("selected");
      });
      div.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const label = this.scheduleLabel(schedule2, index) || `无规则计划 ${index + 1}`;
        confirm(
          `确定要删除计划 ${label} 吗？`,
          (result, idx) => {
            if (result) {
              currentData.schedules.splice(idx, 1);
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
    // 保证时间表列表与下拉选择在初始化后已加载
    this.renderTimetableList();
    this.loadTimetableOptions();
    this.updateTimetableLabel();
  },
  openTableView(push) {
    try {
      if (typeof setEditorSrc === 'function') {
        const idx = (typeof currentScheduleIndex === 'number' && currentScheduleIndex >= 0) ? currentScheduleIndex : 0;
        setEditorSrc('change', { sub: 'table', schedule: idx, week: this.viewMode || 'odd' });
        return;
      }
    } catch {}
    try {
      if (push !== false && (window.__unsynced || window.__unsaved)) {
        saveConfirm((res) => {
          if (res === 'save') { try { file.export(false); } catch {} schedule.openTableView(false); }
          else if (res === 'discard') { schedule.openTableView(false); }
        });
        return;
      }
    } catch {}
    try { const el = document.getElementById('change-editor'); if (el) el.style.display = 'block'; } catch {}
    try { const el = document.getElementById('schedule-editor'); if (el) el.style.display = 'none'; } catch {}
    try { const el = document.getElementById('subject-editor'); if (el) el.style.display = 'none'; } catch {}
    try { const el = document.getElementById('source-editor'); if (el) el.style.display = 'none'; } catch {}
    const timeEl = document.getElementById('time-editor');
    if (timeEl) timeEl.style.display = 'none';
    if (checkDeviceType()) {
      location.href = "#schedule-editor";
      try { const el = document.getElementById('change-editor'); if (el) el.style.display = 'block'; } catch {}
      try { const el = document.getElementsByClassName("explorer")[0]; if (el) el.style.display = 'none'; } catch {}
      try { const el = document.getElementsByClassName("editor-area")[0]; if (el) el.style.display = 'block'; } catch {}
    }
    try {
      if (push !== false) {
        const p = new URLSearchParams(window.location.search);
        p.set('view', 'schedule');
        p.set('sub', 'table');
        const idx = (typeof currentScheduleIndex === 'number' && currentScheduleIndex >= 0) ? currentScheduleIndex : 0;
        p.set('schedule', String(idx));
        p.set('week', this.viewMode || 'odd');
        p.delete('subject'); p.delete('subjectName');
        p.delete('timetable');
        history.pushState(null, '', `${location.pathname}?${p.toString()}${location.hash}`);
      }
    } catch {}
    this.view(this.viewMode);
  },
  setWeekView(mode, push) {
    try {
      this.viewMode = (mode === 'even' || mode === 'all') ? mode : 'odd';
      if (typeof setEditorSrc === 'function') {
        const idx = (typeof currentScheduleIndex === 'number' && currentScheduleIndex >= 0) ? currentScheduleIndex : 0;
        setEditorSrc('change', { sub: 'table', schedule: idx, week: this.viewMode });
        return;
      }
    } catch {}
    const m = (mode === 'even' || mode === 'all') ? mode : 'odd';
    this.viewMode = m;
    this.view(m);
    try {
      if (push !== false) {
        const p = new URLSearchParams(window.location.search);
        p.set('view', 'schedule');
        p.set('sub', 'table');
        const idx = (typeof currentScheduleIndex === 'number' && currentScheduleIndex >= 0) ? currentScheduleIndex : 0;
        p.set('schedule', String(idx));
        p.set('week', m);
        p.delete('subject'); p.delete('subjectName');
        p.delete('timetable');
        history.pushState(null, '', `${location.pathname}?${p.toString()}${location.hash}`);
      }
    } catch {}
  },
  viewMode: "odd",
  view(viewMode = 'odd') {
    this.viewMode = viewMode;
    try { const sel = document.getElementById('table-week-select'); if (sel) sel.value = viewMode; } catch {}
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
        .filter(s => csesDays(s.enable_day).indexOf(dayIndex + 1) !== -1)
        .filter(schedule => {
          if (storage.getCsesVersion() === 2) return true; // CSES v2 无单双周概念
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

    const hasMatch = dailyClasses.some(dc => dc.scheduleIndex !== -1);
    if (!hasMatch) {
      const tip = document.createElement('div');
      tip.style.cssText = 'padding:8px;color:#666';
      tip.textContent = '当前周型下未找到匹配的课程表';
      viewtable.appendChild(tip);
    }

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

        td.textContent = classData ? classData.subject : (dayData.scheduleIndex === -1 ? '无匹配' : '');
        if (dayData.scheduleIndex === -1) { td.style.color = '#999'; }

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
    const weekEl = document.getElementById("week-mode");
    const dayEl = document.getElementById("day-mode");
    const weekMode = (weekEl && weekEl.value) ? weekEl.value : "all";
    const dayMode = (dayEl && dayEl.value) ? dayEl.value : "1";
    const ParticularDate = document.getElementById("schedule-date")?.value ?? null;
    const sch = currentData.schedules[currentScheduleIndex];
    if (!sch) return;
    if (storage.getOutputMode() == "es") {
      console.log(ParticularDate);
      sch.date = ParticularDate;
    } else if (storage.getCsesVersion() === 2) {
      // CSES v2：enable_day 为数组，无 weeks 字段
      const days = csesDays(sch.enable_day);
      sch.enable_day = days.length ? days : [1];
      sch.weeks = 'all';
      if (this.isAutoScheduleName(sch.name)) sch.name = this.autoScheduleName(sch.enable_day, sch.weeks);
    } else {
      const scheduleName = `${weekMode.charAt(0).toUpperCase() + weekMode.slice(1)
        }_${this.dayMap_Full[dayMode]}`;
      sch.name = scheduleName;
      sch.enable_day = [parseInt(dayMode, 10) || 1];
      sch.weeks = weekMode;
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
      weeks: "all",
      enable_day: [1],
    };
    if (storage.getCsesVersion() === 2) newSchedule.name = this.autoScheduleName([1], 'all');
    currentData.schedules.push(newSchedule);
    storage.save();
    this.init();
  },
  load(index, push) {
    try {
      currentScheduleIndex = index;
      if (typeof setEditorSrc === 'function') { setEditorSrc('schedule', { sub: 'schedule', schedule: index }); return; }
    } catch {}
    try {
      if (push !== false && (window.__unsynced || window.__unsaved)) {
        saveConfirm((res) => {
          if (res === 'save') { try { file.export(false); } catch {} schedule.load(index, false); }
          else if (res === 'discard') { try { window.__unsaved = false; window.__unsynced = false; } catch {} schedule.load(index, false); }
        });
        return;
      }
    } catch {}
    try { const el = document.getElementById('change-editor'); if (el) el.style.display = 'none'; } catch {}
    try { const el = document.getElementById('schedule-editor'); if (el) el.style.display = 'block'; } catch {}
    try { const el = document.getElementById('subject-editor'); if (el) el.style.display = 'none'; } catch {}
    try { const el = document.getElementById('source-editor'); if (el) el.style.display = 'none'; } catch {}
    // 隐藏时间表编辑器（选择课程表时）
    const timeEl2 = document.getElementById('time-editor');
    if (timeEl2) timeEl2.style.display = 'none';
    if (checkDeviceType()) {
      location.href = "#schedule-editor";
      try { const el = document.getElementById('schedule-editor'); if (el) el.style.display = 'block'; } catch {}
      try { const el = document.getElementsByClassName("explorer")[0]; if (el) el.style.display = 'none'; } catch {}
      try { const el = document.getElementsByClassName("editor-area")[0]; if (el) el.style.display = 'block'; } catch {}
    }
    try { const tabs = document.getElementById('explorerB'); if (tabs) tabs.setAttribute('activeid', 'scheduleB'); } catch {}
    currentScheduleIndex = index;
    try {
      if (push !== false) {
        const p = new URLSearchParams(window.location.search);
        p.set('view', 'schedule');
        p.set('sub', 'schedule');
        p.set('schedule', index);
        p.delete('subject'); p.delete('subjectName');
        p.delete('timetable');
        history.pushState(null, '', `${location.pathname}?${p.toString()}${location.hash}`);
      }
    } catch {}
    try {
      const container = document.getElementById('schedule-list');
      if (container) {
        Array.from(container.querySelectorAll('.explorer-item')).forEach((el) => {
          el.classList.remove('selected');
          el.removeAttribute('aria-selected');
        });
        const isES = storage.getOutputMode() === 'es';
        const childIndex = isES ? index : index + 1; // 非ES模式首项为表格视图
        const item = container.children[childIndex];
        if (item) { item.classList.add('selected'); item.setAttribute('aria-selected', 'true'); }
      }
    } catch {}
    try { const el = document.getElementById('schedule-editor'); if (el) el.style.display = 'block'; } catch {}
    const schedule = currentData.schedules[index];
    const weekMode = schedule.weeks;
    const days = csesDays(schedule.enable_day);
    try { const wm = document.getElementById("week-mode"); if (wm) wm.value = weekMode; } catch {}
    try { const dm = document.getElementById("day-mode"); if (dm) dm.value = `${days[0] || 1}`; } catch {}
    try { const dateInput = document.getElementById('schedule-date'); if (dateInput) dateInput.value = schedule.date || ''; } catch {}
    this.renderDayChips();
    this.applyVersionUI();
    this.refresh();
    const select = document.getElementById("current-subject");
    select.innerHTML = "";
    currentData.subjects.forEach((s) => {
      const option = document.createElement("fluent-option");
      option.value = s.name;
      option.textContent = s.name;
      select.appendChild(option);
    });
    this.ensureTimeEditorCollapsedDefault();
    this.loadTimetableOptions();
    this.updateTimetableLabel();
    this.quickPanel();
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
        document.querySelectorAll(".time-input")[0].value = csesTime(currentClass.start_time);
        document.querySelectorAll(".time-input")[1].value = csesTime(currentClass.end_time);
      });
      item.textContent = `${cls.subject} (${csesTime(cls.start_time)}-${csesTime(cls.end_time)})`;
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
    const sch = currentData.schedules[currentScheduleIndex];
    const inputs = document.querySelectorAll('.time-input');
    // 时间统一 HH:MM:SS；输入控件没有给出有效值时按上一节课推算，避免写入空时间
    const prev = (sch.classes && sch.classes.length) ? sch.classes[sch.classes.length - 1] : null;
    const fallbackStart = (prev && csesTime(prev.end_time)) || '08:00:00';
    const start = csesTime(inputs[0] && inputs[0].value) || fallbackStart;
    const end = csesTime(inputs[1] && inputs[1].value) || csesMinutesToTime((csesTimeToMinutes(start) || 480) + 45);
    sch.classes.push({
      subject: document.querySelector('#current-subject').value ?? "",
      start_time: start,
      end_time: end,
    });
    currentClassIndex = sch.classes.length - 1;
    try {
      if (inputs[0]) inputs[0].value = start;
      if (inputs[1]) inputs[1].value = end;
    } catch {}
    storage.save();
    try { window.markUnsynced && window.markUnsynced(); } catch {}
    schedule.refresh();
    // 标记时间表已更改（新增课时视为课时编辑器变更）
    const st = timetableState.schedules[currentScheduleIndex];
    if (st) st.modified = true; else timetableState.schedules[currentScheduleIndex] = { templateName: '未选择', modified: true };
    saveTimetableState();
    this.updateTimetableLabel();
  },
  delClass() {
    if (currentClassIndex === -1) return;

    currentData.schedules[currentScheduleIndex].classes.splice(
      currentClassIndex,
      1
    );
    storage.save();
    try { window.markUnsynced && window.markUnsynced(); } catch {}
    schedule.refresh();
    currentClassIndex = -1;
    // 标记时间表已更改（删除课时视为课时编辑器变更）
    const st = timetableState.schedules[currentScheduleIndex];
    if (st) st.modified = true; else timetableState.schedules[currentScheduleIndex] = { templateName: '未选择', modified: true };
    saveTimetableState();
    this.updateTimetableLabel();
  },
  clone() {
    const newSchedule = JSON.parse(
      JSON.stringify(currentData.schedules[currentScheduleIndex])
    );
    newSchedule.name = "无规则计划";
    newSchedule.enable_day = csesDays(newSchedule.enable_day);
    newSchedule.weeks = newSchedule.weeks || 'all';
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
    const isV2 = storage.getCsesVersion() === 2;
    days.forEach((day) => {
      const dayNum = parseInt(day, 10);
      const newSchedule = {
        name: isV2 ? this.autoScheduleName([dayNum], 'all') : `All_${this.dayMap_Full[day]}`,
        classes: [],
        weeks: "all",
        enable_day: [dayNum],
      };

      currentData.schedules.push(newSchedule);
    });

    storage.save();
    try { window.markUnsynced && window.markUnsynced(); } catch {}
    this.init();
    alert("快速创建周一~周日通用周成功");
  },
  setSubject(subject, autoAdd) {
    if (currentClassIndex === -1) return;
    currentData.schedules[currentScheduleIndex].classes[
      currentClassIndex
    ].subject = subject;
    storage.save();
    try { window.markUnsynced && window.markUnsynced(); } catch {}
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
    const cls = currentData.schedules[currentScheduleIndex].classes[currentClassIndex];
    if (!cls) return;
    const inputs = document.querySelectorAll(".time-input");
    const start = csesTime(inputs[0] && inputs[0].value);
    const end = csesTime(inputs[1] && inputs[1].value);
    // 输入控件未提供有效值时保持原值，避免把已有时间清空
    if (!start || !end) return;
    cls.start_time = start;
    cls.end_time = end;
    storage.save();
    try { window.markUnsynced && window.markUnsynced(); } catch {}
    schedule.refresh();
    const st = timetableState.schedules[currentScheduleIndex];
    if (st) {
      st.modified = true;
    } else {
      timetableState.schedules[currentScheduleIndex] = { templateName: '未选择', modified: true };
    }
    saveTimetableState();
    this.updateTimetableLabel();
  },
  loadTimetableOptions() {
    const sel = document.getElementById('timetable-mode');
    if (!sel) return;
    sel.innerHTML = '';
    const noneOpt = document.createElement('fluent-option');
    noneOpt.value = '';
    noneOpt.textContent = '未选择';
    sel.appendChild(noneOpt);
    getAllTimetables().forEach(t => {
      const opt = document.createElement('fluent-option');
      opt.value = t.name;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });
    const st = timetableState.schedules[currentScheduleIndex];
    sel.value = st?.templateName || '';
  },
  applyTimetableFromSelect(name) {
    if (!name) return; // 选择未选择则不应用
    this.applyTimetable(name);
  },
  createTimetableUI() {
    prompt('输入新时间表名称', (val) => {
      const name = (val || '').trim();
      if (!name) return;
      schedule.createTimetableConfirmName(name);
    }, '保存为时间表');
  },
  createTimetableConfirm() {
    const input = document.getElementById('new-timetable-name');
    const name = (input?.value || '').trim();
    if (!name) return;
    this.createTimetableConfirmName(name);
  },
  createTimetableConfirmName(name) {
    const sch = currentData.schedules[currentScheduleIndex];
    const times = (sch.classes || []).map(c => [csesTime(c.start_time), csesTime(c.end_time)]).filter(([s,e])=> s && e);
    if (times.length === 0) {
      // 若当前课表没有时间，创建空模板也允许
    }
    let newName = name;
    let counter = 1;
    while (getAllTimetables().some(t => t.name === newName)) {
      newName = `${name}(${counter++})`;
    }
    customTimetables.push({ key: newName, name: newName, times });
    saveCustomTimetables();
    this.renderTimetableList();
    this.loadTimetableOptions();
    const sel = document.getElementById('timetable-mode');
    if (sel) sel.value = newName;
    timetableState.schedules[currentScheduleIndex] = { templateName: newName, modified: false };
    saveTimetableState();
    // 同步到当前课程表，便于导出/预览包含所选时间表名称
    currentData.schedules[currentScheduleIndex].timetable_name = newName;
    storage.save();
    this.updateTimetableLabel();
  },
  applyTimetable(name) {
    if (currentScheduleIndex === -1) return;
    const tmpl = getAllTimetables().find(t => t.name === name);
    if (!tmpl) return;
    const sch = currentData.schedules[currentScheduleIndex];
    const times = tmpl.times || [];
    const tmplLen = times.length;
    const beforeLen = (sch.classes || []).length;
    for (let i = 0; i < tmplLen; i++) {
      const [rawStart, rawEnd] = times[i];
      const start = csesTime(rawStart);
      const end = csesTime(rawEnd);
      if (!sch.classes[i]) {
        sch.classes[i] = {
          subject: document.querySelector('#current-subject')?.value || '-',
          start_time: start,
          end_time: end,
        };
      } else {
        sch.classes[i].start_time = start;
        sch.classes[i].end_time = end;
      }
    }
    const finish = (keepExtra) => {
      if (!keepExtra && beforeLen > tmplLen) {
        sch.classes = sch.classes.slice(0, tmplLen);
      }
      // 同步到当前课程表，便于导出/预览包含所选时间表名称
      sch.timetable_name = name;
      storage.save();
      try { window.markUnsynced && window.markUnsynced(); } catch {}
      this.refresh();
      timetableState.schedules[currentScheduleIndex] = { templateName: name, modified: false };
      saveTimetableState();
      this.updateTimetableLabel();
    };
    if (beforeLen > tmplLen) {
      confirm('所选时间表课时短于当前课时，是否保留多余课时？', (ok) => finish(ok));
    } else {
      finish(true);
    }
  },
  updateTimetableLabel() {
    const el = document.getElementById('timetable-status');
    if (!el) return;
    const st = timetableState.schedules[currentScheduleIndex];
    if (!st) {
      el.textContent = '已选:未选择';
    } else {
      el.textContent = `已选:${st.templateName}${st.modified ? '(已更改)' : ''}`;
    }
    // 同步更新左侧列表当前项的标签
    try { this.updateScheduleListTimetableTag(currentScheduleIndex); } catch {}
  },
  updateScheduleListTimetableTag(idx) {
    try {
      const container = document.getElementById('schedule-list');
      if (!container || typeof idx !== 'number' || idx < 0) return;
      const isES = storage.getOutputMode() === 'es';
      const childIndex = isES ? idx : idx + 1; // 非ES模式首项为表格视图
      const item = container.children[childIndex];
      if (!item) return;
      item.style.display = 'flex';
      item.style.width = '100%';
      item.style.alignItems = 'center';
      const st = timetableState?.schedules?.[idx];
      const tagText = (st && st.templateName && st.templateName !== '' && st.templateName !== '未选择')
        ? `${st.modified ? '*' : ''}${st.templateName}` : '';
      let tagEl = item.querySelector('.schedule-timetable-tag');
      if (tagText) {
        if (!tagEl) {
          tagEl = document.createElement('span');
          tagEl.className = 'schedule-timetable-tag';
          tagEl.style.marginLeft = 'auto';
          tagEl.style.color = '#666';
          item.appendChild(tagEl);
        }
        tagEl.innerHTML = `&nbsp;${tagText}`; // 标签前加入一个空格
      } else {
        if (tagEl) tagEl.remove();
      }
    } catch (e) {
      console.warn('updateScheduleListTimetableTag failed', e);
    }
  },
  toggleTimeEditor() {
    timeEditorCollapsed = !timeEditorCollapsed;
    document.querySelectorAll('.time-input').forEach((el) => {
      el.style.display = timeEditorCollapsed ? 'none' : 'inline-block';
    });
    const addBtn = document.getElementById('add-class-btn');
    const delBtn = document.getElementById('del-class-btn');
    if (addBtn) addBtn.style.display = timeEditorCollapsed ? 'none' : 'inline-block';
    if (delBtn) delBtn.style.display = timeEditorCollapsed ? 'none' : 'inline-block';
    const btn = document.getElementById('toggle-time-editor');
    if (btn) btn.textContent = timeEditorCollapsed ? '显示课时编辑器' : '收起课时编辑器';
  },
  ensureTimeEditorCollapsedDefault() {
    timeEditorCollapsed = true;
    document.querySelectorAll('.time-input').forEach((el) => {
      el.style.display = 'none';
    });
    const addBtn = document.getElementById('add-class-btn');
    const delBtn = document.getElementById('del-class-btn');
    if (addBtn) addBtn.style.display = 'none';
    if (delBtn) delBtn.style.display = 'none';
    const btn = document.getElementById('toggle-time-editor');
    if (btn) btn.textContent = '显示课时编辑器';
  },
  // 根据输出模式与 CSES 版本切换卡片显示
  toggleOutputCards() {
    this.applyVersionUI();
  },
  renderTimetableList() {
    const panel = document.getElementById('timetable-list');
    if (!panel) return;
    panel.innerHTML = '';
    if (customTimetables.length === 0) {
      const empty = document.createElement('fluent-option');
      empty.innerHTML = '<i class="bi bi-clock-history"></i>&nbsp;暂无时间表，点上方 + 新建';
      panel.appendChild(empty);
      return;
    }
    customTimetables.forEach(t => {
      const opt = document.createElement('fluent-option');
      opt.className = 'explorer-item';
      opt.style.display = 'flex';
      opt.style.width = '100%';
      opt.value = t.name;
      opt.innerHTML = `<i class="bi bi-clock-history"></i>&nbsp;${t.name}`;
      opt.addEventListener('click', () => schedule.showTimeEditor(t.name));
      opt.addEventListener('contextmenu', (e) => { e.preventDefault(); confirm(`确定要删除时间表 ${t.name} 吗？`, (ok)=>{ if(ok) schedule.deleteTimetable(t.name); }); });
      if (schedule.currentTimetableName === t.name) { opt.classList.add('selected'); opt.setAttribute('aria-selected', 'true'); }
      panel.appendChild(opt);
    });
  },
  addTimetableUI() {
    prompt('输入新时间表名称', (val) => {
      const name = (val || '').trim();
      if (!name) return;
      schedule.createTimetableFromCurrent(name);
    }, '新建时间表');
  },
  createTimetableConfirm2() {
    const input = document.getElementById('new-timetable-name2');
    const name = (input?.value || '').trim();
    if (!name) return;
    const sch = currentData.schedules[currentScheduleIndex];
    const times = (sch?.classes || []).map(c => [csesTime(c.start_time), csesTime(c.end_time)]).filter(([s,e])=> s && e);
    let newName = name;
    let counter = 1;
    while (getAllTimetables().some(t => t.name === newName)) { newName = `${name}(${counter++})`; }
    customTimetables.push({ name: newName, times });
    saveCustomTimetables();
    schedule.renderTimetableList();
    schedule.loadTimetableOptions();
  },
  editTimetableUI(name) {
    this.showTimeEditor(name);
  },
  renameTimetable(oldName) {
    const input = document.getElementById('edit-timetable-name');
    const newName = (input?.value || '').trim();
    if (!newName) return;
    if (getAllTimetables().some(t => t.name === newName)) { alert('已存在同名的时间表，请更换名称'); return; }
    const idx = customTimetables.findIndex(t => t.name === oldName);
    if (idx !== -1) { customTimetables[idx].name = newName; customTimetables[idx].key = newName; saveCustomTimetables(); schedule.renderTimetableList(); schedule.loadTimetableOptions(); schedule.updateTimetableLabel(); }
  },
  overwriteTimetable(name) {
    const sch = currentData.schedules[currentScheduleIndex];
    const times = (sch?.classes || []).map(c => [csesTime(c.start_time), csesTime(c.end_time)]).filter(([s,e])=> s && e);
    const idx = customTimetables.findIndex(t => t.name === name);
    if (idx !== -1) { customTimetables[idx].times = times; saveCustomTimetables(); schedule.renderTimetableList(); }
    // 新增：保存时间表后，自动更新所有选中该时间表且未修改的课程表
    try { this._propagateTimetableToSchedules(name, times); storage.save(); } catch (e) { console.warn('propagate on overwrite failed', e); }
  },
  deleteTimetable(name) {
    const idx = customTimetables.findIndex(t => t.name === name);
    if (idx !== -1) { customTimetables.splice(idx, 1); saveCustomTimetables(); schedule.renderTimetableList(); schedule.loadTimetableOptions(); }
  },
  createTimetableFromCurrent(name) {
    const sch = currentData.schedules[currentScheduleIndex];
    const times = (sch?.classes || []).map(c => [csesTime(c.start_time), csesTime(c.end_time)]).filter(([s,e])=> s && e);
    let newName = name;
    let counter = 1;
    while (getAllTimetables().some(t => t.name === newName)) { newName = `${name}(${counter++})`; }
    customTimetables.push({ name: newName, times });
    saveCustomTimetables();
    schedule.renderTimetableList();
    schedule.loadTimetableOptions();
  },
  showTimeEditor(name, push) {
    try {
      this.currentTimetableName = name;
      if (typeof setEditorSrc === 'function') { setEditorSrc('time', { sub: 'timetable', timetable: name }); return; }
    } catch {}
    try {
      if (push !== false && (window.__unsynced || window.__unsaved)) {
        saveConfirm((res) => {
          if (res === 'save') { try { file.export(false); } catch {} schedule.showTimeEditor(name, false); }
          else if (res === 'discard') { schedule.showTimeEditor(name, false); }
        });
        return;
      }
    } catch {}
    const t = customTimetables.find(x => x.name === name);
    this.currentTimetableName = name;
    document.getElementById('change-editor')?.style && (document.getElementById('change-editor').style.display = 'none');
    document.getElementById('schedule-editor')?.style && (document.getElementById('schedule-editor').style.display = 'none');
    document.getElementById('subject-editor')?.style && (document.getElementById('subject-editor').style.display = 'none');
    document.getElementById('source-editor')?.style && (document.getElementById('source-editor').style.display = 'none');
    const timeEl = document.getElementById('time-editor');
    if (timeEl) timeEl.style.display = 'block';
    if (checkDeviceType()) {
      location.href = '#time-editor';
      const explorer = document.getElementsByClassName('explorer')[0];
      const area = document.getElementsByClassName('editor-area')[0];
      if (explorer) explorer.style.display = 'none';
      if (area) area.style.display = 'block';
    }
    try { const tabs = document.getElementById('explorerB'); if (tabs) tabs.setAttribute('activeid', 'timeB'); } catch {}
    try {
      if (push !== false) {
        const p = new URLSearchParams(window.location.search);
        p.set('view', 'schedule');
        p.set('sub', 'timetable');
        p.set('timetable', name || '');
        p.delete('schedule');
        p.delete('subject'); p.delete('subjectName');
        p.delete('week');
        history.pushState(null, '', `${location.pathname}?${p.toString()}${location.hash}`);
      }
    } catch {}
    const nameField = document.getElementById('time-template-name');
    if (nameField) nameField.value = name || '';
    this.renderTimeEditorRows(t?.times || []);
  },
  renderTimeEditorRows(times) {
    const container = document.getElementById('time-rows');
    if (!container) return;
    container.innerHTML = '';
    if (!times || times.length === 0) {
      this.addTimeRow();
      return;
    }
    times.forEach(([s,e]) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.alignItems = 'center';
      const start = document.createElement('input'); start.type = 'time'; start.step = '1'; start.className = 'time-row-start'; start.value = csesTime(s);
      const end = document.createElement('input'); end.type = 'time'; end.step = '1'; end.className = 'time-row-end'; end.value = csesTime(e);
      const del = document.createElement('fluent-button'); del.textContent = '删除';
      del.addEventListener('click', () => { row.remove(); });
      row.appendChild(start); row.appendChild(end); row.appendChild(del);
      container.appendChild(row);
    });
  },
  addTimeRow() {
    const container = document.getElementById('time-rows');
    if (!container) return;

    const courseMin = parseInt(document.getElementById('quick-course-min')?.value || localStorage.getItem('quick-course-min') || '0') || 0;
    const breakMin = parseInt(document.getElementById('quick-break-min')?.value || localStorage.getItem('quick-break-min') || '0') || 0;

    const ends = container.querySelectorAll('.time-row-end');
    const lastEnd = ends.length ? ends[ends.length - 1].value : '';

    let startVal = '';
    let endVal = '';

    if (lastEnd && csesTimeToMinutes(lastEnd) != null) {
      startVal = breakMin > 0 ? csesMinutesToTime(csesTimeToMinutes(lastEnd) + breakMin) : csesTime(lastEnd);
    }
    if (courseMin > 0 && startVal) {
      endVal = csesMinutesToTime(csesTimeToMinutes(startVal) + courseMin);
    }

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';
    const start = document.createElement('input'); start.type = 'time'; start.step = '1'; start.className = 'time-row-start'; start.value = startVal || '';
    const end = document.createElement('input'); end.type = 'time'; end.step = '1'; end.className = 'time-row-end'; end.value = endVal || '';
    const del = document.createElement('fluent-button'); del.textContent = '删除';
    del.addEventListener('click', () => { row.remove(); });
    row.appendChild(start); row.appendChild(end); row.appendChild(del);
    container.appendChild(row);
  },
  saveTimeTemplate() {
    const nameField = document.getElementById('time-template-name');
    const name = (nameField?.value || '').trim();
    if (!name) { alert('请输入时间表名称'); return; }
    const rows = Array.from(document.querySelectorAll('#time-rows > div'));
    const times = rows.map(r => {
      const s = csesTime(r.querySelector('.time-row-start')?.value || '');
      const e = csesTime(r.querySelector('.time-row-end')?.value || '');
      return [s, e];
    }).filter(([s,e]) => s && e);
    const doSave = () => {
      const existingIdx = customTimetables.findIndex(t => t.name === schedule.currentTimetableName);
      if (schedule.currentTimetableName !== name && getAllTimetables().some(t => t.name === name)) {
        alert('已存在同名时间表，请更换名称');
        return;
      }
      if (existingIdx !== -1) {
        customTimetables[existingIdx] = { key: name, name, times };
      } else {
        customTimetables.push({ key: name, name, times });
      }
      schedule.currentTimetableName = name;
      saveCustomTimetables();
      schedule.renderTimetableList();
      schedule.loadTimetableOptions();
      schedule.updateTimetableLabel();
      // 新增：保存时间表后，自动更新所有选中该时间表且未修改的课程表
      try { schedule._propagateTimetableToSchedules(name, times); storage.save(); } catch (e) { console.warn('propagate on save failed', e); }
    };
    if (times.length === 0) {
      confirm('当前没有有效课时，仍要保存为空模板吗？', (ok) => { if (ok) doSave(); });
    } else {
      doSave();
    }
  },
  // 导出当前时间表为 JSON（复制到剪贴板并提示）
  exportTimeTemplateJSON() {
    try {
      const nameField = document.getElementById('time-template-name');
      const nameFromField = (nameField?.value || '').trim();
      const name = nameFromField || this.currentTimetableName || '未命名时间表';
      // 优先以编辑器当前行生成导出
      const rows = Array.from(document.querySelectorAll('#time-rows > div'));
      let timesObj = rows.map(r => {
        const s = csesTime(r.querySelector('.time-row-start')?.value || '');
        const e = csesTime(r.querySelector('.time-row-end')?.value || '');
        return { starttime: s, endtime: e };
      }).filter(t => t.starttime && t.endtime);
      // 如果编辑器为空，则尝试从已保存模板读取
      if (timesObj.length === 0 && this.currentTimetableName) {
        const t = customTimetables.find(x => x.name === this.currentTimetableName);
        if (t && Array.isArray(t.times)) {
          timesObj = t.times.map(([s,e]) => ({ starttime: s, endtime: e })).filter(t => t.starttime && t.endtime);
        }
      }
      const data = { name, times: timesObj };
      const json = JSON.stringify(data, null, 2);
      // 优先使用 execCommand 方案复制；随后询问是否下载文件
      let copiedByTextarea = false;
      try {
        if (typeof copyToClip === 'function') {
          copyToClip([json], '已复制JSON到剪贴板');
          copiedByTextarea = true;
        }
      } catch {}
      const afterCopy = () => {
        confirm('是否同时下载为文件？', (ok) => { if (ok) this.downloadTimeTemplateJSON(json); });
      };
      if (copiedByTextarea) {
        afterCopy();
      } else {
        // 回退到 Clipboard API；如失败则提示下载
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).then(() => {
              alert('已复制JSON到剪贴板');
              afterCopy();
            }).catch(() => {
              confirm('复制失败，是否下载JSON文件？', (ok) => { if (ok) this.downloadTimeTemplateJSON(json); });
            });
          } else {
            confirm('复制失败，是否下载JSON文件？', (ok) => { if (ok) this.downloadTimeTemplateJSON(json); });
          }
        } catch (e) {
          confirm('复制失败，是否下载JSON文件？', (ok) => { if (ok) this.downloadTimeTemplateJSON(json); });
        }
      }
      return json;
    } catch (e) {
      alert('导出失败：' + (e?.message || e));
    }
  },
  // 触发下载当前时间表为 JSON 文件（支持传入已有json避免重复导出）
  downloadTimeTemplateJSON(jsonOverride) {
    const json = typeof jsonOverride === 'string' ? jsonOverride : this.exportTimeTemplateJSON();
    if (!json) return;
    const nameField = document.getElementById('time-template-name');
    const name = (nameField?.value || '').trim() || this.currentTimetableName || '未命名时间表';
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.timetable.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  },
  // 从剪贴板读取 JSON 并导入（使用 confirm）
  importTimeTemplateJSONUI() {
    // 改为使用编辑框粘贴导入
    prompt('粘贴时间表JSON并确认导入', (val) => {
      if (!val || !val.trim()) return;
      schedule.importTimeTemplateJSON(val);
    }, '导入时间表');
  },
  importTimeTemplateJSON(jsonStr) {
    try {
      const obj = JSON.parse(jsonStr);
      const nameRaw = (obj?.name || obj?.key || '导入时间表').trim();
      const name = nameRaw || '导入时间表';
      const timesArr = Array.isArray(obj?.times) ? obj.times.map(it => {
        if (Array.isArray(it)) return [csesTime(it[0]), csesTime(it[1])];
        const s = (it && it.starttime) ? csesTime(it.starttime) : '';
        const e = (it && it.endtime) ? csesTime(it.endtime) : '';
        return [s, e];
      }).filter(([s,e]) => s && e) : [];
      // 若无有效课时，提示用户
      if (timesArr.length === 0) { alert('导入失败：没有有效的课时'); return; }
      // 确保名称唯一
      let newName = name;
      let counter = 1;
      while (getAllTimetables().some(t => t.name === newName)) newName = `${name}(${counter++})`;
      const tpl = { key: newName, name: newName, times: timesArr };
      customTimetables.push(tpl);
      saveCustomTimetables();
      schedule.currentTimetableName = newName;
      schedule.renderTimetableList();
      schedule.loadTimetableOptions();
      schedule.showTimeEditor(newName);
      schedule.updateTimetableLabel();
      alert('导入成功');
    } catch (e) {
      alert('导入失败：JSON格式不正确或内容无效');
      console.error(e);
    }
  },
  deleteTimeTemplateInEditor() {
    if (!this.currentTimetableName) return;
    const name = this.currentTimetableName;
    confirm(`确定要删除时间表 ${name} 吗？`, (ok) => {
      if (!ok) return;
      const idx = customTimetables.findIndex(t => t.name === name);
      if (idx !== -1) {
        customTimetables.splice(idx, 1);
        saveCustomTimetables();
        schedule.renderTimetableList();
        schedule.loadTimetableOptions();
        const timeEl = document.getElementById('time-editor');
        const schedEl = document.getElementById('schedule-editor');
        if (timeEl) timeEl.style.display = 'none';
        if (schedEl) schedEl.style.display = 'block';
      }
    });
  },
  _propagateTimetableToSchedules(name, times) {
    if (!name || !Array.isArray(times)) return;
    const stAll = timetableState?.schedules || {};
    Object.keys(stAll).forEach((k) => {
      const idx = parseInt(k);
      const st = stAll[k];
      if (!st || st.templateName !== name || st.modified) return;
      const sch = currentData.schedules[idx];
      if (!sch) return;
      const tmplLen = times.length;
      const beforeLen = (sch.classes || []).length;
      for (let i = 0; i < tmplLen; i++) {
        const [rawStart, rawEnd] = times[i];
        const start = csesTime(rawStart);
        const end = csesTime(rawEnd);
        if (!sch.classes) sch.classes = [];
        if (!sch.classes[i]) {
          sch.classes[i] = {
            subject: sch.classes[i]?.subject || '-',
            start_time: start,
            end_time: end,
          };
        } else {
          sch.classes[i].start_time = start;
          sch.classes[i].end_time = end;
        }
      }
      if (beforeLen > tmplLen) {
        sch.classes = sch.classes.slice(0, tmplLen);
      }
      timetableState.schedules[idx] = { templateName: name, modified: false };
      sch.timetable_name = name;
      if (idx === currentScheduleIndex) {
        try { schedule.refresh && schedule.refresh(); } catch {}
        try { schedule.updateTimetableLabel && schedule.updateTimetableLabel(); } catch {}
      }
    });
  },
};
window.schedule = schedule;
function getAllTimetables(){ try { return [...timetableTemplates, ...customTimetables]; } catch { return timetableTemplates.slice(); } }

function copyToClip(contentArray, message) {
  var contents = "";
  for (var i = 0; i < contentArray.length; i++) {
    contents += contentArray[i] + "\n";
  }
  const textarea = document.createElement('textarea');
  textarea.value = contents;
  document.body.appendChild(textarea);
  textarea.select();
  if (document.execCommand('copy')) {
    document.execCommand('copy');
  }
  document.body.removeChild(textarea);
  if (message == null) {
    alert("复制成功");
  } else {
    alert(message);
  }
}
