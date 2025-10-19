document.addEventListener("DOMContentLoaded", () => {
    const settingsBtn = document.getElementById("settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const closeSettingsBtn = document.getElementById("close-settings-btn");
    const saveSettingsBtn = document.getElementById("save-settings-btn");
    const offsetTimeInput = document.getElementById("offset-time");
    const roomInput = document.getElementById("room-input");
    const roomElem = document.getElementById("room");
    const zoomInput = document.getElementById("zoom-input");
    const themeToggle = document.getElementById("theme-toggle");
    const themeLink = document.getElementById("theme-link");
    const configFileInput = document.getElementById("config-file");
    const clearConfigBtn = document.getElementById("clear-config-btn");
    const themeSelect = document.getElementById("theme-select");
    const autoToggle = document.getElementById("auto-toggle");
    const paperCountPositionSelect = document.getElementById("paper-count-position");

    let offsetTime = getCookie("offsetTime") || 0;
    let room = getCookie("room") || "";
    let zoomLevel = getCookie("zoomLevel") || 1;
    let currentTheme = getCookie("currentTheme") || "ealg";
    let theme = getCookie("theme") || "dark";
    let isAutoToggle = getCookie("autoToggle") || false;
    let paperCountPosition = getCookie("paperCountPosition") || "right-bottom";
    let themeConfig = [];

    // 新增：检测url参数
    function getQueryParam(name) {
        const url = window.location.href;
        name = name.replace(/[[]]/g, "\\$&");
        const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
        const results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }
    const configUrl = getQueryParam('configUrl');
    if (configUrl) {
        // 禁用本地配置相关控件
        if (configFileInput) configFileInput.disabled = true;
        if (clearConfigBtn) clearConfigBtn.disabled = true;
        // 隐藏或禁用相关区域
        const configFileContainer = document.querySelector('.config-file-container');
        if (configFileContainer) configFileContainer.style.opacity = 0.5;
    }

    offsetTime = parseInt(offsetTime);
    roomElem.textContent = room;
    autoToggle.checked = isAutoToggle === "true";

    // 初始化主题
    const currentThemePath = `Styles/${currentTheme}/${theme}.css`;
    themeLink.href = currentThemePath;
    themeToggle.checked = theme === "light";

    // 加载主题配置
    fetch('Styles/profile.json')
        .then(response => response.json())
        .then(data => {
            themeConfig = data.theme;
            // 填充主题选择下拉框
            themeConfig.forEach(theme => {
                const option = document.createElement('option');
                option.value = theme.path || theme.type;
                option.textContent = theme.name;
                themeSelect.appendChild(option);
            });
            themeSelect.value = currentTheme;
            updateThemeLink();
        })
        .catch(error => errorSystem.show('加载主题配置失败: ' + error.message));

    function updateThemeLink() {
        const themePath = currentTheme;
        const isDark = !themeToggle.checked;
        themeLink.href = `Styles/${themePath}/${isDark ? 'dark' : 'light'}.css`;
    }

    // 初始化下拉框
    if (paperCountPositionSelect) {
        paperCountPositionSelect.value = paperCountPosition;
    }

    settingsBtn.addEventListener("click", () => {
        try {
            offsetTimeInput.value = offsetTime;
            roomInput.value = room;
            zoomInput.value = zoomLevel;
            settingsModal.style.display = "block";
            if (paperCountPositionSelect) paperCountPositionSelect.value = paperCountPosition;
        } catch (e) {
            errorSystem.show('打开设置失败: ' + e.message);
        }
    });

    closeSettingsBtn.addEventListener("click", () => {
        try {
            settingsModal.classList.add("fade-out");
            setTimeout(() => {
                settingsModal.style.display = "none";
                settingsModal.classList.remove("fade-out");
            }, 300);
        } catch (e) {
            errorSystem.show('关闭设置失败: ' + e.message);
        }
    });

    saveSettingsBtn.addEventListener("click", () => {
        try {
            offsetTime = parseInt(offsetTimeInput.value);
            room = roomInput.value;
            zoomLevel = parseFloat(zoomInput.value);
            theme = themeToggle.checked ? "light" : "dark";
            currentTheme = themeSelect.value;
            isAutoToggle = autoToggle.checked;
            paperCountPosition = paperCountPositionSelect.value;
            setCookie("offsetTime", offsetTime, 365);
            setCookie("room", room, 365);
            setCookie("zoomLevel", zoomLevel, 365);
            setCookie("theme", theme, 365);
            setCookie("currentTheme", currentTheme, 365);
            setCookie("autoToggle", isAutoToggle, 365);
            setCookie("paperCountPosition", paperCountPosition, 365);
            roomElem.textContent = room;
            document.body.style.zoom = zoomLevel;
            updateThemeLink();
            settingsModal.classList.add("fade-out");
            setTimeout(() => {
                settingsModal.style.display = "none";
                settingsModal.classList.remove("fade-out");
            }, 300);
            // 立即生效时间偏移
            location.reload();
            // 通知 examInfo.js 更新数量控制区位置
            window.dispatchEvent(new Event("paperCountPositionChanged"));
        } catch (e) {
            errorSystem.show('保存设置失败: ' + e.message);
        }
    });

    themeSelect.addEventListener("change", () => {
        currentTheme = themeSelect.value;
        updateThemeLink();
    });

    themeToggle.addEventListener("change", () => {
        updateThemeLink();
    });

    configFileInput.addEventListener("change", (event) => {
        if (configUrl) return; // 禁止导入
        try {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    
                    // 验证配置文件格式
                    if (!config.examInfos || !Array.isArray(config.examInfos)) {
                        throw new Error("无效的配置文件格式");
                    }
                    
                    // 验证每个考试信息
                    config.examInfos.forEach(exam => {
                        if (!exam.name || !exam.start || !exam.end) {
                            throw new Error("考试信息不完整");
                        }
                        // 验证日期格式
                        if (isNaN(new Date(exam.start).getTime()) || isNaN(new Date(exam.end).getTime())) {
                            throw new Error("无效的日期格式");
                        }
                    });

                    // 导入提醒设置
                    if (config.examReminders && Array.isArray(config.examReminders)) {
                        setCookie("examReminders", encodeURIComponent(JSON.stringify(config.examReminders)), 365);
                    }

                    // 保存配置到本地存储
                    localStorage.setItem('localExamConfig', JSON.stringify(config));
                    errorSystem.show('配置文件已加载，将在下次启动时生效');
                    
                } catch (error) {
                    errorSystem.show('配置文件格式错误: ' + error.message);
                }
            };
            reader.readAsText(file);
        } catch (e) {
            errorSystem.show('读取文件失败: ' + e.message);
        }
    });

    clearConfigBtn.addEventListener("click", () => {
        if (configUrl) return; // 禁止清除
        try {
            if (confirm("确定要清除本地配置吗？这将恢复使用默认配置文件。")) {
                localStorage.removeItem('localExamConfig');
                configFileInput.value = ''; // 清空文件选择
                errorSystem.show('本地配置已清除，将在下次启动时生效');
            }
        } catch (e) {
            errorSystem.show('清除配置失败: ' + e.message);
        }
    });

    try {
        document.body.style.zoom = zoomLevel;
    } catch (e) {
        errorSystem.show('初始化缩放失败: ' + e.message);
    }

    // 新增：点击弹窗外区域自动保存并关闭
    window.addEventListener("click", function(event) {
        if (settingsModal.style.display === "block" && event.target === settingsModal) {
            // 自动保存设置
            try {
                offsetTime = parseInt(offsetTimeInput.value);
                room = roomInput.value;
                zoomLevel = parseFloat(zoomInput.value);
                theme = themeToggle.checked ? "light" : "dark";
                currentTheme = themeSelect.value;
                isAutoToggle = autoToggle.checked;
                paperCountPosition = paperCountPositionSelect.value;
                setCookie("offsetTime", offsetTime, 365);
                setCookie("room", room, 365);
                setCookie("zoomLevel", zoomLevel, 365);
                setCookie("theme", theme, 365);
                setCookie("currentTheme", currentTheme, 365);
                setCookie("autoToggle", isAutoToggle, 365);
                setCookie("paperCountPosition", paperCountPosition, 365);
                roomElem.textContent = room;
                document.body.style.zoom = zoomLevel;
                updateThemeLink();
                settingsModal.classList.add("fade-out");
                setTimeout(() => {
                    settingsModal.style.display = "none";
                    settingsModal.classList.remove("fade-out");
                }, 300);
                // 立即生效时间偏移
                location.reload();
                // 通知 examInfo.js 更新数量控制区位置
                window.dispatchEvent(new Event("paperCountPositionChanged"));
            } catch (e) {
                errorSystem.show('保存设置失败: ' + e.message);
            }
        }
    });

    if (paperCountPositionSelect) {
        paperCountPositionSelect.addEventListener("change", () => {
            paperCountPosition = paperCountPositionSelect.value;
            setCookie("paperCountPosition", paperCountPosition, 365);
            window.dispatchEvent(new Event("paperCountPositionChanged"));
        });
    }
});
