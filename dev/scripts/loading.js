// 动态添加样式
const style = document.createElement('style');
document.head.appendChild(style);
style.sheet.insertRule(`
  .modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.3);
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  .modal-content {
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    text-align: center;
  }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  .spinner {
    border: 4px solid rgba(0, 0, 0, 0.3);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border-top-color: #007bff;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`, style.sheet.cssRules.length);

// 覆盖编辑器区域的加载层
style.sheet.insertRule(`
  .editor-overlay {
    position: fixed;
    left: 0;
    top: 0;
    width: 0;
    height: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: none;
    z-index: 1000;
    opacity: 0;
    transition: opacity 200ms ease;
  }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  .editor-overlay .content {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: transparent;
    border-radius: 8px;
    padding: 16px;
    min-width: 280px;
    max-width: 60%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  .editor-overlay.active { opacity: 1; }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  .editor-area { transition: opacity 200ms ease; }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  .editor-area.fade-out { opacity: 0; }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  .editor-area.fade-in { opacity: 1; }
`, style.sheet.cssRules.length);
// 主题适配
style.sheet.insertRule(`
  .editor-overlay.light { background-color: rgba(255, 255, 255, 0.95); }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  .editor-overlay.dark .content { color:#ddd; }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  .editor-overlay.light .content { color:#333; }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  .editor-overlay.dark .spinner { border-color: rgba(255,255,255,0.25); border-top-color:#3ea6ff; }
`, style.sheet.cssRules.length);
style.sheet.insertRule(`
  .editor-overlay.light .spinner { border-color: rgba(0,0,0,0.3); border-top-color:#007bff; }
`, style.sheet.cssRules.length);

// 单实例模式
let loadingInstance = null; // 用于云端加载（模式1）按钮状态
let editorOverlay = null;   // 覆盖编辑器的加载层（模式2）
let editorOverlayTimer = null;

// 动态创建模态框
function positionEditorOverlay(el) {
  try {
    const iframe = document.getElementById('editor-frame');
    if (!iframe) return;
    const rect = iframe.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    el.style.left = (rect.left + scrollLeft) + 'px';
    el.style.top = (rect.top + scrollTop) + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
  } catch { }
}

function createEditorOverlay(text) {
  const overlay = document.createElement('div');
  overlay.className = 'editor-overlay';
  const box = document.createElement('div');
  box.className = 'content';
  const spinner = document.createElement('div'); spinner.className = 'spinner';
  const tip = document.createElement('div'); tip.textContent = text || '正在加载编辑器...';
  const logBox = document.createElement('div'); logBox.id = 'editorLoadingLog'; logBox.style.maxHeight = '160px'; logBox.style.overflowY = 'auto'; logBox.style.textAlign = 'left'; logBox.style.fontSize = '12px'; logBox.style.color = 'inherit';
  const ops = document.createElement('div'); ops.style.display='flex'; ops.style.gap='8px'; ops.style.justifyContent='flex-end';
  const retry = document.createElement('fluent-button'); retry.textContent = '重试'; retry.addEventListener('click', ()=>{ try { if (typeof window.retryEditorLoad === 'function') window.retryEditorLoad(); } catch {} });
  ops.appendChild(retry);
  box.appendChild(spinner); box.appendChild(tip); box.appendChild(logBox); box.appendChild(ops);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  positionEditorOverlay(overlay);
  window.addEventListener('resize', () => positionEditorOverlay(overlay));
  window.addEventListener('scroll', () => positionEditorOverlay(overlay));
  return overlay;
}

function updateEditorOverlayTheme(){
  try{
    if (!editorOverlay) return;
    const isDark = !!(document && document.body && document.body.classList && document.body.classList.contains('darkmode--activated'));
    editorOverlay.classList.remove('dark','light'); editorOverlay.classList.add(isDark ? 'dark' : 'light');
  }catch{}
}

