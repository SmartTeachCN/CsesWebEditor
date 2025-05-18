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

// 单实例模式
let loadingInstance = null;

// 动态创建模态框
function createLoadingModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'loadingModal';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  const spinner = document.createElement('div');
  spinner.className = 'spinner';

  modalContent.appendChild(spinner);
  modal.appendChild(modalContent);

  document.body.appendChild(modal);
  return modal;
}

function showLoading() {
  const saveButton = document.getElementById("save-button");
  saveButton.disabled = true;
  saveButton.innerHTML = "<i class='bi bi-arrow-clockwise' style='display: inline-block; animation: spin 1s linear infinite'></i>&nbsp;正在加载";
  // if (!loadingInstance) {
  //   // 如果实例不存在，创建并显示
  //   const modal = createLoadingModal();
  //   modal.style.display = 'flex';
  //   loadingInstance = modal;
  // }
}

function closeLoading() {
  const saveButton = document.getElementById("save-button");
  saveButton.disabled = false;
  saveButton.innerHTML = `<i class="bi bi-cloud-upload"></i>&nbsp;保存配置`;
  // if (loadingInstance) {
  //   // 关闭模态框
  //   loadingInstance.style.display = 'none';
  //   loadingInstance = null;
  // }
}

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