
let currentData = {
    version: 1,
    subjects: [],
    schedules: [],
};

// 从localStorage加载数据
function loadFromStorage() {
    const saved = localStorage.getItem("csesData");
    if (saved) currentData = JSON.parse(saved);
}

// 保存课程安排
function saveSchedule() {
    localStorage.setItem("csesData", JSON.stringify(currentData));
}