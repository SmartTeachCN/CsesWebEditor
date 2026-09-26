/* =========================================================================
 * 子用户面板 (/subuser.php)
 * -------------------------------------------------------------------------
 * 与主面板 (panel.php) 共用同一套「配置 / 档案 / 文件」区块
 *   - 配置 -> dev/pages/editor/control.html  (control.js)
 *   - 档案 -> dev/pages/editor/schedule.html / subject.html / time.html / change.html
 *   - 文件 -> dev/pages/editor/source.html
 * 本文件只替换数据来源：把 terminal.*（登录用户的多实例管理）换成 subAuth.*
 * （实例组标识 + 子用户名 + 密钥认证），并把保存目标换成 subSave。
 *
 * 安全约定：
 *   - 凭据只通过 POST 提交，绝不放进 URL；
 *   - 凭据只保存在本标签页的 sessionStorage（且密钥默认为「不记住」），
 *     不会污染主人面板使用的 localStorage。
 * ========================================================================= */

const SUBUSER_STORE = {
  dir: 'subuser.dir',
  user: 'subuser.user',
  secret: 'subuser.secret',
  terminal: 'subuser.terminal',
  remember: 'subuser.remember'
};

function subEl(id) { return document.getElementById(id); }
function subTrim(id) { const el = subEl(id); return el && typeof el.value === 'string' ? el.value.trim() : ''; }
function subRaw(id) { const el = subEl(id); return el && typeof el.value === 'string' ? el.value : ''; }
function subSetVal(id, v) { const el = subEl(id); if (el) el.value = v == null ? '' : v; }
function subMsg(text) { const el = subEl('subuser-auth-msg'); if (el) el.textContent = text || ''; }

function subBody(fields) {
  const b = new URLSearchParams();
  Object.keys(fields).forEach((k) => b.append(k, fields[k] == null ? '' : fields[k]));
  return b;
}

async function subPost(fields) {
  const r = await fetch('function.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: subBody(fields)
  });
  let json = null;
  try { json = await r.json(); } catch { }
  if (!json) throw new Error('服务器返回异常');
  return json;
}

/* 编辑器 iframe 的改动是写进 localStorage 的，这里把两边的脏标记都算上 */
function subHasUnsaved() {
  let unsaved = !!(window.__unsaved || window.__unsynced);
  try {
    const frame = subEl('editor-frame');
    const w = frame && frame.contentWindow;
    if (w && (w.__unsaved || w.__unsynced)) unsaved = true;
  } catch { }
  return unsaved;
}

function subClearUnsaved() {
  try { window.__unsaved = false; window.__unsynced = false; } catch { }
  try {
    const frame = subEl('editor-frame');
    const w = frame && frame.contentWindow;
    if (w) { w.__unsaved = false; w.__unsynced = false; }
  } catch { }
}

function subFlashSaveButton(text) {
  const btn = subEl('save-button');
  if (!btn) return;
  const prev = btn.innerHTML;
  btn.innerHTML = '<span class="desktop-only"><i class="bi bi-check-circle"></i>&nbsp;' + (text || '保存成功') +
    '</span><span class="mobile-only"><i class="bi bi-check-circle"></i></span>';
  setTimeout(() => { btn.innerHTML = prev; }, 1200);
}

function subFlashIcon(el) {
  try {
    el.style.transform = 'scale(1.12)';
    setTimeout(() => { el.style.transform = ''; }, 300);
  } catch { }
}

/* fluent-checkbox 没有原生 input，label 点击不会自动切换，这里补上 */
function subToggleCheckbox(e, id) {
  const el = subEl(id);
  if (!el || el.disabled) return;
  try { if (e && e.target && e.target.closest && e.target.closest('fluent-checkbox')) return; } catch { }
  el.checked = !el.checked;
  if (e && e.preventDefault) e.preventDefault();
}

function subCopyText(t, icon) {
  if (!t) return false;
  const done = () => {
    if (!icon) return;
    const prev = icon.className;
    icon.className = 'bi bi-check';
    subFlashIcon(icon);
    setTimeout(() => { icon.className = prev; }, 700);
  };
  let ok = false;
  try {
    const handler = (e) => { try { e.clipboardData.setData('text/plain', t); e.preventDefault(); } catch { } };
    document.addEventListener('copy', handler);
    ok = document.execCommand('copy');
    document.removeEventListener('copy', handler);
  } catch { }
  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { ta.setSelectionRange(0, ta.value.length); } catch { }
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch { }
  }
  if (ok) { done(); return true; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(done).catch(() => {
      try { prompt('复制失败，请手动复制：', t); } catch { }
    });
    return false;
  }
  try { prompt('复制失败，请手动复制：', t); } catch { }
  return false;
}

