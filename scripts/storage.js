let currentData = {
  version: 1,
  subjects: [],
  schedules: [],
};
var tempData;

const storage = {
  init() {
    try {
      const saved = localStorage.getItem("csesData");
      if (saved) currentData = JSON.parse(saved);
      if (currentData.version == undefined) {
        currentData.version = 1;
        localStorage.setItem("csesData", currentData);
      }
    } catch (error) {
      console.log(error);
    }
  },
  save() {
    localStorage.setItem("csesData", JSON.stringify(currentData));
  },
  clear() {
    // 这个函数好像没用到，但还是留着吧
    confirm("确定要清空所有数据吗？", (result) => {
      if (result) {
        localStorage.clear();
        currentData = { version: 1, subjects: [], schedules: [] };
        location.reload();
      }
    });
  },
  initEnv() {
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

    document.getElementById("output-mode").value =
      localStorage.getItem("output-mode") ?? "cy";
  },
  outputSet() {
    const mode = document.getElementById(
      hasLogin ? "output-mode" : "output-mode2"
    ).value;
    // document.getElementById("donwCiCB").style.display = "none";
    // document.getElementById("config_preview").style.display = "none";
    document.getElementById("config_preview2").style.display = "none";
    localStorage.setItem("output-mode", mode);
    controlMgr.init(true);
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
      // document.getElementById("donwCiCB").style.display = "inline-flex";
    } else if (localStorage.getItem("output-mode") == "es") {
      document.getElementById("yaml-editor").value = JSON.stringify(
        es_procees(currentData),
        null,
        2
      );
      // document.getElementById("config_preview").style.display = "inline-flex";
      if (!hasLogin) {
        document.getElementById("config_preview2").style.display =
          "inline-flex";
      }
    }
  },
  getOutputMode() {
    return localStorage.getItem("output-mode") ?? "cy";
  },
  preview() {
    const mode = document.getElementById(
      hasLogin ? "output-mode" : "output-mode2"
    ).value;
    const terminalId = localStorage.getItem("currentTerminalId");
    if (mode == "es") {
      const url = `https://cloud.smart-teach.cn/es/link.php?id=${document.querySelectorAll(".directoryId")[0].innerHTML + "/" + terminalId}`
      showModal(`<h2>在云端ExamSchedule使用您的配置</h2>
        <li>复制链接，通过集控/手动在设备上打开链接即可</li><li>编辑配置后，无需重新复制链接，原链接为最新档案</li>
        ${url}<br>
        <fluent-button onclick="navigator.clipboard.writeText('${url}')">复制</fluent-button>&nbsp;<fluent-button onclick="window.open('${url}')"><i class="bi bi-play-circle" style="font-size: 12px;margin: 0;margin-right: 5px;"></i>打开链接</fluent-button>
        `)
    } else if (mode == "ci") {
      showModal(`<h2>在ClassIsland使用静态配置</h2>
        <li>下载清单文件，保存到您可以访问的位置</li><li>打开ClassIsland设置页面，右上角菜单点击“加入管理”</li><li>点击“配置文件”左侧的文件夹图标</li><li>选择您刚刚下载的清单文件，点击“打开”</li><li>在“ID”处输入您在CSES Cloud创建的终端名称，无需带上目录ID</li>
        <fluent-button id="download-manifest-btn"><i class="bi bi-download" style="font-size: 12px;margin: 0;margin-right: 5px;"></i>下载清单文件</fluent-button>
        `);

      setTimeout(() => {
        const btn = document.getElementById("download-manifest-btn");
        if (btn) {
          btn.onclick = function () {
            // 创建一个JSON对象
            const data = {
              ManagementServerKind: 0,
              ManagementServer: "",
              ManagementServerGrpc: "",
              ManifestUrlTemplate:
                "https://cloud.smart-teach.cn/classisland/manifest.php?id=" +
                document.querySelectorAll(".directoryId")[0].innerHTML,
            };

            // 将JSON对象转换为字符串
            const jsonString = JSON.stringify(data, null, 2);

            // 创建一个Blob对象，设置文件类型为JSON
            const blob = new Blob([jsonString], { type: "application/json" });

            // 创建一个下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "file.json"; // 设置下载文件的名称
            a.click(); // 触发下载
            URL.revokeObjectURL(url); // 释放对象URL
          };
        }
      }, 0);

    } else {
      alert("当前终端类型暂无该操作");
    }

  },
};

const tool = {
  isJson(text) {
    try {
      JSON.parse(text);
    } catch (e) {
      return false;
    }
    return true;
  },
  isYaml(text) {
    try {
      jsyaml.load(text);
    } catch (e) {
      return false;
    }
    return true;
  },
  setNestedValue(obj, path, value) {
    const keys = path.split(".");
    const lastKeyIndex = keys.length - 1;
    for (let i = 0; i < lastKeyIndex; i++) {
      const key = keys[i];
      if (!obj[key]) {
        obj[key] = {};
      }
      obj = obj[key];
    }
    obj[keys[lastKeyIndex]] = value;
  },
  getNestedValue(obj, path) {
    const keys = path.split(".");

    for (let key of keys) {
      if (!obj || typeof obj !== "object" || !obj.hasOwnProperty(key)) {
        return undefined;
      }
      obj = obj[key];
    }
    return obj;
  },
};

