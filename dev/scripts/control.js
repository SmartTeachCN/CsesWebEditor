/*
 * control.js —— 「配置」页面（集控设置 + CSES 文档配置）
 *
 * 设置项由 control/settings-<type>.json 描述：
 *   tabs[]    每个分页要显示哪些 keyPath
 *   settings[] 每一项的 type / keyPath / 名称与说明
 * 取值与写回都作用于 currentData（CSES 文档），写回后立即 storage.save()。
 *
 * CSES 的 v2 配置（configuration.name / description / cycle）就走这里，
 * 不再需要单独的「文档设置」页面：
 *   - cy1 / cy2 都读取 control/settings-cy.json
 *   - 标了 requiresVersion 的项只在对应 CSES 版本下显示
 */
const controlMgr = {
  /** 编辑器页既可能从 <root>/dev/pages/editor/ 载入（源码），也可能从 <root>/pages/editor/ 载入（构建产物） */
  settingsUrls(configType) {
    const file = `settings-${configType}.json`;
    return [
      `../../../control/${file}`, // <root>/dev/pages/editor/
      `../../control/${file}`,    // <root>/pages/editor/
      `/control/${file}`,         // 站点根目录部署
      `control/${file}`,          // 与页面同级
    ];
  },

  async init(recall) {
    try {
      const login = window.hasLogin ?? false;
      const selectId = login ? "output-mode" : "output-mode2";
      const select = document.getElementById(selectId);
      const rawType = select?.value ?? localStorage.getItem("output-mode") ?? "ci";
      // 导出格式已合并为 cy1 / cy2（CSES v1 / v2），集控设置模板按 cy 读取
      const configType = (rawType === "cy1" || rawType === "cy2" || rawType === "cy" || rawType === "cj")
        ? "cy"
        : rawType;
      const settingsData = await this.load(configType, recall);
      if (!settingsData) return;

      this.geneTabs(settingsData.tabs || [], settingsData.settings || []);
    } catch (error) {
      console.error("初始化失败:", error);
    }
  },

  /** 依次探测候选地址，兼容源码目录 / 构建产物 / 子目录部署 */
  async load(configType, recall) {
    if (!configType) {
      console.error("Invalid config type");
      alert("请选择有效的配置类型");
      return null;
    }

    let lastError = null;
    for (const url of this.settingsUrls(configType)) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) { lastError = new Error(`HTTP ${response.status}`); continue; }
        const settingsData = await response.json();
        console.log(`配置已载入: ${url}`);
        if (recall) { try { file.export(true); } catch {} }
        return settingsData;
      } catch (error) {
        lastError = error;
      }
    }

    console.error("Failed to load settings:", lastError);
    alert(`配置加载失败：${lastError && lastError.message ? lastError.message : '未知错误'}\n（已尝试 control/settings-${configType}.json 的常见位置）`);
    return null;
  },

  /** 当前 CSES 版本（CSES 模式下由导出格式决定） */
  configVersion() {
    try { return storage.getCsesVersion(); } catch { return 1; }
  },

  geneTabs(tabsData, settingsData) {
    const tabsContainer = document.getElementById("settingsTabs");
    tabsContainer.innerHTML = "";

    // fluent-tabs
    const fluentTabs = document.createElement("fluent-tabs");
    fluentTabs.setAttribute("activeid", tabsData.length ? tabsData[0].eng_name.toLowerCase() : '');

    tabsData.forEach((tab) => {
      // fluent-tab
      const tabElement = document.createElement("fluent-tab");
      tabElement.id = tab.eng_name.toLowerCase();
      tabElement.innerHTML =
        "&nbsp;&nbsp;&nbsp;<i class='bi " + tab.icon + "'></i>&nbsp;" + tab.name;
      fluentTabs.appendChild(tabElement);

      // fluent-tab-panel
      const tabPanel = document.createElement("fluent-tab-panel");
      tabPanel.id = `${tab.eng_name.toLowerCase()}Panel`;

      const settingsForTab = settingsData.filter((setting) =>
        (tab.settings || []).includes(setting.keyPath)
      );
      this.geneCards(settingsForTab, tabPanel);

      fluentTabs.appendChild(tabPanel);
    });
    tabsContainer.appendChild(fluentTabs);
  },

  geneCards(settings, container) {
    const version = this.configVersion();
    settings.forEach((setting) => {
      // 只在指定 CSES 版本下显示的项（例如 v2 的 configuration）
      if (setting.requiresVersion && parseInt(setting.requiresVersion, 10) !== version) return;

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

      const control = Fcard.create(setting);
      control.id = setting.keyPath;
      rightSection.appendChild(control);

      card.appendChild(rightSection);
      container.appendChild(card);
    });
  },

  /* ---------- CSES v2 的 configuration.cycle ---------- */
  cycle() {
    if (!currentData.configuration) {
      currentData.configuration = (window.cses && window.cses.defaultConfiguration)
        ? window.cses.defaultConfiguration()
        : { name: '', description: '', cycle: { work_count: 5, rest_count: 2, spans: [] } };
    }
    const cfg = currentData.configuration;
    if (!cfg.cycle) cfg.cycle = { work_count: 5, rest_count: 2, spans: [] };
    if (!Array.isArray(cfg.cycle.spans)) cfg.cycle.spans = [];
    return cfg.cycle;
  },

  /** 写回 configuration.cycle（顺带规范化为合法结构） */
  applyCycle(cycle, rerender) {
    const cfg = currentData.configuration || (currentData.configuration = {});
    cfg.cycle = (window.cses && window.cses.normalizeCycle)
      ? window.cses.normalizeCycle(cycle)
      : cycle;
    this.persist();
    if (rerender && typeof rerender === 'function') rerender();
  },

  /** 只改了 work_count / rest_count 而 spans 为空时，补一段工作 + 一段休息，保证导出合法 */
  ensureSpans() {
    const cycle = this.cycle();
    if (!cycle.spans.length) {
      cycle.spans = [
        { activity: 'work', count: cycle.work_count || 5 },
        { activity: 'rest', count: cycle.rest_count || 2 },
      ];
    }
  },

  /* ---------- 写回 ---------- */
  persist() {
    try { window.markUnsynced && window.markUnsynced(); } catch {}
    // 集控设置此前只改了内存里的 currentData，从未写回 localStorage，
    // 于是「保存到云 / 保存到实例」拿不到这些改动。这里补上持久化。
    try { storage.save(); } catch (e) { console.warn('storage.save failed', e); }
    try { file.export(true); } catch (e) { console.warn('file.export failed', e); }
    try { window.refreshFormatChecker && window.refreshFormatChecker(); } catch {}
  },

  apply(keyPath, value) {
    tool.setNestedValue(currentData, keyPath, value);
    // cycle 的总数变更后保证 spans 不为空
    if (keyPath === 'configuration.cycle.work_count' || keyPath === 'configuration.cycle.rest_count') {
      try { this.ensureSpans(); } catch (e) { console.warn('ensureSpans failed', e); }
    }
    this.persist();
  },

  handleChange(event) {
    const control = event && event.target;
    if (!control) return;
    const settingKey = control.id;
    let value = "";
    if (control.type === "color") {
      const hexColor = control.value;
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      value = { A: 255, R: r, G: g, B: b, ScA: 1, ScR: r / 255, ScG: g / 255, ScB: b / 255 };
    } else if (control.role === "switch" || typeof control.checked === 'boolean') {
      value = (typeof control.checked === 'boolean')
        ? control.checked
        : !control.className.includes("checked");
    } else {
      value = control.value;
    }
    console.log(`设置项变更: ${settingKey} = ${value}`);
    controlMgr.valid(control);

    // 纯整数文本
    if (typeof value === "string" && /^\-?\d+$/.test(value)) {
      value = parseInt(value, 10); // 转换为整数
    }
    // 注意：handleChange 作为事件处理器被调用时 this 是触发事件的元素，不能依赖 this
    controlMgr.apply(settingKey, value);
  },

  valid(control) {
    const errorElement = document.getElementById(`${control.id}-error`);
    if (!errorElement) return;

    if (control.validity.valueMissing) {
      errorElement.textContent = "此项为必填项";
    } else if (control.validity.rangeUnderflow) {
      errorElement.textContent = `数值不能小于${control.min}`;
    } else {
      errorElement.textContent = "";
    }
  }
}

