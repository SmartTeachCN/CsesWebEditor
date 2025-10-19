// 提醒设置相关函数，适配exam页面

function addReminder() {
    var table = document.getElementById('reminderTable');
    var row = table.insertRow(table.rows.length - 1);
    row.innerHTML = `
        <td>
            <select class="reminder-select">
                <option value="beforeStart" selected>当距离考试开始时间还有</option>
                <option value="beforeEnd">当距离考试结束时间还有</option>
                <option value="afterEnd">当考试结束后</option>
                <option value="start">当考试开始时</option>
                <option value="end">当考试结束时</option>
                <option value="atTime">当指定时间时</option>
            </select>
        </td>
        <td>
            <input type="number" class="reminder-time-input" placeholder="分钟">
        </td>
        <td>
            <select name="audioSelect" class="reminder-select"></select>
        </td>
        <td><button class="reminder-btn" onclick="removeReminder(this)">移除提醒</button></td>
    `;
    // 监听类型切换
    row.cells[0].querySelector('select').addEventListener('change', function() {
        var inputCell = row.cells[1];
        var selectVal = this.value;
        if (selectVal === 'start' || selectVal === 'end') {
            inputCell.innerHTML = `<input type="number" class="reminder-time-input" placeholder="-" disabled>`;
        } else if (selectVal === 'atTime') {
            inputCell.innerHTML = `<input type="datetime-local" class="reminder-time-input" placeholder="时间">`;
        } else {
            inputCell.innerHTML = `<input type="number" class="reminder-time-input" placeholder="分钟">`;
        }
    });
    // 音频选项填充（含不可用标记），每次都刷新
    fetch('audio_files.json')
        .then(response => response.json())
        .then(audioFiles => {
            const select = row.cells[2].querySelector('select');
            select.innerHTML = ''; // 确保每次都清空
            Object.keys(audioFiles).forEach(type => {
                var option = document.createElement('option');
                option.value = type;
                // 检查可用性
                var audio = new Audio(audioFiles[type]);
                var unavailable = false;
                audio.addEventListener('error', function() {
                    unavailable = true;
                    option.textContent = type + '（不可用）';
                });
                audio.load();
                option.textContent = type;
                if (!audioFiles[type]) {
                    option.textContent = type + '（不可用）';
                }
                select.appendChild(option);
            });
        });
}

function removeReminder(button) {
    var row = button.parentNode.parentNode;
    row.parentNode.removeChild(row);
}

function saveConfig() {
    try {
        // 新增：保存启用提醒总开关
        const reminderEnable = document.getElementById('reminder-enable-toggle').checked;
        setCookie("reminderEnable", reminderEnable, 365);

        if (!reminderEnable) {
            // 关闭提醒时清空提醒队列
            setCookie("examReminders", encodeURIComponent("[]"), 365);
            errorSystem.show('提醒功能已禁用');
            return;
        }

        if (!validateReminders()) {
            return;
        }
        var table = document.getElementById('reminderTable');
        var reminders = [];
        for (var i = 1; i < table.rows.length - 1; i++) {
            var row = table.rows[i];
            var condition = row.cells[0].querySelector('select').value;
            var timeInput = row.cells[1].querySelector('input');
            var audioSelect = row.cells[2].querySelector('select');
            if (timeInput && audioSelect) {
                let timeVal;
                if (condition === 'atTime') {
                    // 存储为 yyyy-mm-ddThh:mm:ss
                    let dt = timeInput.value;
                    if (dt) {
                        let d = new Date(dt);
                        timeVal = d.getFullYear() + '-' +
                            String(d.getMonth() + 1).padStart(2, '0') + '-' +
                            String(d.getDate()).padStart(2, '0') + 'T' +
                            String(d.getHours()).padStart(2, '0') + ':' +
                            String(d.getMinutes()).padStart(2, '0') + ':' +
                            String(d.getSeconds()).padStart(2, '0');
                    } else {
                        timeVal = '';
                    }
                } else {
                    timeVal = timeInput.value || 0;
                }
                reminders.push({
                    condition: condition,
                    time: timeVal,
                    audio: audioSelect.value
                });
            }
        }
        // 允许为空时保存
        setCookie("examReminders", encodeURIComponent(JSON.stringify(reminders)), 365);
        loadRemindersToQueue(reminders);
        errorSystem.show('提醒设置已保存');
    } catch (e) {
        errorSystem.show('保存设置失败: ' + e.message);
    }
}

