function showModal(content) {
    const modal = document.createElement("fluent-dialog");
    modal.setAttribute("trap-focus", "");
    modal.style.setProperty("z-index", "1000");
    modal.style.setProperty("--dialog-height", "auto");
    modal.setAttribute("modal", "");
    modal.innerHTML = `
    <div style="margin: 20px;">${content.replace(/\n/g, "<br>")}</div>
    <div style="display: flex; justify-content: center; margin-top: 1rem;">
  <fluent-button appearance="accent" onclick="this.closest('fluent-dialog').hidden = true" style="width: 100px;margin-bottom:10px">关闭</fluent-button>
    </div>
  `;
    document.body.appendChild(modal);
    modal.hidden = false;
}

function alert(message, title) {
    const modal = document.createElement("fluent-dialog");
    modal.style.setProperty("--dialog-height", "200px");
    modal.style.setProperty("z-index", "1000");
    modal.setAttribute("trap-focus", "");
    modal.setAttribute("modal", "");
    modal.innerHTML = `
    <div style="margin: 20px">
  <h2 style="margin-bottom:6px">${title ?? "提示"}</h2>
  <p style="height:90px">${message}</p>
    <div style="display: flex; justify-content: center; margin-top: 0.4rem;">
  <fluent-button appearance="accent" onclick="this.closest('fluent-dialog').hidden = true" style="width: 100%;">关闭</fluent-button>
    </div>
    </div>
  `;
    document.body.appendChild(modal);
    modal.hidden = false;
}

function confirm(message, callback, args) {
    const modal = document.createElement("fluent-dialog");
    modal.style.setProperty("--dialog-height", "200px");
    modal.style.setProperty("z-index", "1000");
    modal.setAttribute("trap-focus", "");
    modal.setAttribute("modal", "");
    modal.innerHTML = `
  <div style="margin: 20px">
  <h2 style="margin-bottom:6px">确认您的操作</h2>
  <p style="height: 90px; overflow-y: auto;">${message}</p>
  <div style="display: flex; justify-content: space-between; margin-top: 0.4rem;">
    <fluent-button appearance="accent" onclick="confirmAction(true, this.closest('fluent-dialog'), ${callback}, '${args}')" style="width: 100%;">确定</fluent-button>
    <fluent-button onclick="confirmAction(false, this.closest('fluent-dialog'), ${callback}, '${args}')" style="width: 100%;margin-left: 5px;">取消</fluent-button>
  </div>
  </div>`;
    document.body.appendChild(modal);
    modal.hidden = false;
}

function confirmAction(result, modal, callback, args) {
    modal.hidden = true;
    document.body.removeChild(modal);
    callback(result, args);
}

function prompt(message, callback) {
    const modal = document.createElement("fluent-dialog");
    modal.style.setProperty("--dialog-height", "200px");
    modal.style.setProperty("z-index", "1000");
    modal.setAttribute("trap-focus", "");
    modal.setAttribute("modal", "");
    modal.innerHTML = `
  <div style="margin: 20px">
  <h2 style="margin-bottom:6px">${message}</h2>
  <span style="height: 90px;">
  <p>在下方编辑框输入文本以继续响应</p><br>
  <fluent-text-field id="prompt-input" style="width: 100%;"></fluent-text-field>
  </span>
  <div style="display: flex; justify-content: space-between; margin-top: 0.4rem;">
    <fluent-button appearance="accent" onclick="promptAction(true, this.closest('fluent-dialog'), ${callback})" style="width: 100%">确定</fluent-button>
    <fluent-button onclick="promptAction(false, this.closest('fluent-dialog'), ${callback})" style="width: 100%;margin-left: 5px;">取消</fluent-button>
  </div>
  </div>`;
    document.body.appendChild(modal);
    modal.hidden = false;
}

function promptAction(result, modal, callback) {
    const input = document.getElementById("prompt-input").value;
    modal.hidden = true;
    document.body.removeChild(modal);
    callback(result ? input : null);
}