function showLoading(mode = 1, text = '正在下载配置') {
  if (mode === 1) {
    const saveButton = document.getElementById("save-button");
    if (window.hasLogin && saveButton) {
      saveButton.disabled = true;
      saveButton.innerHTML = '<span class="desktop-only"><i class="bi bi-arrow-clockwise" style="display: inline-block; animation: spin 1s linear infinite"></i>&nbsp;正在拉取</span><span class="mobile-only"><i class="bi bi-arrow-clockwise" style="display: inline-block; animation: spin 1s linear infinite"></i></span>';
    }
  } else if (mode === 2) {
    if (!editorOverlay) {
      editorOverlay = createEditorOverlay(text || '正在加载编辑器...');
    }
    positionEditorOverlay(editorOverlay);
    updateEditorOverlayTheme();
    editorOverlay.style.display = 'block';
    editorOverlay.classList.add('active');
    try { const area = document.getElementsByClassName('editor-area')[0]; if (area) { area.classList.add('fade-out'); area.classList.remove('fade-in'); } } catch {}
    if (editorOverlayTimer) { try { clearTimeout(editorOverlayTimer); } catch {} }
    editorOverlayTimer = setTimeout(() => {
      try {
        const box = document.getElementById('editorLoadingLog');
        if (box) { box.textContent = ''; const warn = document.createElement('div'); warn.style.color = '#a00'; warn.textContent = '加载可能卡住，可点击重试'; box.appendChild(warn); box.scrollTop = box.scrollHeight; }
      } catch {}
    }, 8000);
  }
}

function closeLoading(mode = 1) {
  if (mode === 1) {
    const saveButton = document.getElementById("save-button");
    if (window.hasLogin && saveButton) {
      saveButton.disabled = false;
      saveButton.innerHTML = `<span class="desktop-only"><i class="bi bi-cloud-upload"></i>&nbsp;保存到云</span><span class="mobile-only"><i class="bi bi-cloud-upload"></i></span>`;
    }
  } else if (mode === 2) {
    try {
      if (editorOverlayTimer) { clearTimeout(editorOverlayTimer); editorOverlayTimer = null; }
      if (editorOverlay) {
        editorOverlay.classList.remove('active');
        setTimeout(() => { try { editorOverlay.style.display = 'none'; } catch { } }, 200);
      }
      try { const area = document.getElementsByClassName('editor-area')[0]; if (area) { area.classList.add('fade-in'); area.classList.remove('fade-out'); } } catch { }
    } catch { }
  }
}
const saveButton = document.getElementById("save-button");
if (window.hasLogin && saveButton) {
  saveButton.disabled = false;
  saveButton.innerHTML = `<span class="desktop-only"><i class="bi bi-cloud-upload"></i>&nbsp;保存到云</span><span class="mobile-only"><i class="bi bi-cloud-upload"></i></span>`;
}


function appendLoadingLog(text) {
  try {
    if (!editorOverlay) { editorOverlay = createEditorOverlay('正在加载编辑器'); editorOverlay.style.display = 'block'; }
    const box = document.getElementById('editorLoadingLog');
    if (!box) return;
    box.textContent = ''; const line = document.createElement('div'); line.textContent = text; box.appendChild(line); box.scrollTop = box.scrollHeight;
  }catch{}
}

try { window.appendLoadingLog = appendLoadingLog; } catch {}
try {
  const obs = new MutationObserver(()=>{ try { updateEditorOverlayTheme(); } catch {} });
  obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
} catch {}

// 拦截 fetch 请求
const originalFetch = window.fetch;

const excludedKeywords = ['getUserInfo']; // 排除的关键字

window.fetch = async function (...args) {
  const [url] = args;
  const shouldShowLoading = !excludedKeywords.some(keyword => url.includes(keyword));

  if (shouldShowLoading) {
    showLoading();
  }

  try {
    const response = await originalFetch(...args);
    return response;
  } finally {
    if (shouldShowLoading) {
      // setTimeout(() => {
      //   closeLoading();
      // }, 1000); // 延迟关闭加载动画
      closeLoading();
    }
  }
};
