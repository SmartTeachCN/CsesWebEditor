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
      if (
        localStorage.getItem("output-mode") == "cy" ||
        localStorage.getItem("output-mode") == undefined
      ) {
        document.getElementById("yaml-editor").value = jsyaml.dump(currentData);
      } else if (localStorage.getItem("output-mode") == "cj") {
        document.getElementById("yaml-editor").value = JSON.stringify(
          currentData,
          null,
          2
        );
      } else if (localStorage.getItem("output-mode") == "ci") {
        document.getElementById("yaml-editor").value = JSON.stringify(
          CsestoCiFromat(currentData),
          null,
          2
        );
      }
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

function about() {
  showModal(`
    <svg width="40px" height="40px" viewBox="0 0 4187.9814 3675.33532" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="margin-right: 10px;margin-bottom: -2px;"><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g id="Group-2" fill="black" fill-rule="nonzero"><path d="M2341.05715,2982.59251 C2372.30704,3250.76666 2505.09185,3487.94928 2699.95318,3654.68018 L1168.41105,3675.33532 L1484.81105,3122.53532 C1484.81105,3122.53532 1597.21105,3170.53532 1670.01105,3167.33532 L2341.05715,2982.59251 Z M2444.01105,1227.73532 L2569.21105,1710.53532 L2168.41105,2350.53532 L2539.33759,2238.11256 C2485.51154,2310.62748 2440.85665,2390.357 2407.08834,2475.58568 L1874.01105,2621.73532 C1706.81105,2620.93532 1635.61105,2502.53532 1635.61105,2502.53532 L1472.01105,1964.93532 L1952.01105,1363.73532 C1928.01105,1311.73532 1868.41105,1341.33532 1868.41105,1341.33532 L768.811051,1655.73532 L1096.81105,2827.33532 C1106.01105,2870.53532 1200.81105,2955.73532 1200.81105,2955.73532 L902.411051,3477.33532 L90.4110514,2081.33532 C3.17905137,1948.23132 0.0606421689,1803.4638 0.000468264659,1786.57087 L-8.85882633e-13,1785.6676 C0.00141576737,1785.183 0.00524647955,1784.93532 0.00524647955,1784.93532 C6.41105137,1641.33532 150.411051,1600.53532 150.411051,1600.53532 C150.411051,1600.53532 1982.01105,1090.13532 2179.21105,1060.53532 C2182.14438,1060.00198 2185.07772,1059.60198 2188.01105,1059.33532 C2378.41105,1036.93532 2444.01105,1227.73532 2444.01105,1227.73532 Z M3215.21105,172.135316 L4029.61105,1594.53532 C4094.81105,1723.73532 4088.81105,1802.93532 4088.81105,1802.93532 C4117.29258,1954.17225 4054.31158,2011.31026 4015.6776,2031.67651 L4015.69875,2031.6482 C3839.41063,1895.99596 3618.61478,1815.33532 3378.9814,1815.33532 C3329.14284,1815.33532 3280.11917,1818.82423 3232.14129,1825.57113 L2992.81105,909.735316 C2969.21105,823.335316 2886.41105,747.335316 2886.41105,747.335316 L3215.21105,172.135316 Z M1277.21105,0.135315706 L2897.21105,2.53531571 L2587.21105,544.535316 L2573.21105,536.135316 C2573.21105,536.135316 2451.61105,469.735316 2334.81105,502.535316 L395.211051,1041.73532 L910.411051,141.335316 C910.411051,141.335316 986.011051,-5.06468429 1277.21105,0.135315706 Z" id="Combined-Shape"></path><path d="M3378.9814,2051.33532 C3825.7814,2051.33532 4187.9814,2413.53732 4187.9814,2860.33532 C4187.9814,3307.13532 3825.7814,3669.33532 3378.9814,3669.33532 C2932.1834,3669.33532 2569.9814,3307.13532 2569.9814,2860.33532 C2569.9814,2413.53732 2932.1834,2051.33532 3378.9814,2051.33532 Z M3653.4814,2440.33532 C3641.03696,2440.33532 3629.17585,2442.66865 3617.89807,2447.33532 C3606.62029,2452.00198 3596.31474,2458.61309 3586.9814,2467.16865 L2970.9814,3082.00198 L2970.9814,3280.33532 L3169.31474,3280.33532 L3784.14807,2665.50198 C3793.4814,2656.16865 3800.28696,2645.86309 3804.56474,2634.58532 C3808.84252,2623.30754 3810.9814,2611.44643 3810.9814,2599.00198 C3810.9814,2587.33532 3808.84252,2575.66865 3804.56474,2564.00198 C3800.28696,2552.33532 3793.4814,2542.2242 3784.14807,2533.66865 L3719.9814,2468.33532 C3711.42585,2459.00198 3701.31474,2452.00198 3689.64807,2447.33532 C3677.9814,2442.66865 3665.92585,2440.33532 3653.4814,2440.33532 Z M3652.31474,2533.66865 L3717.64807,2599.00198 L3652.31474,2664.33532 L3586.9814,2599.00198 L3652.31474,2533.66865 Z" id="Combined-Shape"></path></g></g></svg>
      <h2 style="margin-bottom:6px">CSES Cloud</h2><i>为集控统一而诞生的云平台 基于CSES Editor</i>

  <b>当前版本: </b>${version}
    <b>开发人员: </b>PYLXU、RinLit、MKStoler1024
    <b>项目地址: </b><a href="https://github.com/CSES-org/CsesWebEditor">GitHub</a>
   <b>开放许可: </b>MIT License`);
}
