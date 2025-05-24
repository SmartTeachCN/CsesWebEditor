// 初始化
const version = "2.4";
function init() {
  storage.init();
  activityBar.init();
  schedule.init();
  subjects.init();
  storage.initEnv();
  initDragDrop();
}

const activityBar = {
  init() {
    document.querySelectorAll(".activity-item").forEach((item) => {
      item.addEventListener("click", () => {
        document
          .querySelectorAll(".activity-item")
          .forEach((i) => i.classList.remove("selected"));
        item.classList.add("selected");
        document.getElementById("explorerTitle").innerHTML = item.dataset.des;
        this.toggle(item.dataset.view);
      });
    });
    document.querySelectorAll("#mobile-bottomBar > button").forEach((item) => {
      item.addEventListener("click", () => {
        document
          .querySelectorAll("#mobile-bottomBar > button")
          .forEach((i) => i.classList.remove("selected"));
        item.classList.add("selected");
        this.toggle(item.dataset.view, true);
        document.getElementById("explorerTitle").innerHTML = item.dataset.des;
      });
    });
  },
  toggle(view) {
    document.querySelectorAll(".editor-area > div").forEach((div) => {
      div.style.display = "none";
    });
    document.getElementsByClassName("explorer")[0].style.display = "block";
    document.getElementById(`${view}-editor`).style.display = "none";
    document.getElementsByClassName(`editor-area`)[0].style.borderRadius = "0px";
    if (view === "schedule") {
      document.getElementById("explorerB").style.display = "block";
      document.getElementById("cloud-list").style.display = "none";
      if (checkDeviceType()) {
        location.href = "#";
        document.getElementsByClassName("editor-area")[0].style.display = "none";
      }
      schedule.init();
      subjects.init();
    } else if (view === "source") {
      document.getElementById("explorerB").style.display = "none";
      document.getElementById("cloud-list").style.display = "none";
      document.getElementsByClassName("explorer")[0].style.display = "none";
      document.getElementById(`${view}-editor`).style.display = "block";
      document.getElementsByClassName(`editor-area`)[0].style.borderRadius = "10px 0px 0px 0px";
        document.getElementById("yaml-editor").value = file.preview();
      if (checkDeviceType()) {
        location.href = "#";
        document.getElementsByClassName("editor-area")[0].style.display = "block";
      }
      console.log("source" + localStorage.getItem("output-mode"));
    } else if (view === "cloud") {
      if (!hasLogin) {
        this.toggle("schedule");
        return;
      }
      document.getElementById("explorerB").style.display = "none";
      document.getElementById("cloud-list").style.display = "block";
      document.getElementsByClassName("editor-area")[0].style.display = "block";
      document.getElementById(`${view}-editor`).style.display = "block";
    } else if (view === "control") {
      if (!hasLogin) {
        this.toggle("schedule");
        return;
      }
      document.getElementsByClassName(`editor-area`)[0].style.borderRadius = "10px 0px 0px 0px";
      document.getElementById("explorerB").style.display = "none";
      document.getElementById("cloud-list").style.display = "none";
      document.getElementsByClassName("explorer")[0].style.display = "none";
      document.getElementById(`${view}-editor`).style.display = "block";
      if (
        localStorage.getItem("output-mode") == "cy" ||
        localStorage.getItem("output-mode") == undefined
      ) {
      } else if (localStorage.getItem("output-mode") == "cj") {
      } else if (localStorage.getItem("output-mode") == "ci") {
      }
      if (checkDeviceType()) {
        location.href = "#";
        document.getElementsByClassName("editor-area")[0].style.display = "block";
      }
    }
    trickAnimation();
  }
}

// 文本成员路径

init();