function loadRemindersToQueue(reminders) {
    // 获取当前或下一个考试
    const examConfig = window.examConfigData;
    if (!examConfig || !Array.isArray(examConfig.examInfos)) return;
    const now = Date.now();
    let targetExam = null;
    for (const exam of examConfig.examInfos) {
        const start = new Date(exam.start).getTime();
        const end = new Date(exam.end).getTime();
        if (now < end) {
            targetExam = exam;
            break;
        }
    }
    if (!targetExam) return;
    reminders.forEach(function(reminder) {
        let reminderTime;
        switch (reminder.condition) {
            case 'beforeStart':
                reminderTime = new Date(targetExam.start).getTime() - reminder.time * 60000;
                break;
            case 'beforeEnd':
                reminderTime = new Date(targetExam.end).getTime() - reminder.time * 60000;
                break;
            case 'afterEnd':
                reminderTime = new Date(targetExam.end).getTime() + reminder.time * 60000;
                break;
            case 'start':
                reminderTime = new Date(targetExam.start).getTime();
                break;
            case 'end':
                reminderTime = new Date(targetExam.end).getTime();
                break;
            case 'atTime':
                // 解析 yyyy-mm-ddThh:mm:ss
                if (reminder.time) {
                    reminderTime = new Date(reminder.time).getTime();
                }
                break;
        }
        if (reminderTime > now) {
            reminderQueue.addReminder({ time: reminderTime, condition: reminder.condition, audio: reminder.audio });
        }
    });
}

function exportConfig() {
    try {
        // 获取考试配置
        let config = null;
        if (window.examConfigData) {
            config = JSON.parse(JSON.stringify(window.examConfigData));
        } else {
            errorSystem.show('未找到考试配置信息');
            return;
        }
        // 获取提醒设置
        const reminderCookie = getCookie("examReminders");
        let reminders = [];
        if (reminderCookie) {
            reminders = JSON.parse(decodeURIComponent(reminderCookie));
        }
        config.examReminders = reminders;
        // 导出为JSON文件
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "exam_config_with_reminders.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        errorSystem.show('配置已导出');
    } catch (e) {
        errorSystem.show('导出配置失败: ' + e.message);
    }
}

// 校验函数，供关闭弹窗和保存时调用
function validateReminders() {
    var table = document.getElementById('reminderTable');
    for (var i = 1; i < table.rows.length - 1; i++) {
        var row = table.rows[i];
        var condition = row.cells[0].querySelector('select').value;
        var timeInput = row.cells[1].querySelector('input');
        if (condition === 'beforeStart' || condition === 'beforeEnd' || condition === 'afterEnd') {
            if (!timeInput.value || isNaN(timeInput.value) || Number(timeInput.value) <= 0) {
                errorSystem.show('请为“距离开始/结束/考试后”类型填写有效的分钟数');
                return false;
            }
        }
        if (condition === 'atTime') {
            if (!timeInput.value) {
                errorSystem.show('请为“当指定时间时”填写时间');
                return false;
            }
        }
    }
    return true;
}

