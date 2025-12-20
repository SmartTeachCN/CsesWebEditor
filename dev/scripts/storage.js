let currentData = {
  version: 1,
  subjects: [],
  schedules: [],
  timetables: [], // 时间表模板（导出/导入）
};
var tempData;

const storage = {
  init() {
    try {
      console.log('storage.init');
      const saved = localStorage.getItem("csesData");
      console.log('storage.init saved exists', !!saved);
      if (saved) {
        try {
          currentData = JSON.parse(saved);
          console.log('storage.init parsed', { subjects: Array.isArray(currentData.subjects) ? currentData.subjects.length : 0, schedules: Array.isArray(currentData.schedules) ? currentData.schedules.length : 0, timetables: Array.isArray(currentData.timetables) ? currentData.timetables.length : 0 });
        } catch {
          currentData = { version: 1, subjects: [], schedules: [], timetables: [] };
          localStorage.setItem("csesData", JSON.stringify(currentData));
          console.warn('storage.init parse failed, reset default');
        }
      }
      if (currentData.version == undefined) {
        currentData.version = 1;
        localStorage.setItem("csesData", JSON.stringify(currentData));
        console.log('storage.init set version default');
      }
      // 兼容旧数据结构
      if (!Array.isArray(currentData.timetables)) currentData.timetables = [];
      console.log('storage.init ready', { subjects: Array.isArray(currentData.subjects) ? currentData.subjects.length : 0, schedules: Array.isArray(currentData.schedules) ? currentData.schedules.length : 0, timetables: Array.isArray(currentData.timetables) ? currentData.timetables.length : 0 });
    } catch (error) {
      console.log(error);
    }
  },
  save() {
    localStorage.setItem("csesData", JSON.stringify(currentData));
    try { window.__unsaved = false; } catch {}
  },
  clear() {
    // 这个函数好像没用到，但还是留着吧
    confirm("确定要清空所有数据吗？", (result) => {
      if (result) {
        localStorage.clear();
        currentData = { version: 1, subjects: [], schedules: [], timetables: [] };
        location.reload();
      }
    });
  },
  initEnv() {
    const modeRaw = localStorage.getItem("output-mode") ?? "cy";
    const mode = modeRaw === "cj" ? "cy" : modeRaw; // 隐藏cj，回退到cy
    if (modeRaw === "cj") localStorage.setItem("output-mode", mode);
    const yamlEditor = document.getElementById("yaml-editor");
    if (yamlEditor) {
      if (mode === "cy") {
        yamlEditor.value = jsyaml.dump(currentData);
      } else if (mode === "ci") {
        yamlEditor.value = JSON.stringify(CsestoCiFromat(currentData), null, 2);
      } else if (mode === "es") {
        yamlEditor.value = JSON.stringify(es_procees(currentData), null, 2);
      }
    }
    const selOnline = document.getElementById("output-mode");
    const selOffline = document.getElementById("output-mode2");
    if (selOnline) selOnline.value = mode;
    if (selOffline) selOffline.value = mode;
    try { console.log('initEnv set mode', mode, { online: !!selOnline, offline: !!selOffline }); } catch {}
  },
  outputSet() {
    const login = window.hasLogin ?? false;
    const selOnline = document.getElementById("output-mode");
    const selOffline = document.getElementById("output-mode2");
    const modeRaw = selOnline?.value ?? selOffline?.value ?? localStorage.getItem("output-mode") ?? "cy";
    const mode = modeRaw === "cj" ? "cy" : modeRaw; // 隐藏cj，回退到cy
    localStorage.setItem("output-mode", mode);
    try { localStorage.setItem('control_need_refresh', '1'); } catch {}
    try {
      const iframe = document.getElementById('editor-frame');
      const win = iframe?.contentWindow;
      const isControl = (()=>{ try { const src = iframe?.src || ''; return /\/pages\/editor\/control\.html/i.test(src); } catch { return false } })();
      if (isControl) {
        if (win && win.controlMgr) { win.controlMgr.init(true); }
        else { try { iframe.src = `pages/editor/control.html?refresh=1`; } catch {} }
      }
    } catch (e) { console.warn("controlMgr.init failed", e); }
    const yamlEditor = document.getElementById("yaml-editor");
    if (!yamlEditor) return;
    if (mode === "cy") {
      yamlEditor.value = jsyaml.dump(currentData);
    } else if (mode === "ci") {
      yamlEditor.value = JSON.stringify(CsestoCiFromat(currentData), null, 2);
    } else if (mode === "es") {
      yamlEditor.value = JSON.stringify(es_procees(currentData), null, 2);
    }
    try { schedule.toggleOutputCards && schedule.toggleOutputCards(); } catch (e) { console.warn("schedule.toggleOutputCards failed", e); }
  },
  getOutputMode() {
    const modeRaw = localStorage.getItem("output-mode") ?? "cy";
    return modeRaw === "cj" ? "cy" : modeRaw;
  },
  preview() {
    const mode = localStorage.getItem("output-mode") ?? "cy";
    const terminalId = localStorage.getItem("currentTerminalId");
    const directoryId = localStorage.getItem("directoryId") || '';
    if (mode == "es") {
      const url = `https://cloud.smart-teach.cn/es/link.php?id=${directoryId}/${terminalId}`;
      showModal(`<h2>在云端ExamSchedule使用您的配置</h2>
        <li>复制链接，通过集控/手动在设备上打开链接即可</li><li>编辑配置后，无需重新复制链接，原链接为最新档案</li>
        ${url}<br>
        <fluent-button onclick="navigator.clipboard.writeText('${url}')">复制</fluent-button>&nbsp;<fluent-button onclick="window.open('${url}')"><i class="bi bi-play-circle" style="font-size: 12px;margin: 0;margin-right: 5px;"></i>打开链接</fluent-button>
        `)
    } else if (mode == "ci") {
      showModal(`<h2>在ClassIsland使用静态配置</h2>
        <li>下载清单文件，保存到您可以访问的位置</li><li>打开ClassIsland设置页面，右上角菜单点击“加入管理”</li><li>点击“配置文件”左侧的文件夹图标</li><li>选择您刚刚下载的清单文件，点击“打开”</li><li>在“ID”处输入您在CSES Cloud创建的实例名称，无需带上目录ID</li>
        <fluent-button id="download-manifest-btn"><i class="bi bi-download" style="font-size: 12px;margin: 0;margin-right: 5px;"></i>下载清单文件</fluent-button>
        `);

      setTimeout(() => {
        const btn = document.getElementById("download-manifest-btn");
        if (btn) {
          btn.onclick = function () {
            const data = {
              ManagementServerKind: 0,
              ManagementServer: "",
              ManagementServerGrpc: "",
              ManifestUrlTemplate:
                "https://cloud.smart-teach.cn/classisland/manifest.php?id=" +
                document.querySelectorAll(".directoryId")[0].innerHTML,
            };

            const jsonString = JSON.stringify(data, null, 2);

            const blob = new Blob([jsonString], { type: "application/json" });

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            document.body.appendChild(a);
            a.href = url;
            a.download = "file.json";
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          };
        }
      }, 0);

    } else {
      alert("当前实例类型暂无该操作");
    }
  },
};

