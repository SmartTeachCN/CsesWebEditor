let mobileMode = false;

// 检查设备类型
function checkDeviceType() {
  if (window.innerWidth <= 768 && !mobileMode) {
    return true;
  } else {
    return false;
  }
}
function resize() {
var bodyHeight = window.innerHeight;
document.body.style.height = bodyHeight + "px";
}

window.onresize = resize;

resize();
