// 检查设备类型并设置显示状态
function checkDeviceType() {
    if (window.innerWidth <= 768) {
        document.querySelector(".explorer").style.display = "none";
        document.querySelector(".editor-area").style.display = "none";
    } else {
        document.querySelector(".explorer").style.display = "block";
        document.querySelector(".editor-area").style.display = "block";
    }
}

// 监听窗口大小变化
window.addEventListener("resize", checkDeviceType);

// 初始检查设备类型
checkDeviceType();
