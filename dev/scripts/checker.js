/*
 * checker.js —— 右侧档案页面下栏的「格式检查器」
 *
 * 只在导出格式为 CSES（CSES v1 / v2）时显示：ClassIsland / ExamSchedule 有自己的结构，
 * 用 CSES 规则去挑毛病没有意义。
 * 检查以 localStorage 中的最新数据为准（避免宿主页面持有过期副本），
 * 展开后可按条目跳转到出问题的课表 / 科目 / CSES 配置。
 */
const formatChecker = {
  expanded: false,
  viewVisible: true, // 当前视图是否允许显示（由 main.js 按视图切换）
  visible: false,    // 视图允许 && 导出格式是 CSES
  lastSignature: null,
  lastErrorCount: 0,
  timer: null,
  autoTimer: null,
  retry: 0,

  init() {
    this.bind();
    // storage / cses 由 include.html 引入，可能稍晚于本脚本；没就绪时稍后重试
    const ready = () => {
      if (typeof storage === 'undefined' || typeof storage.validateStored !== 'function') {
        if (this.retry++ < 60) { setTimeout(ready, 100); }
        return;
      }
      this.applyVisibility(true);
    };
    ready();
    // 同源 iframe 修改 localStorage 会触发宿主页面的 storage 事件
    try {
      window.addEventListener('storage', (e) => {
        if (!e || !e.key || e.key === 'csesData' || e.key === 'output-mode' || e.key === 'cses-version') this.schedule();
      });
    } catch {}
    try {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.refresh(); });
    } catch {}
    // 兜底轮询（iframe 内部的写入不一定会触发 storage 事件）
    try { this.autoTimer = setInterval(() => { if (!document.hidden) this.refresh(); }, 4000); } catch {}
  },

  isCsesMode() {
    try {
      if (typeof storage === 'undefined' || !storage.isCsesMode) return false;
      return storage.isCsesMode();
    } catch { return false; }
  },

  bind() {
    const refreshBtn = document.getElementById('format-checker-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => { e.stopPropagation(); this.refresh(true); });
    }
    const chevron = document.getElementById('format-checker-chevron');
    if (chevron) {
      chevron.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); });
    }
  },

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 350);
  },

  refresh(force) {
    if (typeof storage === 'undefined' || typeof storage.validateStored !== 'function') return;
    // 非 CSES 格式（ClassIsland / ExamSchedule）下整个下栏都不显示
    if (!this.isCsesMode()) { this.hide(); return; }
    if (!this.viewVisible) { this.hide(); return; }
    this.visible = true;
    const panel = document.getElementById('format-checker');
    if (panel) panel.style.display = '';

    let result;
    try {
      result = storage.validateStored();
    } catch (e) {
      result = { ok: false, version: 1, errors: [String(e && e.message ? e.message : e)], warnings: [], issues: [] };
    }
    const signature = JSON.stringify((result && result.issues) || []) + '#' + (result && result.version) + '#' + (result && result.ok);
    if (!force && signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.render(result);
  },

  hide() {
    this.visible = false;
    const panel = document.getElementById('format-checker');
    if (panel) panel.style.display = 'none';
  },

  render(result) {
    const issues = (result && result.issues) || [];
    const errors = issues.filter((i) => i.level === 'error');
    const warnings = issues.filter((i) => i.level === 'warning');
    const panel = document.getElementById('format-checker');
    const icon = document.getElementById('format-checker-icon');
    const summary = document.getElementById('format-checker-summary');
    const title = document.getElementById('format-checker-title');
    const list = document.getElementById('format-checker-list');
    if (!panel) return;

    panel.classList.toggle('ok', errors.length === 0 && warnings.length === 0);
    panel.classList.toggle('warn', errors.length === 0 && warnings.length > 0);
    panel.classList.toggle('error', errors.length > 0);

    if (icon) {
      icon.className = 'bi ' + (errors.length ? 'bi-exclamation-octagon' : (warnings.length ? 'bi-exclamation-triangle' : 'bi-patch-check'));
    }
    if (title) title.textContent = `CSES v${(result && result.version) || 1} 格式检查`;
    if (summary) {
      const parts = [];
      if (errors.length) parts.push(`${errors.length} 个错误`);
      if (warnings.length) parts.push(`${warnings.length} 个警告`);
      summary.textContent = parts.length ? parts.join('，') : '未发现格式问题';
    }

    // 从「无错误」变为「有错误」时自动展开，方便直接看到问题
    if (errors.length > 0 && this.lastErrorCount === 0) this.toggle(true);
    this.lastErrorCount = errors.length;

    if (!list) return;
    list.textContent = '';
    if (!issues.length) {
      const empty = document.createElement('div');
      empty.className = 'format-checker-empty';
      empty.textContent = '当前文档符合 CSES 格式要求。';
      list.appendChild(empty);
      return;
    }
    issues.forEach((issue) => list.appendChild(this.renderIssue(issue)));
  },

  renderIssue(issue) {
    const row = document.createElement('div');
    row.className = 'format-checker-issue ' + (issue.level === 'error' ? 'is-error' : 'is-warn');

    const badge = document.createElement('span');
    badge.className = 'format-checker-badge';
    badge.textContent = issue.level === 'error' ? '错误' : '警告';
    row.appendChild(badge);

    const text = document.createElement('span');
    text.className = 'format-checker-text';
    text.textContent = issue.message;
    if (issue.path) text.title = issue.path;
    row.appendChild(text);

    const target = this.jumpTarget(issue);
    if (target) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'format-checker-jump';
      btn.textContent = target.label;
      btn.addEventListener('click', (e) => { e.stopPropagation(); target.go(); });
      row.appendChild(btn);
    }
    return row;
  },

  // 问题条目 -> 可跳转的目标
  jumpTarget(issue) {
    if (typeof issue.scheduleIndex === 'number' && issue.scheduleIndex >= 0) {
      const idx = issue.scheduleIndex;
      return { label: `课表 ${idx + 1}`, go: () => this.openSchedule(idx) };
    }
    if (typeof issue.subjectIndex === 'number' && issue.subjectIndex >= 0) {
      const idx = issue.subjectIndex;
      return { label: `科目 ${idx + 1}`, go: () => this.openSubject(idx) };
    }
    if (issue.path && issue.path.indexOf('configuration') === 0) {
      return { label: 'CSES 配置', go: () => this.openDoc() };
    }
    return null;
  },

  openSchedule(index) {
    try {
      if (typeof activityBar !== 'undefined' && activityBar.toggle) activityBar.toggle('schedule');
    } catch {}
    try { if (typeof schedule !== 'undefined' && schedule.load) schedule.load(index, false); } catch {}
  },
  openSubject(index) {
    try {
      if (typeof activityBar !== 'undefined' && activityBar.toggle) activityBar.toggle('schedule');
    } catch {}
    try { if (typeof subjects !== 'undefined' && subjects.load) subjects.load(index, false); } catch {}
  },
  openDoc() {
    // CSES 文档配置（configuration）在「配置」页面里
    try {
      if (typeof activityBar !== 'undefined' && activityBar.toggle) activityBar.toggle('control');
    } catch {}
  },

  toggle(force) {
    const panel = document.getElementById('format-checker');
    if (!panel) return;
    this.expanded = (typeof force === 'boolean') ? force : !this.expanded;
    panel.classList.toggle('collapsed', !this.expanded);
    const chevron = document.querySelector('#format-checker-chevron i');
    if (chevron) chevron.className = 'bi ' + (this.expanded ? 'bi-chevron-down' : 'bi-chevron-up');
  },

  // 当前视图是否允许显示检查器（档案、文件预览、实例管理显示；集控配置隐藏）；
  // 实际是否显示还要看导出格式是不是 CSES
  show(viewVisible) {
    this.viewVisible = !!viewVisible;
    this.applyVisibility(!!viewVisible);
  },

  // 依据「视图 + 导出格式」计算最终可见性
  applyVisibility(force) {
    if (this.viewVisible && this.isCsesMode()) {
      this.visible = true;
      const panel = document.getElementById('format-checker');
      if (panel) panel.style.display = '';
      this.refresh(!!force);
    } else {
      this.hide();
    }
  },
};

try { window.formatChecker = formatChecker; } catch {}
try { window.refreshFormatChecker = function () { try { formatChecker.refresh(true); } catch {} }; } catch {}

try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => formatChecker.init());
  } else {
    formatChecker.init();
  }
} catch {}