const file = {
  preview(outputMode) {
    if (!outputMode) outputMode = localStorage.getItem("output-mode");
    if (outputMode == "cy" || outputMode == undefined) {
      return jsyaml.dump(currentData);
    } else if (outputMode == "cj") {
      return JSON.stringify(currentData, null, 2);
    } else if (outputMode == "ci") {
      return JSON.stringify(CsestoCiFromat(currentData), null, 2);
    } else if (outputMode == "es") {
      return JSON.stringify(es_procees(currentData), null, 2);
    }
  },
  export(noNotice) {
    const outputMode = localStorage.getItem("output-mode") || "cy";
    const cloudFormat = "JSON"; // 云端上传始终使用普通 JSON 格式
    let dataToExport;

    dataToExport = file.preview(outputMode);

    if (noNotice) return;
    saveToCloud(dataToExport, cloudFormat, noNotice);
  },
  exportL() {
    if (
      localStorage.getItem("output-mode") == "ci" ||
      localStorage.getItem("output-mode") == undefined
    ) {
      const Str = JSON.stringify(CsestoCiFromat(currentData), null, 2);
      const blob = new Blob([Str], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "file.json";
      a.click();
      URL.revokeObjectURL(url);
    } else if (
      localStorage.getItem("output-mode") == "cj" ||
      localStorage.getItem("output-mode" == "es")
    ) {
      const Str = JSON.stringify(currentData, null, 2);
      const blob = new Blob([Str], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "file.json";
      a.click();
      URL.revokeObjectURL(url);
    } else if (localStorage.getItem("output-mode") == "cy") {
      const Str = jsyaml.dump(currentData);
      const blob = new Blob([Str], { type: "application/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "file.yaml";
      a.click();
      URL.revokeObjectURL(url);
    }
  },
  importS(str, showNotice = false) {
    if (!str) return;
    console.log("导入数据:");
    try {
      data = [];
      let source;
      if (str.target && str.target.result) {
        source = str.target.result;
      } else {
        source = str;
      }
      format = "YAML";
      format2 = "";
      if (tool.isJson(source) && isCiFormat(JSON.parse(source))) {
        data = CiToCsesFromat(JSON.parse(source));
        format = "ClassIsland课表档案";
        format2 = "ci";
      } else if (tool.isJson(source && source.examInfos !== null)) {
        data = JSON.parse(source);
        format = "ExamSchedule";
        format2 = "es";
      } else if (tool.isJson(source)) {
        data = JSON.parse(source);
        format = "JSON";
        format2 = "cj";
      } else if (tool.isYaml(source)) {
        data = jsyaml.load(source);
        format = "YAML";
        format2 = "cy";
      } else {
        throw new Error("未知的文件类型");
      }

      if (data?.success == false) {
        throw new Error("当前终端可能已被移除，请重新点击左侧按钮打开");
      }
      console.log(data);

      console.log("导入格式:" + format);

      tempData = data;
      let unknownSubjects = [];
      let knownSubjects = [];
      // 未知科目检查 + 格式检查
      if (tempData.subjects && tempData.subjects.length !== 0) {
        tempData.subjects.forEach((s, index) => {
          if (!s.name) throw new Error(`科目${index}中缺少科目名称`);
          knownSubjects.push(s.name);
        });
      } else {
        tempData.subjects = [];
      }
      if (tempData.schedules && tempData.schedules.length !== 0) {
        tempData.schedules.forEach((schedule, index) => {
          if (!schedule.name) throw new Error(`课程${index}中缺少课程名称`);
          // if (!schedule.enable_day)
          //   throw new Error(`解析出错:课程${schedule.name}中缺少课程启用时间`);
          // if (!schedule.weeks)
          //   throw new Error(`解析出错:课程${schedule.name}中缺少课程启用时间`);
          schedule.classes.forEach((classe, index2) => {
            // if (!classe.subject)
            //   throw new Error(`解析出错:课程${schedule.name}中节次${index2}缺少科目`);
            // if (!classe.start_time)
            //   throw new Error(
            //     `解析出错:课程${schedule.name}中节次${index2}缺少开始时间`
            //   );
            // if (!classe.end_time)
            //   throw new Error(
            //     `解析出错:课程${schedule.name}中节次${index2}缺少结束时间`
            //   );
            if (classe.subject == "") classe.subject = "-";
            if (
              !knownSubjects.includes(classe.subject) &&
              !unknownSubjects.includes(classe.subject)
            ) {
              unknownSubjects.push(classe.subject);
              tempData.subjects.push({ name: classe.subject });
            }
          });
        });
      } else {
        tempData.schedules = [];
      }
      let unknownSubjectsStr;
      if (unknownSubjects) {
        unknownSubjects.forEach((s) => {
          if (unknownSubjectsStr) {
            unknownSubjectsStr = unknownSubjects + "、" + s;
          } else {
            unknownSubjectsStr = s;
          }
        });
      }
      if (unknownSubjectsStr)
        unknownSubjects =
          "除文件内已定义科目,文件课程表中还有这些未知的科目字段:" +
          unknownSubjectsStr +
          " 在导入时将一并导入科目列表";
      if (showNotice) {
        confirm(
          `文件解析成功,文件格式:${format},按确认以导入(当前课程信息将丢失)` +
          "<br>" +
          unknownSubjects,
          (result) => {
            if (result) {
              currentData = tempData;
              storage.save();
              // location.reload();
            }
          }
        );
      } else {
        currentData = tempData;
        storage.save();
      }
      document.getElementById("output-mode").value = format2;
      // document.getElementById("donwCiCB").style.display =
      // format2 == "ci" ? "inline-flex" : "none";
    } catch (error) {
      alert(`数据加载${error}`);
    }
  },
  async import() {
    const fileInput = document.getElementById("file-input");
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.importS(e, true);
      };
      reader.readAsText(file);
    };
    fileInput.click();
  },
};
