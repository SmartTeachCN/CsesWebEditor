function copyText(t, icon) {
  let ok = false;
  try {
    const handler = (e) => { try { e.clipboardData.setData('text/plain', t); e.preventDefault(); } catch {} };
    document.addEventListener('copy', handler);
    ok = document.execCommand('copy');
    document.removeEventListener('copy', handler);
  } catch {}
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
    } catch {}
  }
  if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      navigator.clipboard.writeText(t).then(() => {
        const prev = icon && icon.className;
        if (icon) { icon.className = 'bi bi-check'; flashIcon(icon); setTimeout(() => { icon.className = prev; }, 600); }
      }).catch(() => {
        try { prompt('复制失败，请手动复制：', t); } catch {}
      });
      return false;
    } catch {}
  }
  if (!ok) {
    try { prompt('复制失败，请手动复制：', t); } catch {}
  }
  if (ok && icon) {
    const prev = icon.className;
    icon.className = 'bi bi-check';
    flashIcon(icon);
    setTimeout(() => { icon.className = prev; }, 600);
  }
  return ok;
}

function copyUrl(btn) {
  try {
    const icon = btn && btn.querySelector('i');
    const text = document.getElementById('url2')?.textContent || '';
    if (text) copyText(text, icon);
  } catch { }
}

async function loadSubUsers() {
  const listEl = document.getElementById('subuser-list');
  const terminalId = localStorage.getItem('currentTerminalId');
  if (!terminalId) { listEl.innerHTML = '未选择实例'; return; }
  listEl.innerHTML = '<center style="margin:10px">正在加载子用户...</center>';
  try {
    const r = await fetch(`function.php?action=getSubUsers&terminalId=${encodeURIComponent(terminalId)}`);
    const d = await r.json();
    if (!d.success) { listEl.innerHTML = '加载失败'; return; }
    if (!d.users || d.users.length === 0) { listEl.innerHTML = '<center style="margin:10px">暂无子用户</center>'; return; }
    listEl.innerHTML = '';
    d.users.forEach(u => {
      const row = document.createElement('div');
      row.className = 'subuser-row';
      const name = document.createElement('span');
      name.textContent = u.username;
      const btns = document.createElement('div');
      const del = document.createElement('fluent-button');
      del.innerHTML = '<i class="bi bi-trash"></i>';
      del.title = '删除';
      del.addEventListener('click', () => delSubUser(u.username));
      btns.appendChild(del);
      row.appendChild(name);
      row.appendChild(btns);
      listEl.appendChild(row);
    });
  } catch (e) {
    listEl.innerHTML = '加载失败';
  }
}

function openOwnerSubModal() {
  const dlg = document.getElementById('owner-subuser-dialog');
  if (dlg && typeof dlg.show === 'function') dlg.show();
  ownerSub_load();
}
function closeOwnerSubModal() {
  const dlg = document.getElementById('owner-subuser-dialog');
  if (dlg && typeof dlg.hide === 'function') dlg.hide();
}

async function ownerSub_load() {
  const tableBody = document.getElementById('owner-subuser-tbody');
  const terminalId = localStorage.getItem('currentTerminalId');
  if (!terminalId) { tableBody.innerHTML = '<tr><td colspan="3">未选择实例</td></tr>'; return; }
  tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">加载中...</td></tr>';
  try {
    const r = await fetch(`function.php?action=getSubUsers&terminalId=${encodeURIComponent(terminalId)}`);
    const d = await r.json();
    if (!d.success) { tableBody.innerHTML = '<tr><td colspan="3">加载失败</td></tr>'; return; }
    const users = d.users || [];
    if (users.length === 0) { tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">暂无子用户</td></tr>'; return; }
    tableBody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.style.userSelect = 'text';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = u.username;
      nameSpan.style.userSelect = 'text';
      const nameIcons = document.createElement('span');
      nameIcons.style.marginLeft = '8px';
      const nameCopy = document.createElement('i');
      nameCopy.className = 'bi bi-clipboard';
      nameCopy.style.cursor = 'pointer';
      nameCopy.classList.add('icon-anim');
      nameCopy.id = `owner-subuser-nameclip-${u.username}`;
      nameCopy.dataset.name = u.username;
      nameIcons.appendChild(nameCopy);
      td1.appendChild(nameSpan);
      td1.appendChild(nameIcons);
      const tdSecret = document.createElement('td');
      tdSecret.style.userSelect = 'text';
      const secSpan = document.createElement('span');
      secSpan.textContent = '***';
      secSpan.id = `owner-subuser-secret-${u.username}`;
      const iconBox = document.createElement('span');
      iconBox.style.marginLeft = '8px';
      const eye = document.createElement('i');
      eye.className = 'bi bi-eye';
      eye.id = `owner-subuser-eye-${u.username}`;
      eye.style.cursor = 'pointer';
      eye.style.marginRight = '8px';
      eye.classList.add('icon-anim');
      eye.dataset.name = u.username;
      const clip = document.createElement('i');
      clip.className = 'bi bi-clipboard';
      clip.id = `owner-subuser-clip-${u.username}`;
      clip.style.cursor = 'pointer';
      clip.classList.add('icon-anim');
      clip.dataset.name = u.username;
      iconBox.appendChild(eye);
      iconBox.appendChild(clip);
      tdSecret.appendChild(secSpan);
      tdSecret.appendChild(iconBox);
      const td2 = document.createElement('td');
      td2.style.textAlign = 'right';
      const del = document.createElement('fluent-button');
      del.innerHTML = '<i class="bi bi-trash"></i>';
      del.title = '删除';
      del.addEventListener('click', () => ownerSub_delete(u.username));
      td2.appendChild(del);
      tr.appendChild(td1);
      tr.appendChild(tdSecret);
      tr.appendChild(td2);
      tableBody.appendChild(tr);
    });
  } catch (e) {
    tableBody.innerHTML = '<tr><td colspan="3">加载失败</td></tr>';
  }
  enhanceSubuserTable();
  bindSubuserDelegates();
}