try { window.storage = storage; } catch {}

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
    try { window.__unsynced = true; } catch {}
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
    const mode = (outputMode === "cj") ? "cy" : (outputMode || "cy");
    // 克隆 currentData，合并本地时间表选择到导出数据
    const data = JSON.parse(JSON.stringify(currentData));
    try {
      if (Array.isArray(data.schedules) && typeof timetableState !== "undefined" && timetableState && timetableState.schedules) {
        data.schedules.forEach((sch, idx) => {
          const st = timetableState.schedules[idx];
          if (st && st.templateName) sch.timetable_name = st.templateName;
        });
      }
    } catch (e) {
      console.warn('merge timetable_name failed in preview', e);
    }
    if (mode == "cy" || mode == undefined) {
      return jsyaml.dump(data);
    } else if (mode == "ci") {
      return JSON.stringify(CsestoCiFromat(data), null, 2);
    } else if (mode == "es") {
      return JSON.stringify(es_procees(data), null, 2);
    }
  },
  export(noNotice) {
    const cloudFormat = "JSON";
    const dataToExport = buildCloudPayload();
    if (noNotice) return;
    saveToCloud(dataToExport, cloudFormat, noNotice);
    try { window.__unsynced = false; } catch {}
  },
  exportL() {
    let mode = localStorage.getItem("output-mode") || "cy";
    if (mode === "cj") mode = "cy"; // 隐藏cj，回退到cy
    const Str = file.preview(mode);
    let mime = "application/yaml";
    let filename = "file.yaml";
    if (mode === "ci") {
      mime = "application/json";
      filename = "file.json";
    } else if (mode === "es") {
      mime = "application/json";
      filename = "exam_config.json";
    }
    const blob = new Blob([Str], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
      } else if (tool.isJson(source)) {
        const parsed = JSON.parse(source);
        if (parsed && (parsed.examInfos !== undefined || parsed.examName !== undefined)) {
          data = parsed;
          format = "ExamSchedule";
          format2 = "es";
        } else {
          data = parsed;
          format = "JSON";
          format2 = "cj";
        }
      } else if (tool.isYaml(source)) {
        data = jsyaml.load(source);
        format = "YAML";
        format2 = "cy";
      } else {
        throw new Error("未知的文件类型");
      }

      if (data?.success == false) {
        throw new Error("当前实例可能已被移除，请重新点击左侧按钮打开");
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
          schedule.classes.forEach((classe, index2) => {
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
      // 兼容：确保时间表模板字段存在
      if (!Array.isArray(tempData.timetables)) tempData.timetables = [];
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
              try {
                if (Array.isArray(currentData.schedules)) {
                  if (typeof timetableState === "object" && timetableState && typeof timetableState.schedules === "object") {
                    currentData.schedules.forEach((sch, idx) => {
                      const name = sch && sch.timetable_name ? sch.timetable_name : '';
                      timetableState.schedules[idx] = { templateName: name, modified: false };
                    });
                    try { saveTimetableState && saveTimetableState(); } catch (e) {}
                  }
                }
              } catch (e) {}
              // 初始化并刷新界面（包含时间表列表）
              try { schedule.init && schedule.init(); } catch (e) { console.warn('schedule.init failed after import', e); }
              // location.reload();
            }
          }
        );
      } else {
        currentData = tempData;
        storage.save();
        try {
          if (Array.isArray(currentData.schedules)) {
            if (typeof timetableState === "object" && timetableState && typeof timetableState.schedules === "object") {
              currentData.schedules.forEach((sch, idx) => {
                const name = sch && sch.timetable_name ? sch.timetable_name : '';
                timetableState.schedules[idx] = { templateName: name, modified: false };
              });
              try { saveTimetableState && saveTimetableState(); } catch (e) {}
            }
          }
        } catch (e) {}
        // 初始化并刷新界面（包含时间表列表）
        try { schedule.init && schedule.init(); } catch (e) { console.warn('schedule.init failed after import', e); }
      }
      // 在成功解析并保存之后，设置输出模式选择与localStorage（隐藏cj -> cy）
      // 原有代码：
      // document.getElementById("output-mode").value = format2;
      // const offlineSel = document.getElementById("output-mode2");
      // if (offlineSel) offlineSel.value = format2;
      // localStorage.setItem("output-mode", format2);
      // 修改为：
      const effectiveFormat = (typeof format2 !== "undefined" && format2 === "cj") ? "cy" : format2;
      const onlineSel = document.getElementById("output-mode");
      if (onlineSel) onlineSel.value = effectiveFormat;
      const offlineSel = document.getElementById("output-mode2");
      if (offlineSel) offlineSel.value = effectiveFormat;
      if (effectiveFormat) localStorage.setItem("output-mode", effectiveFormat);
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

function buildCloudPayload() {
  try {
    const data = JSON.parse(JSON.stringify(currentData));
    if (Array.isArray(data.schedules) && typeof timetableState !== "undefined" && timetableState && timetableState.schedules) {
      data.schedules.forEach((sch, idx) => {
        const st = timetableState.schedules[idx];
        if (st && st.templateName) sch.timetable_name = st.templateName;
      });
    }
    return JSON.stringify(data);
  } catch (e) {
    try { return JSON.stringify(currentData); } catch { return "{}"; }
  }
}
function isSkipUnsaved(target){
  try { return !!(target && target.closest('[data-skip-unsaved]')); } catch { return false }
}
try {
  window.__unsaved = window.__unsaved || false;
  window.__unsynced = window.__unsynced || false;
  window.markUnsynced = function(){ try { window.__unsynced = true; } catch {} };
  document.addEventListener('input', function(e){ try { if (!isSkipUnsaved(e.target)) { window.__unsaved = true; window.__unsynced = true; } } catch {} });
  if (typeof window.checkDeviceType !== 'function') {
    window.checkDeviceType = function(){
      try { return false; } catch { return false }
    };
  }
} catch {}