/* ===================== 子用户认证与数据 ===================== */

const subAuth = {
  dir: '',
  username: '',
  secret: '',
  terminalId: '',
  terminals: [],
  remembered: false,

  /* 恢复本标签页会话（sessionStorage 是每个标签页独立的） */
  restore() {
    let dir = '';
    try {
      dir = sessionStorage.getItem(SUBUSER_STORE.dir) || window.__SUBUSER_DIR || '';
    } catch {
      dir = window.__SUBUSER_DIR || '';
    }
    subSetVal('subuser-dir', dir);
    let user = '', secret = '', remembered = false, terminal = window.__SUBUSER_TERMINAL || '';
    try {
      user = sessionStorage.getItem(SUBUSER_STORE.user) || '';
      remembered = sessionStorage.getItem(SUBUSER_STORE.remember) === '1';
      secret = remembered ? (sessionStorage.getItem(SUBUSER_STORE.secret) || '') : '';
      terminal = sessionStorage.getItem(SUBUSER_STORE.terminal) || terminal;
    } catch { }
    this.remembered = remembered;
    subSetVal('subuser-user', user);
    subSetVal('subuser-key', secret);
    const rem = subEl('subuser-remember');
    if (rem) rem.checked = remembered;

    if (dir && user && secret) {
      this.login(terminal, true);
    } else if (dir) {
      subMsg('请补全子用户名与密钥后登录');
    } else {
      subMsg('请填写实例组标识、子用户名与密钥');
    }
  },

  async login(preferTerminal, silent) {
    const dir = subTrim('subuser-dir') || this.dir;
    const user = subTrim('subuser-user') || this.username;
    const key = subRaw('subuser-key') || this.secret;
    subSetVal('subuser-dir', dir);
    subSetVal('subuser-user', user);
    if (!dir || !user || !key) { subMsg('请填写实例组标识、子用户名与密钥'); return false; }

    const btn = subEl('subuser-login-btn');
    if (btn) btn.disabled = true;
    if (!silent) subMsg('正在认证...');
    try {
      const d = await subPost({ action: 'subList', directoryId: dir, subUsername: user, subSecret: key });
      if (!d.success) { subMsg(d.error || '认证失败'); return false; }

      this.dir = dir;
      this.username = user;
      this.secret = key;
      this.terminals = Array.isArray(d.terminals) ? d.terminals : [];

      const rem = subEl('subuser-remember');
      this.remembered = !!(rem && rem.checked);
      try {
        sessionStorage.setItem(SUBUSER_STORE.dir, dir);
        sessionStorage.setItem(SUBUSER_STORE.user, user);
        sessionStorage.setItem(SUBUSER_STORE.remember, this.remembered ? '1' : '0');
        if (this.remembered) sessionStorage.setItem(SUBUSER_STORE.secret, key);
        else sessionStorage.removeItem(SUBUSER_STORE.secret);
      } catch { }
      // 未勾选「记住密钥」时不在界面上留下密钥明文（内存里仍然保留，便于保存）
      if (!this.remembered) subSetVal('subuser-key', '');

      this.renderInstances();

      if (!this.terminals.length) {
        subMsg('认证成功，但该子用户当前没有被授权任何实例，请联系实例组主人');
        subView.sync();
        return true;
      }
      let want = '';
      if (preferTerminal && this.terminals.indexOf(preferTerminal) >= 0) want = preferTerminal;
      else if (this.terminalId && this.terminals.indexOf(this.terminalId) >= 0) want = this.terminalId;
      if (want) {
        await this.open(want, true);
      } else if (this.terminals.length === 1) {
        await this.open(this.terminals[0], true);
      } else {
        subMsg('认证成功（' + this.terminals.length + ' 个可管理实例），请在下方选择实例');
        subView.sync();
      }
      return true;
    } catch (e) {
      subMsg('认证失败：' + ((e && e.message) ? e.message : '网络错误'));
      return false;
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async refresh() {
    if (!this.username || !this.secret) { subMsg('请先登录'); return; }
    await this.login(this.terminalId, true);
  },

  forget() {
    try {
      sessionStorage.removeItem(SUBUSER_STORE.secret);
      sessionStorage.removeItem(SUBUSER_STORE.user);
      sessionStorage.removeItem(SUBUSER_STORE.remember);
      sessionStorage.removeItem(SUBUSER_STORE.terminal);
    } catch { }
    this.username = '';
    this.secret = '';
    this.terminalId = '';
    this.terminals = [];
    subSetVal('subuser-user', '');
    subSetVal('subuser-key', '');
    const rem = subEl('subuser-remember');
    if (rem) rem.checked = false;
    subMsg('已清除本标签页的凭据');
    this.renderInstances();
    subView.showEditor(null);
    subView.sync();
  },

  copyUrl(btn) {
    let text = '';
    try {
      text = (subEl('subuser-url') || {}).textContent || '';
    } catch { }
    if (!text) { text = subView.instanceUrl(); }
    if (!text) { alert('暂无源文件地址'); return; }
    subCopyText(text, btn ? btn.querySelector('i') : null);
  },

  renderInstances() {
    const list = subEl('cloud-list');
    const cap = subEl('subuser-instance-caption');
    if (cap) cap.textContent = '可管理实例（' + this.terminals.length + '）';
    if (!list) return;
    list.innerHTML = '';
    this.terminals.forEach((tid) => {
      const opt = document.createElement('fluent-option');
      opt.className = 'explorer-item';
      opt.value = tid;
      const wrap = document.createElement('span');
      wrap.className = 'subuser-instance-item';
      const icon = document.createElement('i');
      icon.className = 'bi bi-terminal';
      const label = document.createElement('span');
      label.textContent = tid;
      label.title = tid;
      wrap.appendChild(icon);
      wrap.appendChild(label);
      if (this.terminalId === tid) {
        const badge = document.createElement('span');
        badge.className = 'subuser-badge';
        badge.textContent = '当前';
        wrap.appendChild(badge);
      }
      opt.appendChild(wrap);
      opt.addEventListener('click', () => { subAuth.open(tid); });
      list.appendChild(opt);
    });
    try { if (list.value !== this.terminalId) list.value = this.terminalId; } catch { }
  },

  /* 载入某个实例的配置到 currentData / localStorage，并刷新复用区块 */
  async open(tid, silent) {
    if (!tid) return;
    if (!this.dir || !this.username || !this.secret) { subMsg('请先登录'); return; }

    const doOpen = async () => {
      try { showLoading(2, '正在载入实例配置'); } catch { }
      try {
        const r = await fetch('function.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: subBody({
            action: 'subLoad',
            directoryId: this.dir,
            subUsername: this.username,
            subSecret: this.secret,
            terminalId: tid
          })
        });
        const text = await r.text();
        let err = '';
        const head = (text || '').trim().charAt(0);
        if (head === '{' || head === '[') {
          try {
            const j = JSON.parse(text);
            if (j && j.success === false) err = j.error || '认证失败';
          } catch { }
        }
        if (err) { alert('载入实例失败：' + err); return; }
        if (!text || !text.trim()) { alert('载入实例失败：配置为空'); return; }

        this.terminalId = tid;
        try { sessionStorage.setItem(SUBUSER_STORE.terminal, tid); } catch { }
        // 复用区块（storage.preview / 源文件地址 / control.js）会读取这两个键
        try {
          localStorage.setItem('directoryId', this.dir);
          localStorage.setItem('currentTerminalId', tid);
        } catch { }

        file.importS(text);
        subClearUnsaved();
        try { storage.initEnv(); } catch { }
        // 让档案区块的列表跟着新实例重建
        window.__scheduleInitialized = false;
        window.__subjectsInitialized = false;
        this.renderInstances();
        subView.showEditor(subView.editorView);
        subView.sync();
        if (!silent) subMsg('已载入实例 ' + tid);
      } catch (e) {
        alert('载入实例失败：' + ((e && e.message) ? e.message : '网络错误'));
      } finally {
        try { closeLoading(2); } catch { }
      }
    };

    if (subHasUnsaved()) {
      saveConfirm((res) => {
        if (res === 'save') { this.save().then(doOpen); }
        else if (res === 'discard') { subClearUnsaved(); doOpen(); }
      });
      return;
    }
    await doOpen();
  },

  /* 保存：从 localStorage 取最新草稿（编辑器 iframe 的改动都在那里），POST 给 subSave */
  async save() {
    if (!this.dir || !this.username || !this.secret) { alert('请先登录子用户'); return; }
    if (!this.terminalId) { alert('请先在左侧选择一个实例'); return; }
    const btn = subEl('save-button');
    if (btn && btn.disabled) return;
    if (btn) btn.disabled = true;
    try {
      try { storage.init(); } catch { }
      let payload = '';
      try { payload = buildCloudPayload(); } catch { payload = JSON.stringify(currentData); }
      const d = await subPost({
        action: 'subSave',
        directoryId: this.dir,
        subUsername: this.username,
        subSecret: this.secret,
        terminalId: this.terminalId,
        config: payload
      });
      if (!d.success) { alert('保存失败：' + (d.error || '未知错误')); return; }
      subClearUnsaved();
      subFlashSaveButton('已保存到实例');
    } catch (e) {
      alert('保存失败：' + ((e && e.message) ? e.message : '网络错误'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }
};

/* file.export() -> saveToCloud()：主面板在 login.html 里定义，这里换成子用户保存 */
function saveToCloud(config, format, noNotice) {
  if (noNotice) return;
  return subAuth.save();
}

/* ===================== 视图（实例 / 配置 / 档案 / 文件） ===================== */

const subView = {
  current: 'cloud',
  editorView: null,
  params: null,

  init() {
    document.querySelectorAll('.activity-item').forEach((item) => {
      item.addEventListener('click', () => {
        subView.toggle(item.dataset.view || 'cloud', false);
      });
    });
  },

  toggle(view, push) {
    if (!view) view = 'cloud';
    this.current = view;
    document.querySelectorAll('.activity-item').forEach((i) => {
      i.classList.toggle('selected', i.dataset.view === view);
    });
    this.showEditor(view === 'cloud' ? null : view, null);
    this.sync();
  },

  /* 切换 iframe 里加载的编辑器页面；view 为 null 表示回到「实例」面板 */
  showEditor(view, params) {
    this.editorView = view;
    this.params = params || null;
    if (!view) return;
    loadEditor(view, params);
  },

  sync() {
    const titles = { cloud: '实例', control: '集控配置', schedule: '档案管理', source: '文件预览' };
    const view = this.current || 'cloud';
    const hasInstance = !!subAuth.terminalId;

    const titleEl = subEl('explorerTitle');
    if (titleEl) titleEl.textContent = titles[view] || '实例';

    const archive = subEl('explorerB');
    if (archive) archive.style.display = view === 'schedule' ? 'block' : 'none';

    // 与主面板相反：隐藏「新建实例」，显示「刷新可管理实例」
    const addBtn = subEl('explorer-add-btn');
    if (addBtn) addBtn.style.display = 'none';
    const refreshBtn = subEl('explorer-refresh-btn');
    if (refreshBtn) refreshBtn.style.display = '';

    // 认证区块在子用户面板里常驻显示
    const auth = subEl('subuser-auth');
    if (auth) auth.style.display = '';

    const caption = subEl('subuser-instance-caption');
    if (caption) {
      caption.textContent = '可管理实例（' + subAuth.terminals.length + '）';
      caption.style.display = (view === 'cloud' && subAuth.terminals.length) ? 'block' : 'none';
    }

    // 与主面板一致：列表只在「实例」视图显示
    const cloudList = subEl('cloud-list');
    if (cloudList) cloudList.style.display = view === 'cloud' ? 'block' : 'none';

    const welcome = subEl('subuser-welcome');
    if (welcome) welcome.style.display = hasInstance ? 'none' : 'block';

    const pane = subEl('subuser-instance-pane');
    if (pane) pane.style.display = (view === 'cloud' && hasInstance) ? 'block' : 'none';

    const frame = subEl('editor-frame');
    if (frame) frame.style.display = (hasInstance && view !== 'cloud') ? 'block' : 'none';

    const saveBtn = subEl('save-button');
    if (saveBtn) saveBtn.disabled = !hasInstance;

    // 档案区块的列表（与主面板一致：只在需要时初始化一次）
    if (view === 'schedule' && hasInstance) {
      try {
        if (!window.__scheduleInitialized) { schedule.init(); window.__scheduleInitialized = true; }
        if (!window.__subjectsInitialized) { subjects.init(); window.__subjectsInitialized = true; }
      } catch (e) { console.warn('初始化档案区块失败', e); }
    }

    // 实例信息（复用 .directoryId / .configId 约定）
    try {
      document.querySelectorAll('.directoryId').forEach((el) => { el.textContent = subAuth.dir || ''; });
      document.querySelectorAll('.configId').forEach((el) => { el.textContent = subAuth.terminalId || ''; });
      const urlEl = subEl('subuser-url');
      if (urlEl) urlEl.textContent = this.instanceUrl();
      const userEl = subEl('subuser-current-user');
      if (userEl) userEl.textContent = subAuth.username || '未登录';
      const countEl = subEl('subuser-current-count');
      if (countEl) countEl.textContent = String(subAuth.terminals.length);
    } catch { }
  },

  instanceUrl() {
    if (!subAuth.dir || !subAuth.terminalId) return '';
    return 'https://cloud.smart-teach.cn/user/' + subAuth.dir + '/' + subAuth.terminalId + '.cses';
  }
};

/* ===================== 编辑器 iframe ===================== */

/* 与 main.js 保持一致：生产环境的编辑器页面位于 ./dev/pages/editor/ 下 */
function subEditorUrl(view, params) {
  let u = `dev/pages/editor/${view}.html`;
  if (params && typeof params === 'object') {
    const p = new URLSearchParams();
    Object.keys(params).forEach((k) => {
      if (params[k] !== undefined && params[k] !== null) p.set(k, String(params[k]));
    });
    const q = p.toString();
    if (q) u += `?${q}`;
  }
  return u;
}

function loadEditor(view, params) {
  try {
    const iframe = subEl('editor-frame');
    if (!iframe) return;
    window.__lastEditorView = view;
    window.__lastEditorParams = params || null;
    try { showLoading(2, '正在加载编辑器'); } catch { }
    const url = subEditorUrl(view, params);
    try { iframe.style.visibility = 'hidden'; } catch { }
    iframe.onload = function () {
      try { iframe.style.visibility = 'visible'; } catch { }
      try { closeLoading(2); } catch { }
    };
    iframe.src = url;
  } catch (e) {
    console.warn('loadEditor failed', e);
  }
}

function setEditorSrc(view, params) {
  try {
    if (view === 'cloud' || view === 'control' || view === 'schedule' || view === 'source') {
      subView.current = view;
      document.querySelectorAll('.activity-item').forEach((i) => {
        i.classList.toggle('selected', i.dataset.view === view);
      });
      subView.showEditor(view === 'cloud' ? null : view, params);
      subView.sync();
      return;
    }
    // 档案区块的二级编辑器（change / time / subject）只替换 iframe
    if (subView.current === 'cloud') subView.current = 'schedule';
    subView.showEditor(view, params);
    subView.sync();
  } catch (e) {
    console.warn('setEditorSrc failed', e);
  }
}

/* ===================== 全局绑定 ===================== */

try { window.saveToCloud = saveToCloud; } catch { }
try { window.setEditorSrc = setEditorSrc; } catch { }
try { window.retryEditorLoad = function () { if (window.__lastEditorView) loadEditor(window.__lastEditorView, window.__lastEditorParams || undefined); }; } catch { }

window.addEventListener('message', (e) => {
  try {
    const d = (e && e.data) || {};
    if (d.type === 'iframe-start') { showLoading(2, '正在加载编辑器'); }
    else if (d.type === 'iframe-log') { if (typeof appendLoadingLog === 'function') appendLoadingLog(d.text || ''); }
    else if (d.type === 'iframe-ready') { closeLoading(2); }
  } catch { }
});

document.addEventListener('keydown', (e) => {
  try {
    if (e.key && e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      subAuth.save();
    }
  } catch { }
});

document.addEventListener('DOMContentLoaded', () => {
  try { storage.init(); } catch { }
  try { storage.initEnv(); } catch { }
  subView.init();
  subView.toggle('cloud', false);
  subAuth.restore();
  subView.sync();
});

try {
  window.subAuth = subAuth;
  window.subView = subView;
} catch { }