async function ownerSub_add() {
  const terminalId = localStorage.getItem('currentTerminalId');
  const name = document.getElementById('owner-subuser-name').value.trim();
  const pwd = document.getElementById('owner-subuser-pass').value;
  if (!terminalId) { alert('请先选择实例'); return; }
  if (!name) { alert('请输入子用户名'); return; }
  if (pwd && !isStrongSecret(pwd)) { alert('密码强度不足：至少8位，需包含大小写字母、数字与特殊字符'); return; }
  const body = new URLSearchParams();
  body.append('action', 'addSubUser');
  body.append('terminalId', terminalId);
  body.append('username', name);
  if (pwd) body.append('secret', pwd);
  try {
    const r = await fetch('function.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const d = await r.json();
    if (d.success) {
      document.getElementById('owner-subuser-name').value = '';
      document.getElementById('owner-subuser-pass').value = '';
      document.getElementById('owner-subuser-strength').textContent = '';
      ownerSub_load();
    } else {
      alert('创建失败: ' + d.error);
    }
  } catch (e) { alert('创建失败'); }
}

async function ownerSub_delete(name) {
  const terminalId = localStorage.getItem('currentTerminalId');
  if (!terminalId) return;
  confirm(`确认删除子用户 ${name} 吗？`, async (ok) => {
    if (!ok) return;
    const body = new URLSearchParams();
    body.append('action', 'delSubUser');
    body.append('terminalId', terminalId);
    body.append('username', name);
    const r = await fetch('function.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const d = await r.json();
    if (d.success) { ownerSub_load(); } else { alert('删除失败: ' + d.error); }
  });
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

function openSubPanel() {
  const dirText = document.querySelector('.directoryId')?.textContent || '';
  const tid = localStorage.getItem('currentTerminalId') || '';
  const url = `/subuser.html?dir=${encodeURIComponent(dirText)}&tid=${encodeURIComponent(tid)}`;
  window.open(url, '_blank');
}

async function delSubUser(name) {
  const terminalId = localStorage.getItem('currentTerminalId');
  if (!terminalId) return;
  confirm(`确认删除子用户 ${name} 吗？`, async (ok) => {
    if (!ok) return;
    const body = new URLSearchParams();
    body.append('action', 'delSubUser');
    body.append('terminalId', terminalId);
    body.append('username', name);
    const r = await fetch('function.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const d = await r.json();
    if (d.success) { loadSubUsers(); } else { alert('删除失败: ' + d.error); }
  });
}

async function ownerSub_toggle(name) {
  const terminalId = localStorage.getItem('currentTerminalId');
  const cell = document.getElementById(`owner-subuser-secret-${name}`);
  const eye = document.getElementById(`owner-subuser-eye-${name}`);
  if (!cell || !terminalId) return;
  if (cell.textContent === '***') {
    try {
      const r = await fetch(`function.php?action=getSubSecret&terminalId=${encodeURIComponent(terminalId)}&username=${encodeURIComponent(name)}`);
      const d = await r.json();
      if (d.success) { cell.textContent = d.secret || ''; cell.title = d.secret || ''; if (eye) { eye.className = 'bi bi-eye-slash'; flashIcon(eye); } }
    } catch { }
  } else {
    cell.textContent = '***'; if (eye) { eye.className = 'bi bi-eye'; flashIcon(eye); }
  }
}

async function ownerSub_copy(name) {
  const icon = document.getElementById(`owner-subuser-clip-${name}`);
  let v = '';
  const t = document.getElementById(`owner-subuser-secret-${name}`);
  if (t && t.textContent && t.textContent !== '***') v = t.textContent || '';
  if (!v) {
    try {
      const terminalId = localStorage.getItem('currentTerminalId');
      if (terminalId) {
        const r = await fetch(`function.php?action=getSubSecret&terminalId=${encodeURIComponent(terminalId)}&username=${encodeURIComponent(name)}`);
        const d = await r.json();
        if (d.success) v = d.secret || '';
      }
    } catch { }
  }
  if (!v) return;
  copyText(v, icon);
}

async function ownerSub_copyInline(name, icon) {
  let v = '';
  const t = document.getElementById(`owner-subuser-secret-${name}`);
  if (t && t.textContent && t.textContent !== '***') v = t.textContent || '';
  if (!v) {
    try {
      const terminalId = localStorage.getItem('currentTerminalId');
      if (terminalId) {
        const r = await fetch(`function.php?action=getSubSecret&terminalId=${encodeURIComponent(terminalId)}&username=${encodeURIComponent(name)}`);
        const d = await r.json();
        if (d.success) v = d.secret || '';
      }
    } catch { }
  }
  if (!v) return;
  copyText(v, icon);
}

function enhanceSubuserTable() {
  try {
    const tbody = document.getElementById('owner-subuser-tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.forEach(row => {
      const tds = row.children;
      const tdName = tds[0];
      const tdPass = tds[1];
      const tdOps = tds[2];
      if (tdName) {
        const nameText = tdName.textContent;
        tdName.style.userSelect = 'text';
        tdName.style.width = '40%';
        tdName.innerHTML = '';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = nameText;
        nameSpan.title = nameText;
        nameSpan.style.display = 'inline-block';
        nameSpan.style.maxWidth = 'calc(100% - 28px)';
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';
        nameSpan.style.whiteSpace = 'nowrap';
        const nameIcons = document.createElement('span');
        nameIcons.style.marginLeft = '8px';
        const nameCopy = document.createElement('i');
        nameCopy.className = 'bi bi-clipboard';
        nameCopy.style.cursor = 'pointer';
        nameCopy.id = `owner-subuser-nameclip-${nameText}`;
        nameCopy.classList.add('icon-anim');
        nameCopy.dataset.name = nameText;
        nameIcons.appendChild(nameCopy);
        tdName.appendChild(nameSpan);
        tdName.appendChild(nameIcons);
      }
      if (tdPass) {
        tdPass.style.userSelect = 'text';
        tdPass.style.width = '40%';
        const sp = tdPass.querySelector('span');
        if (sp) {
          sp.style.display = 'inline-block';
          sp.style.maxWidth = 'calc(100% - 44px)';
          sp.style.overflow = 'hidden';
          sp.style.textOverflow = 'ellipsis';
          sp.style.whiteSpace = 'nowrap';
          sp.title = (sp.textContent === '***') ? '点击显示密码' : sp.textContent;
        }
      }
      if (tdOps) {
        tdOps.style.width = '20%';
      }
    });
  } catch { }
}

function bindSubuserDelegates(){
  try{
    const tbody = document.getElementById('owner-subuser-tbody');
    if (!tbody) { return; }
    if (tbody.dataset && tbody.dataset.delegated === '1') return;
    if (tbody.dataset) tbody.dataset.delegated = '1';
    tbody.addEventListener('click', function(e){
      const t = e.target;
      if (!t || !t.id) return;
      const id = t.id;
      if (id.startsWith('owner-subuser-eye-')) {
        const name = t.dataset && t.dataset.name ? t.dataset.name : id.replace('owner-subuser-eye-','');
        ownerSub_toggle(name);
      } else if (id.startsWith('owner-subuser-clip-')) {
        const name = t.dataset && t.dataset.name ? t.dataset.name : id.replace('owner-subuser-clip-','');
        ownerSub_copyInline(name, t);
      } else if (id.startsWith('owner-subuser-nameclip-')) {
        const name = t.dataset && t.dataset.name ? t.dataset.name : id.replace('owner-subuser-nameclip-','');
        copyText(name, t);
      }
    }, true);
  }catch{}
}

function ownerSub_copyName(name) {
  const el = document.getElementById(`owner-subuser-nameclip-${name}`);
  copyText(name, el);
}

function flashIcon(el) {
  try {
    el.style.transform = 'scale(1.12)';
    setTimeout(() => { el.style.transform = ''; }, 300);
  } catch { }
}

document.addEventListener('DOMContentLoaded', () => {
  const pass = document.getElementById('owner-subuser-pass');
  if (pass) pass.addEventListener('input', () => {
    const s = pass.value;
    const el = document.getElementById('owner-subuser-strength');
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
  bindSubuserDelegates();
});

try {
  window.copyText = window.copyText || copyText;
  window.ownerSub_copyInline = window.ownerSub_copyInline || ownerSub_copyInline;
  window.ownerSub_toggle = window.ownerSub_toggle || ownerSub_toggle;
} catch { }
