var currentTerminalId = localStorage.getItem("currentTerminalId");
let directoryId = null;

const terminal = {
  init() {
    showLoading(2, "正在拉取列表");
    const select = document.getElementById("cloud-list");
    select.innerHTML = "<center style='margin: 20px;'>正在加载实例列表...</center>";
    fetch(`function.php?action=getId`)
      .then((response) => {
        if (!response.ok) {
          alert("与服务器建立连接出现问题，确保您已连接网络，等待几分钟后刷新网页重试");
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          document.querySelectorAll(".directoryId").forEach((el) => {
            el.textContent = data.directoryId;
          });
          directoryId = data.directoryId;
          try { localStorage.setItem('directoryId', directoryId); } catch {}
          fetch(`function.php?action=listTerminals`)
            .then((r) => {
              if (!r.ok) {
                throw new Error(`HTTP error! status: ${r.status}`);
              }
              return r.json();
            })
            .then((d) => {
              if (d.success && d.terminals.length > 0) {
                if (!currentTerminalId) currentTerminalId = d.terminals[0];
                this.updateTag();
                this.controlLoad();
                try {
                  const p = new URLSearchParams(window.location.search);
                  p.set('terminal', currentTerminalId);
                  history.replaceState(null, '', `${location.pathname}?${p.toString()}${location.hash}`);
                } catch {}
              }
              const terminals = d.terminals;
              select.innerHTML = "";
              terminals.forEach((t) => {
                const option = document.createElement("fluent-option");
                option.value = t;
                option.className = "explorer-item";
                option.innerHTML = `<i class="bi bi-terminal"></i>&nbsp;` + t;
                option.onclick = () => {
                  terminal.load(option.value);
                };
                option.addEventListener("contextmenu", (e) => {
                  e.preventDefault();
                  terminal.delUI(option.value);
                });
                select.appendChild(option);
              });
              if (terminals.length > 0) select.value = currentTerminalId;
              closeLoading(2);
            })
            .catch(error => {
              console.error('Error listing terminals:', error);
              select.innerHTML = "<center style='margin: 20px;'>加载实例列表失败</center>";
              closeLoading(2);
            });
        } else {
          throw new Error('Failed to get directory ID');
        }
      })
      .catch(error => {
        console.error('Error fetching directory ID:', error);
        select.innerHTML = "<center style='margin: 20px;'>获取目录ID失败</center>";
        alert("获取目录ID时出错，稍等几分钟后刷新网页或许能解决问题");
        closeLoading(2);
      });
  },
  load(terminalId, push) {
    currentTerminalId = terminalId;
    localStorage.setItem("currentTerminalId", terminalId);
    this.updateTag();
    // 切换实例时先套用该实例上次选择的导出格式（没有记录则跟随配置文件版本）
    try { storage.applyInstanceOutputMode(terminalId); } catch (e) { console.warn('applyInstanceOutputMode failed', e); }
    try {
      if (push !== false) {
        const p = new URLSearchParams(window.location.search);
        p.set('terminal', terminalId);
        history.pushState(null, '', `${location.pathname}?${p.toString()}${location.hash}`);
      }
    } catch {}
    this.controlLoad();
  },
  async controlLoad() {
    try {
      const terminalId = localStorage.getItem("currentTerminalId");
      if (terminalId == null) {
        throw new Error("您尚未选择实例，请选择/创建一个实例");
      }
      showLoading(2);
      const response = await fetch(`function.php?action=load&terminalId=${encodeURIComponent(terminalId)}`);
      const config = await response.text();
      // keepOutputMode：打开实例时保留本机为该实例选定的导出格式，不要被文件里的版本改掉
      file.importS(config, false, { keepOutputMode: true });

      // 加载共享配置
      // const shareResponse = await fetch(`function.php?action=getSpaceConfig&terminalId=${encodeURIComponent(terminalId)}`);
      // if (shareResponse.ok) {
      //   const shareData = await shareResponse.json();
      //   updateShareUI(shareData.config);
      // }
      try {
        const win = document.getElementById('editor-frame')?.contentWindow;
        if (win && win.controlMgr) { win.controlMgr.init(); }
      } catch {}
      closeLoading(2);
    } catch (error) {
      alert("加载配置" + error);
    }
  },
  add(a) {
    const newTerminalId = a;
    fetch("function.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `terminalId=${encodeURIComponent(newTerminalId)}&config=`,
    }).then(() => {
      currentTerminalId = newTerminalId;
      localStorage.setItem("currentTerminalId", newTerminalId);
      terminal.init();
    });
  },
  del(a) {
    try {
      fetch(
        `function.php?action=del&terminalId=${encodeURIComponent(a)}`
      );
      terminal.init();
    } catch (error) {
      console.error("删除失败:", error);
    }
  },
  updateTag() {
    document.querySelectorAll(".configId").forEach((el) => { el.textContent = currentTerminalId; });
    try {
      const win = document.getElementById('editor-frame')?.contentWindow;
      const doc = win && win.document;
      if (doc) {
        Array.from(doc.querySelectorAll('.configId')).forEach((el)=>{ el.textContent = currentTerminalId; });
        Array.from(doc.querySelectorAll('.directoryId')).forEach((el)=>{ el.textContent = localStorage.getItem('directoryId') || ''; });
      }
    } catch {}
    // trickAnimation();
  },
  addUI() {
    prompt("输入新实例ID", (a) => {
      if (a) {
        terminal.add(a);
      }
    });
  },
  delUI(b) {
    confirm(
      "确认删除实例：" + b + " 吗？删除后不可恢复",
      (a, b) => {
        if (a) {
          terminal.del(b);
        }
      },
      b
    );
  },
};

