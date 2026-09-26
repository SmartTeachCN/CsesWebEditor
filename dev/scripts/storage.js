/* ---------- CSES 格式层（dev/scripts/cses.js）包装 ---------- */
var CSESF = (typeof window !== 'undefined' && window.cses) ? window.cses : null;
function csesNormalizeTime(t) {
  if (CSESF) return CSESF.normalizeTime(t);
  return (t === undefined || t === null) ? '' : String(t);
}
function csesToInternal(doc) {
  return CSESF ? CSESF.toInternal(doc) : doc;
}
function csesFromInternal(data, version) {
  return CSESF ? CSESF.fromInternal(data, version) : data;
}
function csesValidateDoc(doc) {
  return CSESF ? CSESF.validate(doc) : { ok: true, errors: [], warnings: [], issues: [] };
}
function csesDetectVersion(doc) {
  return CSESF ? CSESF.detectVersion(doc) : null;
}
function csesLooksLike(doc) {
  return CSESF ? CSESF.looksLikeCses(doc) : true;
}

/*
 * 导出格式（实例类型）：
 *   cy1 / cy2 —— CSES v1 / CSES v2，本地导出统一为 YAML（.yaml）
 *   ci        —— ClassIsland 课表档案（JSON）
 *   es        —— ExamSchedule（JSON）
 * 旧的 'cy'（标准 YAML）与 'cj'（隐藏的 CSES JSON）都按文档版本归并到 cy1 / cy2。
 */
const CSES_OUTPUT_MODES = ['cy1', 'cy2'];
const OUTPUT_MODES = ['cy1', 'cy2', 'ci', 'es'];
const OUTPUT_MODE_LABELS = {
  cy1: 'CSES v1（YAML）',
  cy2: 'CSES v2（YAML）',
  ci: 'ClassIsland课表档案',
  es: 'ExamSchedule',
};

function csesModeVersion(mode) {
  return mode === 'cy2' ? 2 : 1;
}
function isCsesOutputMode(mode) {
  return CSES_OUTPUT_MODES.indexOf(mode) !== -1;
}
/** 把任意（含历史遗留的）格式值归一化为 cy1 / cy2 / ci / es。 */
function normalizeOutputMode(raw, fallbackVersion) {
  if (OUTPUT_MODES.indexOf(raw) !== -1) return raw;
  // 'cy' = 标准 YAML，'cj' = 已隐藏的 CSES JSON：都按文档版本落到 v1/v2
  if (raw === 'cy' || raw === 'cj' || raw === undefined || raw === null || raw === '') {
    return (parseInt(fallbackVersion, 10) === 2) ? 'cy2' : 'cy1';
  }
  return 'cy1';
}

/*
 * 给 fluent 自定义元素赋值。
 *
 * 这些组件来自 CDN，升级（upgrade）时机晚于内联脚本；在升级前直接 `el.value = x`
 * 会在实例上创建一个「自有属性」，之后组件升级也无法读到该值（下拉框不回填、
 * 预览框空白）。这里先删掉可能存在的自有属性，再在组件定义就绪后重试一次。
 */
function setFluentValue(el, value, propName) {
  if (!el) return;
  const prop = propName || 'value';
  const assign = () => {
    try {
      if (Object.prototype.hasOwnProperty.call(el, prop)) delete el[prop];
      el[prop] = value;
    } catch (e) {
      try { el.setAttribute(prop === 'checked' ? 'checked' : 'value', String(value)); } catch {}
    }
  };
  assign();
  try {
    const name = el.tagName ? el.tagName.toLowerCase() : '';
    if (name && window.customElements && typeof window.customElements.whenDefined === 'function') {
      window.customElements.whenDefined(name).then(assign).catch(() => {});
    }
  } catch {}
  try { setTimeout(assign, 200); setTimeout(assign, 900); } catch {}
}

let currentData = {
  version: 1,
  configuration: null,
  subjects: [],
  schedules: [],
  timetables: [], // 时间表模板（导出/导入）
};
var tempData;

