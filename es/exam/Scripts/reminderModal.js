document.addEventListener("DOMContentLoaded", function() {
    const reminderBtn = document.getElementById("reminder-settings-btn");
    const reminderModal = document.getElementById("reminder-modal");
    const closeReminderBtn = document.getElementById("close-reminder-btn");
    const saveReminderBtn = document.getElementById("save-reminder-btn");

    reminderBtn.addEventListener("click", function() {
        reminderModal.style.display = "block";
    });

    closeReminderBtn.addEventListener("click", function() {
        // 新增：如果未启用提醒，直接关闭
        if (document.getElementById('reminder-enable-toggle') && !document.getElementById('reminder-enable-toggle').checked) {
            reminderModal.style.display = "none";
            return;
        }
        // 只在校验通过时关闭弹窗
        if (window.__reminderCloseBlocked) {
            // 校验未通过，阻止关闭
            return;
        }
        reminderModal.style.display = "none";
    });

    saveReminderBtn.addEventListener("click", function() {
        // 新增：如果未启用提醒，直接保存并关闭
        if (document.getElementById('reminder-enable-toggle') && !document.getElementById('reminder-enable-toggle').checked) {
            saveConfig();
            reminderModal.style.display = "none";
            return;
        }
        if (typeof validateReminders === "function" && !validateReminders()) {
            // 校验未通过，阻止关闭
            return;
        }
        saveConfig();
        reminderModal.style.display = "none";
    });

    // 点击弹窗外部关闭
    window.addEventListener("click", function(event) {
        if (event.target === reminderModal) {
            reminderModal.style.display = "none";
        }
    });
});