/* =========================================================================
 * 子用户（实例组级）
 * -------------------------------------------------------------------------
 * 数据由 function/subuser.php 维护：user/<实例组标识>/_subusers.json
 *   - 主人侧操作需要登录态（addSubUser / delSubUser / setSubAllowed / getSubUsers）
 *   - 子用户面板用「实例组标识 + 用户名 + 密钥」认证（subList / subLoad / subSave，全部 POST）
 *
 * 顺带修掉的问题：
 *   - copyText / flashIcon 原先只写在没有被任何页面引入的 cloud_subusers.js 里，
 *     导致主人面板里「显示密钥 / 复制密钥」直接 ReferenceError。
 *   - 旧实现按 <实例ID>_subusers.json 存储，verifyInDir 遍历目录取第一个同名用户，
 *     同名子用户会互相污染；现在子用户名在实例组内唯一。
 * ========================================================================= */

const ownerSubState = {
  terminalId: '',
  instances: [],
  users: [],
  scopeUser: '',
  scopeAll: true
};

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function flashIcon(el) {
  try {
    el.style.transform = 'scale(1.12)';
    setTimeout(() => { el.style.transform = ''; }, 300);
  } catch { }
}

function copyText(t, icon) {
  const done = () => {
    if (!icon) return;
    const prev = icon.className;
    icon.className = 'bi bi-check';
    flashIcon(icon);
    setTimeout(() => { icon.className = prev; }, 700);
  };
  let ok = false;
  try {
    const handler = (e) => { try { e.clipboardData.setData('text/plain', t); e.preventDefault(); } catch {} };
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
      try { ta.setSelectionRange(0, ta.value.length); } catch {}
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch { }
  }
  if (ok) { done(); return true; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(done).catch(() => { try { prompt('复制失败，请手动复制：', t); } catch {} });
    return false;
  }
  try { prompt('复制失败，请手动复制：', t); } catch { }
  return false;
}

function isStrongSecret(s) {
  try {
    if (!s || s.length < 8) return false;
    if (!/[a-z]/.test(s)) return false;
    if (!/[A-Z]/.test(s)) return false;
    if (!/\d/.test(s)) return false;
    if (!/[^a-zA-Z\d]/.test(s)) return false;
    return true;
  } catch { return false }
}

/** 子用户面板入口：只带实例组标识，凭据由子用户自行输入（避免进入 URL / 历史 / 访问日志） */
function openSubPanel() {
  let dir = '';
  try {
    dir = (localStorage.getItem('directoryId') || document.querySelector('.directoryId')?.textContent || '').trim();
  } catch { }
  if (!dir) { alert('尚未获取到实例组标识，请刷新页面后重试'); return; }
  window.open(`/subuser.php?dir=${encodeURIComponent(dir)}`, '_blank');
}

async function ownerSubGet(action, params) {
  const q = new URLSearchParams(Object.assign({ action: action }, params || {}));
  const r = await fetch(`function.php?${q.toString()}`);
  return await r.json();
}

