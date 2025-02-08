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

function isJson(text) {
  try {
    JSON.parse(text);
  } catch (e) {
    return false;
  }
  return true;
}

function isYaml(text) {
  try {
    jsyaml.load(text);
  } catch (e) {
    return false;
  }
  return true;
}

document.getElementById("output-mode").value =
  localStorage.getItem("output-mode") ?? "cy";
function outputSet() {
  const mode = document.getElementById("output-mode").value;
  localStorage.setItem("output-mode", mode);
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
}

// 文件导出
function exportFile() {
  if (
    localStorage.getItem("output-mode") == "cy" ||
    localStorage.getItem("output-mode") == undefined
  ) {
    const yamlStr = jsyaml.dump(currentData);
    const blob = new Blob([yamlStr], { type: "text/yaml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "schedule.yaml";
    link.click();
  } else if (localStorage.getItem("output-mode") == "cj") {
    const jsonStr = JSON.stringify(currentData, null, 2);
    const blob = new Blob([jsonStr], { type: "text/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "schedule.json";
    link.click();
  } else if (localStorage.getItem("output-mode") == "ci") {
    const jsonStr = JSON.stringify(CsestoCiFromat(currentData), null, 2);
    const blob = new Blob([jsonStr], { type: "text/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "schedule.json";
    link.click();
  }
}

// 清空数据
function clearData() {
  confirm("确定要清空所有数据吗？", (result) => {
    if (result) {
      localStorage.clear();
      currentData = { version: 1, subjects: [], schedules: [] };
      location.reload();
    }
  });
}

// 初始化拖拽导入
function initDragDrop() {
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) await importFile(file);
  });
}

// 文件导入
var tempData;

async function importFile() {
  const fileInput = document.getElementById("file-input");
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        data = [];
        const source = e.target.result;
        format = "";
        if (isJson(source) && isCiFormat(JSON.parse(source))) {
          data = CiToCsesFromat(JSON.parse(source));
          format = "ClassIsland课表档案";
        } else if (isJson(source)) {
          data = JSON.parse(source);
          format = "JSON";
        } else if (isYaml(source)) {
          data = jsyaml.load(source);
          format = "YAML";
        } else {
          throw new Error("解析失败:未知的文件类型");
        }

        console.log(data);
        console.log("导入格式:" + format);

        tempData = data;
        let unknownSubjects = [];
        let knownSubjects = [];
        // 未知科目检查 + 格式检查
        tempData.subjects.forEach((s, index) => {
          if (!s.name) throw new Error(`解析出错:科目${index}中缺少科目名称`);
          knownSubjects.push(s.name);
        });
        tempData.schedules.forEach((schedule, index) => {
          if (!schedule.name)
            throw new Error(`解析出错:课程${index}中缺少课程名称`);
          if (!schedule.enable_day)
            throw new Error(`解析出错:课程${schedule.name}中缺少课程启用时间`);
          if (!schedule.weeks)
            throw new Error(`解析出错:课程${schedule.name}中缺少课程启用时间`);
          schedule.classes.forEach((classe, index2) => {
            // if (!classe.subject)
            //   throw new Error(`解析出错:课程${schedule.name}中节次${index2}缺少科目`);
            if (!classe.start_time)
              throw new Error(
                `解析出错:课程${schedule.name}中节次${index2}缺少开始时间`
              );
            if (!classe.end_time)
              throw new Error(
                `解析出错:课程${schedule.name}中节次${index2}缺少结束时间`
              );
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
        confirm(
          `文件解析成功,文件格式:${format},按确认以导入(当前课程信息将丢失)` +
            "<br>" +
            unknownSubjects,
          (result) => {
            if (result) {
              currentData = tempData;
              saveSchedule();
              location.reload();
            }
          }
        );
      } catch (error) {
        alert(`导入失败: ${error}`);
      }
    };
    reader.readAsText(file);
  };
  fileInput.click();
}