const Fcard = {
  create(setting) {
    const container = document.createElement("div");
    container.className = "control-container";

    switch (setting.type) {
      case "text":
        const textField = document.createElement("fluent-text-field");
        setFluentValue(textField, tool.getNestedValue(currentData, setting.keyPath) ?? (setting.default || ""));
        textField.placeholder = setting.placeholder;
        textField.onchange = controlMgr.handleChange;
        return textField;

      case "bool":
        const toggle = document.createElement("fluent-switch");
        setFluentValue(toggle, tool.getNestedValue(currentData, setting.keyPath) ?? (setting.default || false), 'checked');
        toggle.onchange = controlMgr.handleChange;
        return toggle;

      case "time":
        const timePicker = document.createElement("input");
        timePicker.type = "time";
        timePicker.value = tool.getNestedValue(currentData, setting.keyPath) ?? (setting.default || "00:00");
        timePicker.onchange = controlMgr.handleChange;
        return timePicker;

      case "select":
        const select = document.createElement("fluent-select");
        setting.options.forEach((opt) => {
          const option = document.createElement("fluent-option");
          option.value = opt.value;
          option.textContent = opt.label;
          select.appendChild(option);
        });
        select.onchange = controlMgr.handleChange;
        setFluentValue(select, tool.getNestedValue(currentData, setting.keyPath) ?? (setting.default));
        return select;

      case "number":
        const numberField = document.createElement("fluent-number-field");
        numberField.min = setting.min;
        numberField.max = setting.max;
        numberField.step = setting.step;
        numberField.onchange = controlMgr.handleChange;
        setFluentValue(numberField, tool.getNestedValue(currentData, setting.keyPath) ?? (setting.default || 0));
        return numberField;

      case "color":
        const colorPicker = document.createElement("input");
        colorPicker.type = "color";
        colorPicker.id = setting.keyPath;
        const currentValue = tool.getNestedValue(currentData, setting.keyPath);
        if (currentValue) {
          const hexColor = `#${(currentValue.R).toString(16).padStart(2, '0')}${(currentValue.G).toString(16).padStart(2, '0')}${(currentValue.B).toString(16).padStart(2, '0')}`;
          colorPicker.value = hexColor;
        } else {
          colorPicker.value = setting.default ? `#${(setting.default.R).toString(16).padStart(2, '0')}${(setting.default.G).toString(16).padStart(2, '0')}${(setting.default.B).toString(16).padStart(2, '0')}` : "#000000";
        }
        colorPicker.onchange = controlMgr.handleChange;
        return colorPicker;

      case "object":
        const objectContainer = document.createElement("div");
        objectContainer.className = "object-container";
        const currentObject = tool.getNestedValue(currentData, setting.keyPath) ?? (setting.default || {});
        for (const key in currentObject) {
          const value = currentObject[key];
          const label = document.createElement("label");
          label.textContent = key;
          label.htmlFor = key;
          const input = document.createElement("input");
          input.type = "text";
          input.id = key;
          input.value = value || "";
          input.onchange = () => {
            const newValue = { ...currentObject };
            newValue[key] = input.value;
            controlMgr.apply(setting.keyPath, newValue);
          };
          objectContainer.appendChild(label);
          objectContainer.appendChild(input);
          objectContainer.appendChild(document.createElement("br"));
        }

        return objectContainer;

      case "html":
        const textElement = document.createElement("span");
        textElement.innerHTML = tool.getNestedValue(currentData, setting.keyPath) ?? (setting.default || "");
        textElement.onchange = controlMgr.handleChange;
        return textElement;

      case "note": {
        // 静态说明（用 {mode} 占位当前导出格式）
        const noteElement = document.createElement("div");
        noteElement.className = "control-note";
        noteElement.textContent = String(setting.note || '').replace('{mode}', (() => {
          try { return storage.getOutputModeLabel(); } catch { return ''; }
        })());
        return noteElement;
      }

      case "format-select": {
        // 导出格式 / CSES 版本：直接切换实例类型（CSES v1 / v2 都是 YAML）
        const formatSelect = document.createElement("select");
        [['cy1', 'CSES v1（YAML）'], ['cy2', 'CSES v2（YAML）'], ['ci', 'ClassIsland课表档案'], ['es', 'ExamSchedule']]
          .forEach(([value, label]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            formatSelect.appendChild(opt);
          });
        try { formatSelect.value = storage.getOutputMode(); } catch {}
        formatSelect.onchange = () => {
          try {
            storage.setOutputMode(formatSelect.value);
          } catch (e) { console.warn('setOutputMode failed', e); }
          // 版本变化会影响 requiresVersion 的显示，重新渲染
          controlMgr.init();
        };
        return formatSelect;
      }

      case "spanlist": {
        // CSES v2 的 configuration.cycle.spans：<activity, count> 列表
        const box = document.createElement("div");
        box.className = "span-list";
        const render = () => {
          box.innerHTML = '';
          const cycle = controlMgr.cycle();
          if (!cycle.spans.length) {
            const tip = document.createElement('div');
            tip.className = 'control-note';
            tip.textContent = '暂无时间跨度，点击下方「新增跨度」添加';
            box.appendChild(tip);
          }
          cycle.spans.forEach((span, index) => {
            const row = document.createElement('div');
            row.className = 'span-row';

            const sel = document.createElement('select');
            [['work', '工作日'], ['rest', '休息日']].forEach(([value, label]) => {
              const opt = document.createElement('option');
              opt.value = value;
              opt.textContent = label;
              sel.appendChild(opt);
            });
            sel.value = span.activity === 'rest' ? 'rest' : 'work';
            sel.onchange = () => {
              span.activity = sel.value === 'rest' ? 'rest' : 'work';
              controlMgr.applyCycle(cycle);
            };

            const num = document.createElement('input');
            num.type = 'number';
            num.min = '1';
            num.step = '1';
            num.style.width = '90px';
            num.value = String(span.count || 1);
            num.onchange = () => {
              span.count = Math.max(1, parseInt(num.value, 10) || 1);
              num.value = String(span.count);
              controlMgr.applyCycle(cycle);
            };

            const del = document.createElement('button');
            del.type = 'button';
            del.textContent = '删除';
            del.onclick = () => {
              cycle.spans.splice(index, 1);
              controlMgr.applyCycle(cycle, render);
            };

            row.appendChild(sel);
            row.appendChild(num);
            row.appendChild(del);
            box.appendChild(row);
          });

          const actions = document.createElement('div');
          actions.className = 'span-actions';

          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'span-primary';
          addBtn.textContent = '新增跨度';
          addBtn.onclick = () => {
            cycle.spans.push({ activity: 'work', count: 1 });
            controlMgr.applyCycle(cycle, render);
          };

          const fillBtn = document.createElement('button');
          fillBtn.type = 'button';
          fillBtn.textContent = '按总数生成一段工作+一段休息';
          fillBtn.onclick = () => {
            cycle.spans = [
              { activity: 'work', count: cycle.work_count || 5 },
              { activity: 'rest', count: cycle.rest_count || 2 },
            ];
            controlMgr.applyCycle(cycle, render);
          };

          actions.appendChild(addBtn);
          actions.appendChild(fillBtn);
          box.appendChild(actions);
        };
        render();
        return box;
      }

      default:
        console.warn(`Unknown control type: ${setting.type}`);
        return document.createTextNode("不支持的控件类型");
    }
  }
}