async function ownerSubPost(params) {
  const body = new URLSearchParams();
  Object.keys(params).forEach((k) => body.append(k, params[k] == null ? '' : params[k]));
  const r = await fetch('function.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  return await r.json();
}

function openOwnerSubModal() {
  try {
    const dlg = document.getElementById('owner-subuser-dialog');
    if (dlg && typeof dlg.show === 'function') dlg.show();
    else if (dlg) { dlg.hidden = false; }
  } catch {}
  try { ownerSub_load(); } catch {}
}

function closeOwnerSubModal() {
  const dlg = document.getElementById('owner-subuser-dialog');
  if (dlg && typeof dlg.hide === 'function') dlg.hide();
  else if (dlg) dlg.hidden = true;
}

async function ownerSub_load() {
  const tbody = document.getElementById('owner-subuser-tbody');
  if (!tbody) { console.warn('owner-subuser-tbody not found'); return; }
  const terminalId = localStorage.getItem('currentTerminalId') || '';
  ownerSubState.terminalId = terminalId;
  if (!terminalId) { tbody.innerHTML = '<tr><td colspan="4" class="subuser-empty">未选择实例</td></tr>'; return; }
  tbody.innerHTML = '<tr><td colspan="4" class="subuser-empty">加载中...</td></tr>';
  try {
    const d = await ownerSubGet('getSubUsers', { terminalId: terminalId });
    if (!d.success) {
      tbody.innerHTML = `<tr><td colspan="4" class="subuser-empty">${escapeHtml(d.error || '加载失败')}</td></tr>`;
      return;
    }
    ownerSubState.instances = d.instances || [];
    ownerSubState.users = d.users || [];
    ownerSub_render();
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4" class="subuser-empty">加载失败</td></tr>';
  }
}

function ownerSub_scopeText(u) {
  const allowed = Array.isArray(u.allowed) ? u.allowed : [];
  if (allowed.indexOf('*') >= 0) return '全部实例';
  if (allowed.length === 0) return '未授权任何实例';
  return allowed.join('、');
}

function ownerSub_makeIcon(cls, title, handler) {
  const i = document.createElement('i');
  i.className = 'bi ' + cls + ' icon-anim subuser-icon';
  i.title = title;
  i.addEventListener('click', handler);
  return i;
}

/* fluent-checkbox 没有原生 input，label 点击不会自动切换，这里补上 */
function ownerSub_labelToggle(e, id) {
  const el = document.getElementById(id);
  if (!el || el.disabled) return;
  try { if (e && e.target && e.target.closest && e.target.closest('fluent-checkbox')) return; } catch { }
  el.checked = !el.checked;
  if (e && e.preventDefault) e.preventDefault();
}

function ownerSub_render() {
  const tbody = document.getElementById('owner-subuser-tbody');
  if (!tbody) return;
  const users = ownerSubState.users;
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="subuser-empty">暂无子用户</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  users.forEach((u) => {
    const tr = document.createElement('tr');
    // td 不能用 display:flex（会破坏表格布局），flex 放到内层 span 上
    const cell = () => {
      const td = document.createElement('td');
      td.className = 'subuser-cell';
      const inner = document.createElement('span');
      inner.className = 'subuser-cell-inner';
      td.appendChild(inner);
      return { td: td, inner: inner };
    };

    /* 用户名 */
    const nameCell = cell();
    const nameSpan = document.createElement('span');
    nameSpan.className = 'ellipsis';
    nameSpan.title = u.username;
    nameSpan.textContent = u.username;
    nameCell.inner.appendChild(nameSpan);
    const nameCopy = ownerSub_makeIcon('bi-clipboard', '复制用户名', () => copyText(u.username, nameCopy));
    nameCell.inner.appendChild(nameCopy);

    /* 可管理实例 */
    const scopeCell = cell();
    const scopeSpan = document.createElement('span');
    scopeSpan.className = 'ellipsis';
    scopeSpan.title = ownerSub_scopeText(u);
    scopeSpan.textContent = ownerSub_scopeText(u);
    scopeCell.inner.appendChild(scopeSpan);
    scopeCell.inner.appendChild(ownerSub_makeIcon('bi-pencil-square', '编辑可管理实例', () => ownerSub_openScope(u.username)));

    /* 密钥（默认隐藏，按需向后端索取） */
    let secretText = '';
    const secretCell = cell();
    const secSpan = document.createElement('span');
    secSpan.className = 'ellipsis';
    secSpan.textContent = '••••••••';
    secSpan.title = '点击右侧眼睛显示密钥';
    secretCell.inner.appendChild(secSpan);
    const eye = ownerSub_makeIcon('bi-eye', '显示/隐藏密钥', async () => {
      if (secSpan.textContent === '••••••••') {
        if (!secretText) {
          try {
            const d = await ownerSubGet('getSubSecret', { terminalId: ownerSubState.terminalId, username: u.username });
            if (!d.success) { alert(d.error || '读取密钥失败'); return; }
            secretText = d.secret || '';
          } catch (e) { alert('读取密钥失败'); return; }
        }
        secSpan.textContent = secretText || '（未记录明文）';
        secSpan.title = secretText;
        eye.className = 'bi bi-eye-slash icon-anim subuser-icon';
      } else {
        secSpan.textContent = '••••••••';
        secSpan.title = '点击右侧眼睛显示密钥';
        eye.className = 'bi bi-eye icon-anim subuser-icon';
      }
    });
    secretCell.inner.appendChild(eye);
    secretCell.inner.appendChild(ownerSub_makeIcon('bi-clipboard', '复制密钥', async () => {
      if (!secretText) {
        try {
          const d = await ownerSubGet('getSubSecret', { terminalId: ownerSubState.terminalId, username: u.username });
          if (d.success) secretText = d.secret || '';
        } catch { }
      }
      if (!secretText) { alert('无法读取该子用户的密钥，请重置密码'); return; }
      copyText(secretText, null);
    }));

    /* 操作 */
    const tdOps = document.createElement('td');
    tdOps.className = 'subuser-ops';
    const del = document.createElement('fluent-button');
    del.innerHTML = '<i class="bi bi-trash"></i>';
    del.title = '删除子用户';
    del.addEventListener('click', () => ownerSub_delete(u.username));
    tdOps.appendChild(del);

    tr.appendChild(nameCell.td);
    tr.appendChild(scopeCell.td);
    tr.appendChild(secretCell.td);
    tr.appendChild(tdOps);
    tbody.appendChild(tr);
  });
}

async function ownerSub_add() {
  const terminalId = localStorage.getItem('currentTerminalId') || '';
  const nameEl = document.getElementById('owner-subuser-name');
  const passEl = document.getElementById('owner-subuser-pass');
  const name = (nameEl && nameEl.value ? nameEl.value : '').trim();
  const pwd = passEl && passEl.value ? passEl.value : '';
  if (!terminalId) { alert('请先选择实例'); return; }
  if (!name) { alert('请输入子用户名'); return; }
  if (pwd && !isStrongSecret(pwd)) { alert('密钥强度不足：至少8位，需包含大小写字母、数字与特殊字符'); return; }
  const onlyCurrent = !!(document.getElementById('owner-subuser-only-current') || {}).checked;
  try {
    const d = await ownerSubPost({
      action: 'addSubUser',
      terminalId: terminalId,
      username: name,
      secret: pwd,
      allowed: onlyCurrent ? terminalId : '*'
    });
    if (!d.success) { alert('创建失败: ' + (d.error || '未知错误')); return; }
    if (nameEl) nameEl.value = '';
    if (passEl) passEl.value = '';
    const st = document.getElementById('owner-subuser-strength');
    if (st) st.textContent = '';
    const onlyEl = document.getElementById('owner-subuser-only-current');
    if (onlyEl) onlyEl.checked = false;
    ownerSub_load();
    if (d.secret) {
      // 随机生成的密钥只在创建时完整可见，这里提示主人立即保存
      copyText(d.secret, null);
      alert('已创建子用户 ' + escapeHtml(d.username) + '<br>密钥：<b>' + escapeHtml(d.secret) +
        '</b><br>（已尝试复制到剪贴板，请妥善保存）');
    }
  } catch (e) { alert('创建失败'); }
}

async function ownerSub_delete(name) {
  const terminalId = ownerSubState.terminalId || localStorage.getItem('currentTerminalId') || '';
  if (!terminalId) return;
  confirm(`确认删除子用户 ${escapeHtml(name)} 吗？删除后该密钥立即失效。`, async (ok) => {
    if (!ok) return;
    try {
      const d = await ownerSubPost({ action: 'delSubUser', terminalId: terminalId, username: name });
      if (d.success) { ownerSub_load(); } else { alert('删除失败: ' + (d.error || '未知错误')); }
    } catch (e) { alert('删除失败'); }
  });
}

/* ---------- 可管理实例范围编辑 ---------- */

function ownerSub_renderScope() {
  const box = document.getElementById('owner-subuser-scope-list');
  if (!box) return;
  box.innerHTML = '';
  const instances = ownerSubState.instances || [];
  if (!instances.length) {
    const empty = document.createElement('div');
    empty.className = 'subuser-hint';
    empty.textContent = '该实例组下还没有实例';
    box.appendChild(empty);
    return;
  }
  const selected = (ownerSubState.users.find((u) => u.username === ownerSubState.scopeUser) || {}).allowed || [];
  instances.forEach((tid) => {
    const label = document.createElement('label');
    label.className = 'subuser-scope-item';
    const cb = document.createElement('fluent-checkbox');
    cb.checked = selected.indexOf('*') >= 0 || selected.indexOf(tid) >= 0;
    cb.disabled = ownerSubState.scopeAll;
    const span = document.createElement('span');
    span.textContent = tid;
    span.title = tid;
    label.appendChild(cb);
    label.appendChild(span);
    label.addEventListener('click', (e) => {
      if (cb.disabled) return;
      try { if (e.target && e.target.closest && e.target.closest('fluent-checkbox')) return; } catch { }
      cb.checked = !cb.checked;
      e.preventDefault();
    });
    box.appendChild(label);
  });
}

function ownerSub_openScope(username) {
  ownerSubState.scopeUser = username;
  const user = ownerSubState.users.find((u) => u.username === username) || {};
  const allowed = Array.isArray(user.allowed) ? user.allowed : [];
  ownerSubState.scopeAll = allowed.indexOf('*') >= 0;
  const nameEl = document.getElementById('owner-subuser-scope-name');
  if (nameEl) nameEl.textContent = username;
  const allEl = document.getElementById('owner-subuser-scope-all');
  if (allEl) allEl.checked = ownerSubState.scopeAll;
  ownerSub_renderScope();
  try {
    const dlg = document.getElementById('owner-subuser-scope-dialog');
    if (dlg && typeof dlg.show === 'function') dlg.show();
    else if (dlg) dlg.hidden = false;
  } catch {}
}

function closeOwnerSubScope() {
  const dlg = document.getElementById('owner-subuser-scope-dialog');
  if (dlg && typeof dlg.hide === 'function') dlg.hide();
  else if (dlg) dlg.hidden = true;
}

function ownerSub_scopeAllChanged() {
  const allEl = document.getElementById('owner-subuser-scope-all');
  ownerSubState.scopeAll = !!(allEl && allEl.checked);
  const box = document.getElementById('owner-subuser-scope-list');
  if (box) {
    Array.from(box.querySelectorAll('fluent-checkbox')).forEach((cb) => { cb.disabled = ownerSubState.scopeAll; });
  }
}

async function ownerSub_scopeSave() {
  const username = ownerSubState.scopeUser;
  const allEl = document.getElementById('owner-subuser-scope-all');
  const all = !!(allEl && allEl.checked);
  let allowed = '*';
  if (!all) {
    const box = document.getElementById('owner-subuser-scope-list');
    const picked = [];
    if (box) {
      Array.from(box.querySelectorAll('fluent-checkbox')).forEach((cb, i) => {
        if (cb.checked && ownerSubState.instances[i]) picked.push(ownerSubState.instances[i]);
      });
    }
    if (!picked.length) { alert('请至少勾选一个实例，或开启「全部实例」'); return; }
    allowed = picked.join(',');
  }
  try {
    const d = await ownerSubPost({ action: 'setSubAllowed', terminalId: ownerSubState.terminalId, username: username, allowed: allowed });
    if (!d.success) { alert('保存失败: ' + (d.error || '未知错误')); return; }
    closeOwnerSubScope();
    ownerSub_load();
  } catch (e) { alert('保存失败'); }
}

/* ---------- 共享空间 - 尚未开始继续开发 ---------- */
function updateShareUI(config) {
  return;

  const shareSwitch = document.getElementById('share-switch');
  const shareMode = document.getElementById('share-mode');
  const passwordCard = document.getElementById('password-card');
  const whitelistCard = document.getElementById('whitelist-card');

  shareSwitch.checked = config.enabled || false;
  shareMode.value = config.mode || 'password';
  document.getElementById('share-password').value = config.password || '';
  document.getElementById('share-whitelist').value = (config.whitelist || []).join(', ');

  // 更新UI显示状态
  toggleShareSettings();
}
// 显示/隐藏共享设置
function toggleShareSettings() {
  const enabled = document.getElementById('share-switch').checked;
  document.getElementById('share-mode-card').style.display = enabled ? 'flex' : 'none';
  if (!enabled) {
    document.getElementById('password-card').style.display = 'none';
    document.getElementById('whitelist-card').style.display = 'none';
  } else {
    toggleAuthMethod();
  }
}

document.getElementById('share-mode')?.addEventListener('change', function () {
  if (this.value === 'password') {
    document.getElementById('share-whitelist').value = '';
  } else {
    document.getElementById('share-password').value = '';
  }
});

function toggleAuthMethod() {
  const mode = document.getElementById('share-mode').value;
  document.getElementById('password-card').style.display = mode === 'password' ? 'flex' : 'none';
  document.getElementById('whitelist-card').style.display = mode === 'whitelist' ? 'flex' : 'none';
}

// 保存空间配置
async function saveSpaceConfig() {
  const terminalId = localStorage.getItem("currentTerminalId");
  const enabled = document.getElementById('share-switch').checked;
  const mode = document.getElementById('share-mode').value;
  const password = document.getElementById('share-password').value;
  const whitelist = document.getElementById('share-whitelist').value.split(',').map(id => id.trim()).join(',');

  const formData = new URLSearchParams();
  formData.append('terminalId', terminalId);
  formData.append('enabled', enabled ? 'true' : 'false'); // 转换为字符串
  formData.append('mode', mode);
  formData.append('password', password);
  formData.append('whitelist', whitelist);

  try {
    const response = await fetch('function.php?action=spaceConfig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });
    const result = await response.json();
    alert(result.success ? '保存成功' : '保存失败: ' + result.error);
  } catch (error) {
    console.error('保存失败:', error);
    alert('保存配置时发生错误');
  }
}

async function joinSpace() {
  const targetUser = document.getElementById('target-user').value;
  const targetTerminal = document.getElementById('target-terminal').value;
  const localTerminal = document.getElementById('local-terminal').value || targetTerminal;

  if (!targetUser || !targetTerminal || !localTerminal) {
    alert('请填写所有必填字段');
    return;
  }

  let password = '';
  if (confirm('是否需要密码访问？')) {
    password = prompt('请输入访问密码');
  }

  try {
    const response = await fetch(`function.php?action=joinSpace&targetUser=${encodeURIComponent(targetUser)}&targetTerminal=${encodeURIComponent(targetTerminal)}&localTerminal=${encodeURIComponent(localTerminal)}&password=${encodeURIComponent(password)}`);
    const result = await response.json();
    if (result.success) {
      alert('成功加入共享空间！');
      location.reload(); // 刷新以加载新实例
    } else {
      alert('加入失败: ' + result.error);
    }
  } catch (error) {
    console.error('加入失败:', error);
    alert('请求过程中发生错误');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const dlgInit = document.getElementById('owner-subuser-dialog');
  if (dlgInit) dlgInit.hidden = true;
  const scopeInit = document.getElementById('owner-subuser-scope-dialog');
  if (scopeInit) scopeInit.hidden = true;
  const pass = document.getElementById('owner-subuser-pass');
  if (pass) pass.addEventListener('input', () => {
    const s = pass.value;
    const el = document.getElementById('owner-subuser-strength');
    if (!el) return;
    if (!s) { el.textContent = ''; return; }
    let score = 0;
    if (s.length >= 8) score++;
    if (/[a-z]/.test(s)) score++;
    if (/[A-Z]/.test(s)) score++;
    if (/\d/.test(s)) score++;
    if (/[^a-zA-Z\d]/.test(s)) score++;
    const txt = ['很弱', '弱', '一般', '良好', '较强'];
    el.textContent = txt[Math.max(0, score - 1)];
  });
});

try {
  window.copyText = window.copyText || copyText;
  window.flashIcon = window.flashIcon || flashIcon;
} catch {}
