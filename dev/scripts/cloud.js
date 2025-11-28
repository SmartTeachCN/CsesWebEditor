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
      file.importS(config);

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



// 共享空间 - 尚未开始继续开发
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

function openSubPanel() {
  const dirText = document.querySelector('.directoryId')?.textContent || '';
  const tid = localStorage.getItem('currentTerminalId') || '';
  const url = `/subuser.html?dir=${encodeURIComponent(dirText)}&tid=${encodeURIComponent(tid)}`;
  window.open(url, '_blank');
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

function openOwnerSubModal(){
  try {
    const dlg = document.getElementById('owner-subuser-dialog');
    if (dlg && typeof dlg.show === 'function') dlg.show();
    else if (dlg) { dlg.hidden = false; }
  } catch {}
  try { ownerSub_load(); } catch {}
}
function closeOwnerSubModal(){
  const dlg = document.getElementById('owner-subuser-dialog');
  if (dlg && typeof dlg.hide === 'function') dlg.hide();
}
async function ownerSub_load(){
  const rootDoc = document;
  const tableBody = rootDoc.getElementById('owner-subuser-tbody');
  const terminalId = localStorage.getItem('currentTerminalId');
  if (!tableBody) { console.warn('owner-subuser-tbody not found'); return; }
  if (!terminalId) { tableBody.innerHTML = '<tr><td colspan="3">未选择实例</td></tr>'; return; }
  tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">加载中...</td></tr>';
  try{
    const r = await fetch(`function.php?action=getSubUsers&terminalId=${encodeURIComponent(terminalId)}`);
    const d = await r.json();
    if (!d.success) { tableBody.innerHTML = '<tr><td colspan="3">加载失败</td></tr>'; return; }
    const users = d.users || [];
    if (users.length === 0) { tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">暂无子用户</td></tr>'; return; }
    tableBody.innerHTML = '';
    users.forEach(u=>{
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.textContent = u.username;
      const tdSecret = document.createElement('td');
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
      del.textContent = '删除';
      del.addEventListener('click', ()=>ownerSub_delete(u.username));
      td2.appendChild(del);
      tr.appendChild(td1);
      tr.appendChild(tdSecret);
      tr.appendChild(td2);
      tableBody.appendChild(tr);
    });
  }catch(e){
    const tableBody2 = document.getElementById('owner-subuser-tbody');
    tableBody2.innerHTML = '<tr><td colspan="3">加载失败</td></tr>';
  }
  enhanceSubuserTable();
  bindSubuserDelegates();
}
async function ownerSub_add(){
  const terminalId = localStorage.getItem('currentTerminalId');
  const name = document.getElementById('owner-subuser-name').value.trim();
  const pwd = document.getElementById('owner-subuser-pass').value;
  if (!terminalId) { alert('请先选择实例'); return; }
  if (!name) { alert('请输入子用户名'); return; }
  if (pwd && !isStrongSecret(pwd)) { alert('密码强度不足：至少8位，需包含大小写字母、数字与特殊字符'); return; }
  const body = new URLSearchParams();
  body.append('action','addSubUser');
  body.append('terminalId', terminalId);
  body.append('username', name);
  if (pwd) body.append('secret', pwd);
  try{
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
  }catch(e){ alert('创建失败'); }
}
async function ownerSub_delete(name){
  const terminalId = localStorage.getItem('currentTerminalId');
  if (!terminalId) return;
  confirm(`确认删除子用户 ${name} 吗？`, async (ok) => {
    if (!ok) return;
    const body = new URLSearchParams();
    body.append('action','delSubUser');
    body.append('terminalId', terminalId);
    body.append('username', name);
    const r = await fetch('function.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const d = await r.json();
    if (d.success) { ownerSub_load(); } else { alert('删除失败: ' + d.error); }
  });
}
async function ownerSub_toggle(name){
  const terminalId = localStorage.getItem('currentTerminalId');
  const cell = document.getElementById(`owner-subuser-secret-${name}`);
  const eye = document.getElementById(`owner-subuser-eye-${name}`);
  if (!cell || !terminalId) return;
  if (cell.textContent === '***'){
    try{
      const r = await fetch(`function.php?action=getSubSecret&terminalId=${encodeURIComponent(terminalId)}&username=${encodeURIComponent(name)}`);
      const d = await r.json();
      if (d.success){ cell.textContent = d.secret || ''; cell.title = d.secret || ''; if (eye) { eye.className = 'bi bi-eye-slash'; flashIcon(eye); } }
    }catch{}
  }else{
    cell.textContent = '***'; if (eye) { eye.className = 'bi bi-eye'; flashIcon(eye); }
  }
}
async function ownerSub_copy(name){
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
    } catch {}
  }
  if (!v) return;
  copyText(v, icon);
}

async function ownerSub_copyInline(name, icon){
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
    } catch {}
  }
  if (!v) return;
  copyText(v, icon);
}
function ownerSub_copyName(name){
  const el = document.getElementById(`owner-subuser-nameclip-${name}`);
  copyText(name, el);
}
function flashIcon(el){
  try{
    el.style.transform = 'scale(1.12)';
    setTimeout(()=>{ el.style.transform = ''; }, 300);
  }catch{}
}

function enhanceSubuserTable(){
  try{
    const tbody = document.getElementById('owner-subuser-tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.forEach(row=>{
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
        nameCopy.dataset.name = nameText;
        nameIcons.appendChild(nameCopy);
        tdName.appendChild(nameSpan);
        tdName.appendChild(nameIcons);
      }
      if (tdPass) {
        tdPass.style.userSelect = 'text';
        tdPass.style.width = '40%';
        const sp = tdPass.querySelector('span');
        if (sp){
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
  }catch{}
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

document.addEventListener('DOMContentLoaded', ()=>{
  const dlgInit = document.getElementById('owner-subuser-dialog');
  if (dlgInit) dlgInit.hidden = true;
  const pass = document.getElementById('owner-subuser-pass');
  if (pass) pass.addEventListener('input', ()=>{
    const s = pass.value;
    const el = document.getElementById('owner-subuser-strength');
    if (!s) { el.textContent = ''; return; }
    let score = 0;
    if (s.length >= 8) score++;
    if (/[a-z]/.test(s)) score++;
    if (/[A-Z]/.test(s)) score++;
    if (/\d/.test(s)) score++;
    if (/[^a-zA-Z\d]/.test(s)) score++;
    const txt = ['很弱','弱','一般','良好','较强'];
    el.textContent = txt[Math.max(0,score-1)];
  });
  bindSubuserDelegates();
});

try {
  window.copyText = window.copyText || copyText;
  window.ownerSub_copyInline = window.ownerSub_copyInline || ownerSub_copyInline;
  window.ownerSub_toggle = window.ownerSub_toggle || ownerSub_toggle;
} catch {}
