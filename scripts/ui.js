function bindDialogEvents(modal, confirmCallback, cancelCallback) {
    function handleKeydown(event) {
        if (event.key === "Enter") {
            modal.removeEventListener("keydown", handleKeydown);
            modal.hidden = true;
            document.body.removeChild(modal);
            confirmCallback();
        } else if (event.key === "Escape") {
            modal.removeEventListener("keydown", handleKeydown);
            modal.hidden = true;
            document.body.removeChild(modal);
            cancelCallback();
        }
    }

    modal.addEventListener("keydown", handleKeydown);
}

function showModal(content) {
    const modal = document.createElement("fluent-dialog");
    modal.setAttribute("trap-focus", "");
    modal.style.setProperty("z-index", "1000");
    modal.style.setProperty("--dialog-height", "auto");
    modal.setAttribute("modal", "");
    modal.innerHTML = `
    <div style="margin: 20px;">${content.replace(/\n/g, "<br>")}</div>
    <div style="display: flex; justify-content: center; margin-top: 1rem;">
      <fluent-button appearance="accent" id="close-btn" style="width: 100px;margin-bottom:10px">关闭</fluent-button>
    </div>
  `;
    document.body.appendChild(modal);
    modal.hidden = false;

    const closeBtn = modal.querySelector("#close-btn");
    closeBtn.onclick = () => {
        modal.hidden = true;
        document.body.removeChild(modal);
    };

    bindDialogEvents(modal,
        () => closeBtn.click(),
        () => closeBtn.click()
    );
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
        <fluent-button appearance="accent" id="alert-close" style="width: 100%;">关闭</fluent-button>
      </div>
    </div>
  `;
    document.body.appendChild(modal);
    modal.hidden = false;

    const closeBtn = modal.querySelector("#alert-close");
    closeBtn.onclick = () => {
        modal.hidden = true;
        modal.remove();
    };

    bindDialogEvents(modal,
        () => closeBtn.click(),
        () => closeBtn.click()
    );
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
      <fluent-button appearance="accent" id="confirm-yes" style="width: 100%;">确定</fluent-button>
      <fluent-button id="confirm-no" style="width: 100%;margin-left: 5px;">取消</fluent-button>
    </div>
  </div>`;

    document.body.appendChild(modal);
    modal.hidden = false;

    const yesBtn = modal.querySelector("#confirm-yes");
    const noBtn = modal.querySelector("#confirm-no");

    const doConfirm = (result) => {
        modal.hidden = true;
        modal.remove();
        callback(result, args);
    };

    yesBtn.onclick = () => doConfirm(true);
    noBtn.onclick = () => doConfirm(false);

    bindDialogEvents(modal,
        () => yesBtn.click(),
        () => noBtn.click()
    );
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
      <fluent-button appearance="accent" id="prompt-confirm" style="width: 100%">确定</fluent-button>
      <fluent-button id="prompt-cancel" style="width: 100%;margin-left: 5px;">取消</fluent-button>
    </div>
  </div>`;

    document.body.appendChild(modal);
    modal.hidden = false;

    const input = modal.querySelector("#prompt-input");
    const confirmBtn = modal.querySelector("#prompt-confirm");
    const cancelBtn = modal.querySelector("#prompt-cancel");

    const doPromptAction = (result) => {
        modal.hidden = true;
        modal.remove();
        callback(result ? input.value : null);
    };

    confirmBtn.onclick = () => doPromptAction(true);
    cancelBtn.onclick = () => doPromptAction(false);

    bindDialogEvents(modal,
        () => confirmBtn.click(),
        () => cancelBtn.click()
    );

    // 自动聚焦到输入框
    setTimeout(() => input.focus(), 100);
}