const storage = {
  _initialized: false,
  _initializing: false,
  // 页面（尤其是 iframe 编辑器页）可能在依赖脚本就绪前就调用了 storage，
  // 这里按需补一次 init()，避免用空文档覆盖本地数据、或导出空文档。
  ensureInit() {
    if (this._initialized || this._initializing) return;
    this._initializing = true;
    try { this.init(); } finally { this._initializing = false; }
  },
  init() {
    try {
      console.log('storage.init');
      let saved = localStorage.getItem("csesData");
      console.log('storage.init saved exists', !!saved);
      if (saved) {
        try {
          // 归一化：时间统一 HH:MM:SS、enable_day 统一为数组、v2 location -> room
          currentData = csesToInternal(JSON.parse(saved));
          console.log('storage.init parsed', { version: currentData.version, subjects: Array.isArray(currentData.subjects) ? currentData.subjects.length : 0, schedules: Array.isArray(currentData.schedules) ? currentData.schedules.length : 0, timetables: Array.isArray(currentData.timetables) ? currentData.timetables.length : 0 });
        } catch {
          currentData = csesToInternal({ version: 1, subjects: [], schedules: [], timetables: [] });
          localStorage.setItem("csesData", JSON.stringify(currentData));
          console.warn('storage.init parse failed, reset default');
        }
      } else {
        currentData = csesToInternal({ version: 1, subjects: [], schedules: [], timetables: [] });
        saved = null;
      }
      // 兼容旧数据结构
      if (!Array.isArray(currentData.timetables)) currentData.timetables = [];
      if (!Array.isArray(currentData.subjects)) currentData.subjects = [];
      if (!Array.isArray(currentData.schedules)) currentData.schedules = [];
      // 仅当归一化确实改变了内容时才写回，避免多框架下用旧内存副本覆盖新数据
      try {
        const normalized = JSON.stringify(currentData);
        if (saved !== normalized) {
          localStorage.setItem("csesData", normalized);
          console.log('storage.init migrated local data to HH:MM:SS / CSES ' + this.getCsesVersion());
        }
      } catch (e) { console.warn('storage.init write back failed', e); }
      this._initialized = true;
      this.mirrorVersion();
      console.log('storage.init ready', { version: this.getCsesVersion(), subjects: currentData.subjects.length, schedules: currentData.schedules.length, timetables: currentData.timetables.length });
    } catch (error) {
      console.error('storage.init failed', error);
    }
    return this._initialized;
  },
  save() {
    if (!this._initialized) {
      console.warn('storage.save 已跳过：尚未初始化（避免覆盖本地数据）');
      return;
    }
    localStorage.setItem("csesData", JSON.stringify(currentData));
    try { window.__unsaved = false; } catch {}
  },
  /* ---------- 导出格式 / CSES 版本（1 / 2） ---------- */
  // 文档自身记录的版本（不受导出格式影响，用于 ci / es 模式）
  docVersion() {
    try {
      const v = parseInt(currentData && currentData.version, 10);
      if (v === 2) return 2;
      if (v === 1) return 1;
    } catch {}
    try { return parseInt(localStorage.getItem('cses-version'), 10) === 2 ? 2 : 1; } catch {}
    return 1;
  },
  // 当前导出格式：cy1 / cy2 / ci / es（兼容历史值 cy、cj）
  getOutputMode() {
    let raw = null;
    try { raw = localStorage.getItem('output-mode'); } catch {}
    const mode = normalizeOutputMode(raw, this.docVersion());
    if (raw !== mode) { try { localStorage.setItem('output-mode', mode); } catch {} }
    return mode;
  },
  getOutputModeLabel(mode) {
    return OUTPUT_MODE_LABELS[mode || this.getOutputMode()] || '';
  },
  isCsesMode(mode) {
    return isCsesOutputMode(mode || this.getOutputMode());
  },
  // 当前（将被导出的）CSES 版本：CSES 模式下由格式决定，其它模式看文档版本
  getCsesVersion() {
    let raw = null;
    try { raw = localStorage.getItem('output-mode'); } catch {}
    if (raw === 'cy2') return 2;
    if (raw === 'cy1') return 1;
    return this.docVersion();
  },
  mirrorVersion() {
    try { localStorage.setItem('cses-version', String(this.getCsesVersion())); } catch {}
  },
  /* ---------- 每个云端实例记住自己的格式（切换实例后不丢） ---------- */
  currentTerminalId() {
    try { return localStorage.getItem('currentTerminalId') || ''; } catch { return ''; }
  },
  readInstanceModes() {
    try { return JSON.parse(localStorage.getItem('cses-instance-modes')) || {}; } catch { return {}; }
  },
  writeInstanceModes(map) {
    try { localStorage.setItem('cses-instance-modes', JSON.stringify(map || {})); } catch {}
  },
  getInstanceMode(terminalId) {
    if (!terminalId) return null;
    const saved = this.readInstanceModes()[terminalId];
    return (saved && OUTPUT_MODES.indexOf(saved) !== -1) ? saved : null;
  },
  setInstanceMode(terminalId, mode) {
    const id = terminalId || this.currentTerminalId();
    if (!id) return;
    const map = this.readInstanceModes();
    map[id] = normalizeOutputMode(mode, this.docVersion());
    this.writeInstanceModes(map);
  },
  /**
   * 切换到某个实例时套用它的格式：
   *  - 之前为该实例选过 -> 用保存的值（不会被文件内容改掉）
   *  - 没选过 -> 用文件自身的格式（fallbackMode），并记下来
   */
  applyInstanceOutputMode(terminalId, fallbackMode) {
    this.ensureInit();
    const id = terminalId || this.currentTerminalId();
    const saved = this.getInstanceMode(id);
    if (saved) {
      return this.setOutputMode(saved, { silent: true, noRefresh: true });
    }
    const fallback = normalizeOutputMode(fallbackMode || this.getOutputMode(), this.docVersion());
    this.setOutputMode(fallback, { silent: true, noRefresh: true, noInstanceRecord: true });
    this.setInstanceMode(id, fallback);
    return fallback;
  },
  // 切换导出格式（cy1 / cy2 / ci / es），CSES 模式下同步文档版本
  setOutputMode(mode, opts) {
    this.ensureInit();
    const m = normalizeOutputMode(mode, this.docVersion());
    try { localStorage.setItem('output-mode', m); } catch {}
    if (isCsesOutputMode(m)) {
      currentData.version = csesModeVersion(m);
      if (currentData.version === 2 && !currentData.configuration) {
        currentData.configuration = CSESF ? CSESF.defaultConfiguration() : {};
      }
      this.save();
    }
    this.mirrorVersion();
    if (!(opts && opts.noInstanceRecord)) this.setInstanceMode(null, m);
    if (!(opts && opts.silent)) {
      this.syncVersionSelectors();
      if (!(opts && opts.noRefresh)) {
        try { this.outputSet(); } catch (e) { console.warn('refresh preview failed', e); }
      }
    }
    return m;
  },
  setCsesVersion(version, opts) {
    this.ensureInit();
    const v = (parseInt(version, 10) === 2) ? 2 : 1;
    currentData.version = v;
    if (v === 2 && !currentData.configuration) {
      currentData.configuration = CSESF ? CSESF.defaultConfiguration() : {};
    }
    // 当前格式就是 CSES（或还没选过）时，同步把导出格式切到 v1/v2；ci / es 保持不变
    let raw = null;
    try { raw = localStorage.getItem('output-mode'); } catch {}
    if (raw === null || raw === '' || raw === 'cy' || raw === 'cj' || isCsesOutputMode(raw)) {
      try { localStorage.setItem('output-mode', v === 2 ? 'cy2' : 'cy1'); } catch {}
    }
    this.mirrorVersion();
    this.save();
    if (!(opts && opts.silent)) {
      this.syncVersionSelectors();
      if (!(opts && opts.noRefresh)) {
        try { this.outputSet(); } catch (e) { console.warn('refresh preview failed', e); }
      }
    }
    return v;
  },
  /**
   * 回填下拉框（导出格式、CSES 版本）与预览框。
   * fluent 组件来自 CDN，升级时机不确定，统一走 setFluentValue 反复对齐。
   */
  syncVersionSelectors() {
    const version = String(this.getCsesVersion());
    document.querySelectorAll('#cses-version, .cses-version-select').forEach((el) => setFluentValue(el, version));
    // 导出格式下拉框（含历史值 cy / cj 的迁移）
    document.querySelectorAll('#output-mode, #output-mode2, #doc-output-mode, .output-mode-select').forEach((el) => {
      setFluentValue(el, this.getOutputMode());
    });
  },
  // 预览框统一入口（避免在 fluent-text-area 升级前写入而丢失内容）
  setPreviewText(text) {
    const el = document.getElementById('yaml-editor');
    if (!el) return;
    setFluentValue(el, text);
  },
  /* ---------- 导出数据 ---------- */
  // 内部结构 + 本地时间表选择结果，供各导出器使用
  buildData() {
    this.ensureInit();
    return mergeTimetableNames(currentData);
  },
  // 按指定（或当前）CSES 版本生成待写出的文档
  buildDoc(version) {
    this.ensureInit();
    const v = (version === 1 || version === 2) ? version : this.getCsesVersion();
    return csesFromInternal(this.buildData(), v);
  },
  // 校验当前将要导出的文档，返回 {ok, version, errors, warnings, issues}
  validate() {
    return csesValidateDoc(this.buildDoc());
  },
  // 以本地存储为准做校验：宿主页面（右侧检查器）用它避免读到过期的内存副本
  validateStored() {
    let internal;
    try {
      const raw = localStorage.getItem('csesData');
      internal = raw ? csesToInternal(JSON.parse(raw)) : csesToInternal({ version: this.docVersion(), subjects: [], schedules: [] });
    } catch (e) {
      return {
        ok: false,
        version: this.getCsesVersion(),
        errors: ['无法读取本地数据：' + (e && e.message ? e.message : e)],
        warnings: [],
        issues: [{ level: 'error', message: '无法读取本地数据：' + (e && e.message ? e.message : e), path: '' }],
      };
    }
    const doc = csesFromInternal(internal, this.getCsesVersion());
    const result = csesValidateDoc(doc);
    if (result && result.scheduleCount === undefined) {
      try { result.scheduleCount = Array.isArray(internal.schedules) ? internal.schedules.length : 0; } catch {}
    }
    return result;
  },
  clear() {
    // 这个函数好像没用到，但还是留着吧
    confirm("确定要清空所有数据吗？", (result) => {
      if (result) {
        localStorage.clear();
        currentData = csesToInternal({ version: 1, subjects: [], schedules: [], timetables: [] });
        location.reload();
      }
    });
  },
  initEnv() {
    this.ensureInit();
    const mode = this.getOutputMode(); // 归一化历史值（cy / cj）并写回
    this.renderPreview(mode);
    this.syncVersionSelectors();
    try { console.log('initEnv set mode', mode, { version: this.getCsesVersion() }); } catch {}
  },
  // 把当前文档按指定格式渲染到「导出预览」
  renderPreview(mode) {
    this.ensureInit();
    const m = normalizeOutputMode(mode || this.getOutputMode(), this.docVersion());
    let text = '';
    if (isCsesOutputMode(m)) {
      text = jsyaml.dump(this.buildDoc(csesModeVersion(m)));
    } else if (m === 'ci') {
      text = JSON.stringify(CsestoCiFromat(this.buildData()), null, 2);
    } else if (m === 'es') {
      text = JSON.stringify(es_procees(this.buildData()), null, 2);
    }
    this.setPreviewText(text);
    return text;
  },
  outputSet() {
    this.ensureInit();
    const selOnline = document.getElementById("output-mode");
    const selOffline = document.getElementById("output-mode2");
    const modeRaw = selOnline?.value ?? selOffline?.value ?? localStorage.getItem("output-mode") ?? "cy1";
    const mode = normalizeOutputMode(modeRaw, this.docVersion());
    localStorage.setItem("output-mode", mode);
    this.setInstanceMode(null, mode);
    if (isCsesOutputMode(mode)) {
      // 导出格式决定文档版本：切到 v2 时补上 configuration
      currentData.version = csesModeVersion(mode);
      if (currentData.version === 2 && !currentData.configuration) {
        currentData.configuration = CSESF ? CSESF.defaultConfiguration() : {};
      }
      this.save();
      this.mirrorVersion();
    }
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
    this.renderPreview(mode);
    this.syncVersionSelectors();
    // 导出格式切换后，格式检查器可能需要在 CSES / 非 CSES 之间显示或隐藏
    try { window.refreshFormatChecker && window.refreshFormatChecker(); } catch (e) {}
    try {
      if (typeof schedule !== 'undefined' && schedule.toggleOutputCards) schedule.toggleOutputCards();
    } catch (e) { console.warn("schedule.toggleOutputCards failed", e); }
  },
  preview() {
    const mode = this.getOutputMode();
    const terminalId = localStorage.getItem("currentTerminalId");
    const directoryId = localStorage.getItem("directoryId") || '';
    if (mode === "cy1" || mode === "cy2") {
      const version = csesModeVersion(mode);
      showModal(`<h2>CSES v${version} 配置（YAML）</h2>
        <li>通用 CSES 文件以 <b>YAML</b> 格式导出 / 导入，可在「文件预览 → 导出预览」查看内容</li>
        <li>点击顶部「导出文件」即可下载 <code>cses-v${version}.yaml</code></li>
        <li>保存到云后由服务端按需转换为 ClassIsland（<code>classisland/manifest.php</code>）与 ExamSchedule（<code>es/link.php</code>）结构</li>
        <li>当前实例：<b>${terminalId || '未选择'}</b>（实例组 ${directoryId || '-'}）</li>
        <fluent-button id="download-cses-btn"><i class="bi bi-download" style="font-size: 12px;margin: 0;margin-right: 5px;"></i>下载 YAML 文件</fluent-button>
        `);
      setTimeout(() => {
        const btn = document.getElementById("download-cses-btn");
        if (btn) btn.onclick = () => { try { file.exportL(); } catch (e) { alert('导出失败：' + (e && e.message ? e.message : e)); } };
      }, 0);
      return;
    }
    if (mode == "es") {
      const url = `https://cloud.smart-teach.cn/es/link.php?id=${directoryId}/${terminalId}`;
      showModal(`<h2>在云端ExamSchedule使用您的配置</h2>
        <li>复制链接，通过集控/手动在设备上打开链接即可</li><li>编辑配置后，无需重新复制链接，原链接为最新档案</li>
        ${url}<br>
        <fluent-button onclick="navigator.clipboard.writeText('${url}')">复制</fluent-button>&nbsp;<fluent-button onclick="window.open('${url}')"><i class="bi bi-play-circle" style="font-size: 12px;margin: 0;margin-right: 5px;"></i>打开链接</fluent-button>
        `)
    } else if (mode == "ci") {
      const ciDirectoryId = directoryId || (document.querySelectorAll(".directoryId")[0]?.textContent || '').trim();
      const manifestUrl = `${location.origin}/classisland/manifest.php?id=${encodeURIComponent(ciDirectoryId)}`;
      showModal(`<h2>在ClassIsland使用静态配置</h2>
        <li>请先「保存到云」，否则云端还没有实例数据</li><li>下载清单文件，保存到您可以访问的位置</li><li>打开ClassIsland设置页面，右上角菜单点击“加入管理”</li><li>点击“配置文件”左侧的文件夹图标</li><li>选择您刚刚下载的清单文件，点击“打开”</li><li>在“ID”处输入您在CSES Cloud创建的实例名称（必填，无需带上实例组标识）</li><li>之后在 CSES Cloud 修改配置后，可在 ClassIsland「集控」设置页点击「立即同步」</li>
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
              ManifestUrlTemplate: manifestUrl,
            };

            const jsonString = JSON.stringify(data, null, 2);

            const blob = new Blob([jsonString], { type: "application/json" });

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            document.body.appendChild(a);
            a.href = url;
            a.download = `ClassIsland-Management-${ciDirectoryId || "config"}.json`;
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
    const mode = normalizeOutputMode(
      outputMode || localStorage.getItem("output-mode"),
      storage.docVersion()
    );
    // 克隆 currentData，合并本地时间表选择到导出数据
    const data = storage.buildData();
    if (isCsesOutputMode(mode) || mode === undefined) {
      // CSES v1 / v2 统一以 YAML 导出
      return jsyaml.dump(csesFromInternal(data, csesModeVersion(mode)));
    } else if (mode == "ci") {
      return JSON.stringify(CsestoCiFromat(data), null, 2);
    } else if (mode == "es") {
      return JSON.stringify(es_procees(data), null, 2);
    }
  },
  export(noNotice) {
    // 云端实例统一保存 CSES 文档 JSON（服务端 convert.php 依赖 JSON 读取）
    const cloudFormat = "JSON";
    const dataToExport = buildCloudPayload();
    if (noNotice) return;
    saveToCloud(dataToExport, cloudFormat, noNotice);
    try { window.__unsynced = false; } catch {}
  },
  exportL() {
    const mode = storage.getOutputMode();
    const Str = file.preview(mode);
    let mime = "application/yaml";
    let filename = "cses-v" + csesModeVersion(mode) + ".yaml";
    if (mode === "ci") {
      mime = "application/json";
      filename = "classisland.json";
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
  /**
   * 导入配置。
   * @param str 文本 / FileReader 事件
   * @param showNotice 是否弹出确认框（用户手动导入文件时为 true）
   * @param opts.keepOutputMode 打开云端实例时为 true：保留本机为该实例选定的格式，
   *        不要把文件格式强加给实例类型（这正是「自动选择覆盖手动选择」的根源）
   */
  importS(str, showNotice = false, opts = {}) {
    if (!str) return;
    const keepOutputMode = !!(opts && opts.keepOutputMode);
    console.log("导入数据:", { keepOutputMode });
    try {
      storage.ensureInit();
      let data = [];
      let source;
      if (str.target && str.target.result) {
        source = str.target.result;
      } else {
        source = str;
      }
      let format = "YAML";
      let format2 = "";
      let declaredVersion = null;
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
          // 识别是否为 CSES 文件并自动选择版本（v1 / v2）
          declaredVersion = csesDetectVersion(parsed) || 1;
          format = csesLooksLike(parsed)
            ? `CSES v${declaredVersion} (JSON)`
            : "未识别为 CSES 的 JSON（按 CSES v1 解析）";
          format2 = declaredVersion === 2 ? "cy2" : "cy1";
        }
      } else if (tool.isYaml(source)) {
        const parsed = jsyaml.load(source);
        data = parsed;
        declaredVersion = csesDetectVersion(parsed) || 1;
        format = csesLooksLike(parsed)
          ? `CSES v${declaredVersion} (YAML)`
          : "未识别为 CSES 的 YAML（按 CSES v1 解析）";
        format2 = declaredVersion === 2 ? "cy2" : "cy1";
      } else {
        throw new Error("未知的文件类型");
      }

      if (data?.success == false) {
        throw new Error("当前实例可能已被移除，请重新点击左侧按钮打开");
      }
      console.log(data);

      console.log("导入格式:" + format);

      // 归一化：时间统一 HH:MM:SS、enable_day 统一为数组、v2 location -> room、补全 configuration
      tempData = csesToInternal(data);
      let unknownSubjects = [];
      let knownSubjects = [];
      // 未知科目检查 + 格式检查
      if (Array.isArray(tempData.subjects) && tempData.subjects.length !== 0) {
        tempData.subjects.forEach((s, index) => {
          if (!s || !s.name) throw new Error(`科目${index}中缺少科目名称`);
          knownSubjects.push(s.name);
        });
      } else {
        tempData.subjects = [];
      }
      if (Array.isArray(tempData.schedules) && tempData.schedules.length !== 0) {
        tempData.schedules.forEach((schedule, index) => {
          if (!schedule.name) throw new Error(`课程${index}中缺少课程名称`);
          if (!Array.isArray(schedule.classes)) schedule.classes = [];
          schedule.classes.forEach((classe) => {
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
      let unknownSubjectsStr = "";
      if (unknownSubjects && unknownSubjects.length) {
        unknownSubjects.forEach((s) => {
          unknownSubjectsStr = unknownSubjectsStr ? `${unknownSubjectsStr}、${s}` : s;
        });
      }
      let unknownSubjectsMsg = "";
      if (unknownSubjectsStr)
        unknownSubjectsMsg =
          "除文件内已定义科目,文件课程表中还有这些未知的科目字段:" +
          unknownSubjectsStr +
          " 在导入时将一并导入科目列表";
      // 导入前的格式提示（时间是否合法、v2 必需字段等）
      let formatNotice = "";
      try {
        const doc = csesFromInternal(tempData, tempData.version);
        const vr = csesValidateDoc(doc);
        if (!vr.ok || (vr.warnings && vr.warnings.length)) {
          formatNotice = `<br><b>格式检查：</b><br>` +
            vr.errors.slice(0, 8).map((e) => `错误：${e}`).join('<br>') +
            (vr.errors.length && vr.warnings.length ? '<br>' : '') +
            vr.warnings.slice(0, 8).map((w) => `警告：${w}`).join('<br>');
        }
      } catch (e) { console.warn('format check failed', e); }

      const applyImported = () => {
        currentData = tempData;
        if (parseInt(currentData.version, 10) !== 2) currentData.version = 1;
        if (currentData.version === 2 && !currentData.configuration) {
          currentData.configuration = CSESF ? CSESF.defaultConfiguration() : {};
        }
        storage.save();
        // 文件自身的格式（CSES v1 -> cy1，v2 -> cy2，ci / es 保持）
        const fileFormat = normalizeOutputMode(format2, currentData.version);
        if (keepOutputMode) {
          // 打开云端实例：优先使用本机为该实例保存的格式，没有记录才跟随文件
          storage.applyInstanceOutputMode(storage.currentTerminalId(), fileFormat);
        } else {
          // 用户手动导入文件：自动选择文件对应的格式并记住
          storage.setOutputMode(fileFormat, { silent: true, noRefresh: true });
        }
        storage.syncVersionSelectors();
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
        // 初始化并刷新界面（包含时间表列表与导出预览）
        try { schedule.init && schedule.init(); } catch (e) { console.warn('schedule.init failed after import', e); }
        try { storage.initEnv && storage.initEnv(); } catch (e) { console.warn('refresh preview failed', e); }
        try { window.refreshFormatChecker && window.refreshFormatChecker(); } catch (e) {}
      };

      if (showNotice) {
        confirm(
          `文件解析成功,文件格式:${format},按确认以导入(当前课程信息将丢失)` +
          "<br>" +
          unknownSubjectsMsg +
          formatNotice,
          (result) => {
            if (result) applyImported();
          }
        );
      } else {
        applyImported();
      }
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

// 克隆内部数据，并把本机选择的时间表名称合并进导出数据
function mergeTimetableNames(base) {
  let data;
  try { data = JSON.parse(JSON.stringify(base)); } catch { data = base; }
  try {
    if (data && Array.isArray(data.schedules) && typeof timetableState !== "undefined" && timetableState && timetableState.schedules) {
      data.schedules.forEach((sch, idx) => {
        const st = timetableState.schedules[idx];
        if (st && st.templateName) sch.timetable_name = st.templateName;
      });
    }
  } catch (e) {
    console.warn('merge timetable_name failed', e);
  }
  return data;
}

function buildCloudPayload() {
  try {
    storage.ensureInit();
    const data = mergeTimetableNames(currentData);
    const doc = csesFromInternal(data, storage.getCsesVersion());
    return JSON.stringify(doc);
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
