// 加载
const loadSettingsFile = async (configType, recall) => {
  if (!configType) {
    console.error("Invalid config type");
    showErrorMessage("请选择有效的配置类型");
    return null;
  }

  try {
    const response = await fetch(`./control/settings-${configType}.json`);
    if (recall) exportFile(true);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const settingsData = await response.json();
    return settingsData;
  } catch (error) {
    console.error("Failed to load settings:", error);
    showErrorMessage(`配置加载失败: ${error.message}`);
    return null;
  }
};

// 控件创建器
const createControl = (setting) => {
  const container = document.createElement("div");
  container.className = "control-container";

  switch (setting.type) {
    case "text":
      const textField = document.createElement("fluent-text-field");
      textField.value =
        setting.default ||
        getNestedValue(currentData, "extraKey." + setting.keyPath) ||
        "";
      textField.placeholder = setting.placeholder;
      textField.onchange = handleSettingChange;
      return textField;

    case "bool":
      const toggle = document.createElement("fluent-switch");
      toggle.checked = setting.default || getNestedValue(currentData, "extraKey." + setting.keyPath) || false;
      toggle.onchange = handleSettingChange;
      return toggle;

    case "time":
      const timePicker = document.createElement("input");
      timePicker.type = "time";
      timePicker.value = setting.default || getNestedValue(currentData, "extraKey." + setting.keyPath) || "00:00";
      timePicker.onchange = handleSettingChange;
      return timePicker;

    case "select":
      const select = document.createElement("fluent-select");
      setting.options.forEach((opt) => {
        const option = document.createElement("fluent-option");
        option.value = opt.value || getNestedValue(currentData, "extraKey." + setting.keyPath);
        option.textContent = opt.label;
        select.appendChild(option);
      });
      select.onchange = handleSettingChange;

      select.value = setting.default;
      return select;

    case "number":
      const numberField = document.createElement("fluent-number-field");
      numberField.value = setting.default || getNestedValue(currentData, "extraKey." + setting.keyPath) || 0;
      numberField.min = setting.min;
      numberField.max = setting.max;
      numberField.step = setting.step;
      numberField.onchange = handleSettingChange;

      return numberField;

    case "html":
      const textElement = document.createElement("span");
      textElement.innerHTML = setting.default || getNestedValue(currentData, "extraKey." + setting.keyPath) || "";
      textElement.onchange = handleSettingChange;
      return textElement;

    default:
      console.warn(`Unknown control type: ${setting.type}`);
      return document.createTextNode("不支持的控件类型");
  }
};

const generateTabs = (tabsData, settingsData) => {
  const tabsContainer = document.getElementById("settingsTabs");
  tabsContainer.innerHTML = "";

  // fluent-tabs
  const fluentTabs = document.createElement("fluent-tabs");
  fluentTabs.setAttribute("activeid", tabsData[0].eng_name.toLowerCase());

  tabsData.forEach((tab, index) => {
    // fluent-tab
    const tabElement = document.createElement("fluent-tab");
    tabElement.id = tab.eng_name.toLowerCase();
    tabElement.innerHTML =
      "&nbsp;&nbsp;<i class='bi " + tab.icon + "'></i>&nbsp;" + tab.name;
    fluentTabs.appendChild(tabElement);

    // fluent-tab-panel
    const tabPanel = document.createElement("fluent-tab-panel");
    tabPanel.id = `${tab.eng_name.toLowerCase()}Panel`;

    const settingsForTab = settingsData.filter((setting) =>
      tab.settings.includes(setting.keyPath)
    );
    generateSettingsCards(settingsForTab, tabPanel);

    fluentTabs.appendChild(tabPanel);
  });
  tabsContainer.appendChild(fluentTabs);
};

// 卡片生成
const generateSettingsCards = (settings, container) => {
  settings.forEach((setting) => {
    const card = document.createElement("div");
    card.className = "settings-card";

    const icon = document.createElement("i");
    icon.className = `bi ${setting.icon}`;
    card.appendChild(icon);

    const leftSection = document.createElement("div");
    leftSection.className = "left-section";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = setting.name;
    leftSection.appendChild(title);

    const description = document.createElement("div");
    description.className = "description";
    description.textContent = setting.description;
    leftSection.appendChild(description);
    card.appendChild(leftSection);

    const rightSection = document.createElement("div");
    rightSection.className = "right-section";

    const control = createControl(setting);
    control.id = setting.keyPath;
    rightSection.appendChild(control);

    card.appendChild(rightSection);
    container.appendChild(card);
  });
};

// 功能函数
const handleSettingChange = (event) => {
  const control = event.target;
  const settingKey = control.id;
  const value =
    control.role === "switch"
      ? !control.className.includes("checked")
      : control.value;

  console.log(`设置项变更: ${settingKey} = ${value}`);
  validateControl(control);

  // currentData.extraKey[settingKey] = value;
  setNestedValue(currentData, "extraKey." + settingKey, value);
  exportFile(true);
};

const validateControl = (control) => {
  const errorElement = document.getElementById(`${control.id}-error`);
  if (!errorElement) return;

  if (control.validity.valueMissing) {
    errorElement.textContent = "此项为必填项";
  } else if (control.validity.rangeUnderflow) {
    errorElement.textContent = `数值不能小于${control.min}`;
  } else {
    errorElement.textContent = "";
  }
};

// 初始化
const initializeSettings = async (recall) => {
  try {
    const configType = document.getElementById(
      hasLogin ? "output-mode" : "output-mode2"
    ).value;
    const settingsData = await loadSettingsFile(configType, recall);
    if (!settingsData) return;

    generateTabs(settingsData.tabs, settingsData.settings);
  } catch (error) {
    console.error("初始化失败:", error);
  }
};
