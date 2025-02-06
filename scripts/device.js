let mobileMode = false;

// 检查设备类型
function checkDeviceType() {
    if (window.innerWidth <= 768 && !mobileMode) {
        return true;
    } else {
        return false;
    }
}
