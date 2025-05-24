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

function showAuthDialog(loginCallback, registerCallback, oauth) {
  const modal = document.createElement("fluent-dialog");
  modal.setAttribute("trap-focus", "");
  modal.style.setProperty("z-index", "1000");
  modal.style.setProperty("--dialog-height", "auto");
  modal.setAttribute("modal", "");

  // 欢迎表单 HTML
  const welcomeFormHTML = `
        <h2>欢迎使用CSES Cloud</h2>
        <p style="margin-bottom:20px">CSES Cloud是一个面向学校/教室的课表与终端管理平台，支持云端存储、导入导出、终端分组、集控配置等功能。适用于教师、管理员和开发者进行课表管理与终端配置。</p>
        <div style="display: flex; justify-content: space-between;margin-top:10px">
            <fluent-button id="switch-to-login2" appearance="accent" style="width: 100px;">使用独立账户继续</fluent-button>
        </div>
    `;

  // 登录表单 HTML
  const loginFormHTML = `
        <h2>登录</h2>
        <p style="margin-bottom:20px">登录以同步您的数据</p>
        <fluent-text-field id="login-username" placeholder="用户名" style="width: 100%; margin-bottom: 10px;"></fluent-text-field>
        <fluent-text-field id="login-password" placeholder="密码" type="password" style="width: 100%; margin-bottom: 10px;"></fluent-text-field>
        <div style="display: flex; justify-content: space-between;margin-top:10px">
            <fluent-button appearance="accent" id="login-submit" class="active-submit" style="width: 48%;">登录</fluent-button>
            <fluent-button id="switch-to-register" style="width: 48%;">注册</fluent-button>
        </div>
    `;

  // 注册表单 HTML
  const registerFormHTML = `
        <h2>注册</h2>
        <p style="margin-bottom:20px">注册一个账户以登录</p>
        <fluent-text-field id="register-username" placeholder="用户名" style="width: 100%; margin-bottom: 10px;"></fluent-text-field>
        <fluent-text-field id="register-password" placeholder="密码" type="password" style="width: 100%; margin-bottom: 10px;"></fluent-text-field>
        <fluent-text-field id="register-confirm" placeholder="确认密码" type="password" style="width: 100%; margin-bottom: 10px;"></fluent-text-field>
        <div style="display: flex; justify-content: space-between;margin-top:10px">
            <fluent-button appearance="accent" id="register-submit" class="active-submit" style="width: 48%;">注册</fluent-button>
            <fluent-button id="switch-to-login" style="width: 48%;">前往登录</fluent-button>
        </div>
    `;

  modal.innerHTML = `
        <div style="margin: 20px;">
            <div id="auth-form-container">${welcomeFormHTML}</div>
            <div style="text-align:left;margin-top:15px;">
                <fluent-button onclick="window.location.href = '${oauth}'" appearance="neutral">智教联盟 授权登录</fluent-button>
                <fluent-button id="close-btn" appearance="neutral">本地模式</fluent-button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);
  modal.hidden = false;

  // 切换函数
  function switchToLogin() {
    modal.querySelector("#auth-form-container").innerHTML = loginFormHTML;
    bindLoginEvents();
  }

  function switchToRegister() {
    modal.querySelector("#auth-form-container").innerHTML = registerFormHTML;
    bindRegisterEvents();
  }

  // 绑定登录事件
  function bindLoginEvents() {
    modal.querySelector("#login-submit").onclick = () => {
      const username = modal.querySelector("#login-username").value.trim();
      const password = modal.querySelector("#login-password").value;
      if (username && password) {
        modal.hidden = true;
        document.body.removeChild(modal);
        loginCallback({ username, password });
      } else {
        alert("请输入用户名和密码");
      }
    };

    modal.querySelector("#switch-to-register").onclick = switchToRegister;
  }

  // 绑定注册事件
  function bindRegisterEvents() {
    modal.querySelector("#register-submit").onclick = () => {
      const username = modal.querySelector("#register-username").value.trim();
      const password = modal.querySelector("#register-password").value;
      const confirmPass = modal.querySelector("#register-confirm").value;
      if (!username || !password || !confirmPass) {
        alert("请填写完整信息");
        return;
      }
      if (password !== confirmPass) {
        alert("两次密码不一致");
        return;
      }
      modal.hidden = true;
      document.body.removeChild(modal);
      registerCallback({ username, password });
    };

    modal.querySelector("#switch-to-login").onclick = switchToLogin;
  }

  modal.querySelector("#switch-to-login2").onclick = switchToLogin;

  // 关闭按钮
  modal.querySelector("#close-btn").onclick = () => {
    modal.hidden = true;
    document.body.removeChild(modal);
  };

  // 键盘监听
  // bindDialogEvents(modal,
  //   () => {
  //     // 处理 .active-submit
  //     const active = modal.querySelector(".active-submit");
  //     if (active) active.click();
  //   },
  //   () => modal.querySelector("#close-btn").click()
  // );
}