// 页面加载时自动填充提醒表格
document.addEventListener("DOMContentLoaded", () => {
    // 新增：同步启用提醒总开关
    const reminderEnableToggle = document.getElementById('reminder-enable-toggle');
    const reminderEnableCookie = getCookie("reminderEnable");
    reminderEnableToggle.checked = reminderEnableCookie === null ? true : (reminderEnableCookie === "true");

    // 切换开关时禁用/启用表格和导出按钮
    function updateReminderTableState() {
        const disabled = !reminderEnableToggle.checked;
        document.getElementById('reminderTable').querySelectorAll('input,select,button').forEach(el => {
            if (el.id === 'reminder-enable-toggle' || el.id === 'export-config-btn') return;
            el.disabled = disabled;
        });
        document.getElementById('export-config-btn').disabled = disabled;
    }
    reminderEnableToggle.addEventListener('change', updateReminderTableState);
    setTimeout(updateReminderTableState, 0);

    // 加载提醒设置
    const reminderCookie = getCookie("examReminders");
    if (reminderCookie) {
        const reminders = JSON.parse(decodeURIComponent(reminderCookie));
        if (Array.isArray(reminders)) {
            var table = document.getElementById('reminderTable');
            while (table.rows.length > 2) {
                table.deleteRow(1);
            }
            fetch('audio_files.json')
                .then(response => response.json())
                .then(audioFiles => {
                    const validAudioTypes = Object.keys(audioFiles);
                    const defaultAudio = validAudioTypes[0];
                    reminders.forEach(function(reminder) {
                        if (!validAudioTypes.includes(reminder.audio)) {
                            reminder.audio = defaultAudio;
                        }
                        var row = table.insertRow(table.rows.length - 1);
                        // 音频选项每次都刷新
                        let audioOptions = validAudioTypes
                            .map(audio => {
                                let text = audio;
                                var audioObj = new Audio(audioFiles[audio]);
                                audioObj.addEventListener('error', function() {
                                    text = audio + '（不可用）';
                                });
                                audioObj.load();
                                if (!audioFiles[audio]) text = audio + '（不可用）';
                                return `<option value="${audio}" ${reminder.audio === audio ? 'selected' : ''}>${text}</option>`;
                            })
                            .join('');
                        // 新增：atTime类型
                        let inputHtml;
                        if (reminder.condition === 'start' || reminder.condition === 'end') {
                            inputHtml = `<input type="number" class="reminder-time-input" value="" placeholder="-" disabled>`;
                        } else if (reminder.condition === 'atTime') {
                            // 还原为datetime-local
                            let dtVal = '';
                            if (reminder.time) {
                                // yyyy-mm-ddThh:mm:ss -> yyyy-mm-ddThh:mm
                                dtVal = reminder.time.substring(0, 16);
                            }
                            inputHtml = `<input type="datetime-local" class="reminder-time-input" value="${dtVal}" placeholder="时间">`;
                        } else {
                            inputHtml = `<input type="number" class="reminder-time-input" value="${reminder.time}" placeholder="分钟">`;
                        }
                        row.innerHTML = `
                            <td>
                                <select class="reminder-select">
                                    <option value="beforeStart" ${reminder.condition === 'beforeStart' ? 'selected' : ''}>当距离考试开始时间还有</option>
                                    <option value="beforeEnd" ${reminder.condition === 'beforeEnd' ? 'selected' : ''}>当距离考试结束时间还有</option>
                                    <option value="afterEnd" ${reminder.condition === 'afterEnd' ? 'selected' : ''}>当考试结束后</option>
                                    <option value="start" ${reminder.condition === 'start' ? 'selected' : ''}>当考试开始时</option>
                                    <option value="end" ${reminder.condition === 'end' ? 'selected' : ''}>当考试结束时</option>
                                    <option value="atTime" ${reminder.condition === 'atTime' ? 'selected' : ''}>当指定时间时</option>
                                </select>
                            </td>
                            <td>${inputHtml}</td>
                            <td>
                                <select name="audioSelect" class="reminder-select">
                                    ${audioOptions}
                                </select>
                            </td>
                            <td><button class="reminder-btn" onclick="removeReminder(this)">移除提醒</button></td>
                        `;
                        row.cells[0].querySelector('select').addEventListener('change', function() {
                            let inputCell = row.cells[1];
                            let val = this.value;
                            if (val === 'start' || val === 'end') {
                                inputCell.innerHTML = `<input type="number" class="reminder-time-input" placeholder="-" disabled>`;
                            } else if (val === 'atTime') {
                                inputCell.innerHTML = `<input type="datetime-local" class="reminder-time-input" placeholder="时间">`;
                            } else {
                                inputCell.innerHTML = `<input type="number" class="reminder-time-input" placeholder="分钟">`;
                            }
                        });
                    });
                    loadRemindersToQueue(reminders);
                });
        }
    }
    // 导出按钮事件
    const exportBtn = document.getElementById('export-config-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportConfig);
    }
    // 监听类型选择变化，动态切换文本框可编辑状态
    document.getElementById('reminderTable').addEventListener('change', function(e) {
        if (e.target && e.target.classList.contains('reminder-type-select')) {
            const row = e.target.closest('tr');
            const timeInput = row.querySelector('.reminder-time-input');
            const val = e.target.value;
            if (val === "beforeStart" || val === "beforeEnd" || val === "afterExam") {
                timeInput.removeAttribute('readonly');
                timeInput.removeAttribute('disabled');
            } else {
                timeInput.setAttribute('readonly', 'readonly');
                timeInput.setAttribute('disabled', 'disabled');
            }
        }
    });

    // 拦截关闭按钮
    const closeBtn = document.getElementById('close-reminder-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            if (!validateReminders()) {
                e.preventDefault();
                // 阻止关闭弹窗，需配合reminderModal.js
                window.__reminderCloseBlocked = true;
                return;
            }
            window.__reminderCloseBlocked = false;
            // ...existing code for关闭弹窗...
        });
    }

    // 添加停止音频按钮事件
    const stopAudioBtn = document.getElementById('stop-audio-btn');
    if (stopAudioBtn) {
        stopAudioBtn.addEventListener('click', function() {
            if (window.audioController && typeof window.audioController.stop === 'function') {
                window.audioController.stop();
            }
        });
    }
});
