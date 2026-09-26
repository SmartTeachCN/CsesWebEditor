/*
 * 实例页面（cloud.html）+ 顶部导出按钮 测试
 *  - 实例类型下拉框的选中项：初始 / 切换实例 / 刷新后都必须是该实例的类型
 *  - 导出（左上角按钮 file.exportL）必须用最新数据，且不能立刻 revoke 掉下载地址
 *  - applyInstanceOutputMode 在没有配置文件依据时不得提前把格式记到实例上
 * 运行：node tests/instance.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const jsyaml = require(path.join(ROOT, 'node_modules', 'js-yaml'));
const cses = require(path.join(ROOT, 'dev', 'scripts', 'cses.js'));

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
  };
}

function makeSandbox() {
  const localStorage = makeStorage();
  const created = [];
  const urlCalls = [];
  const revoked = [];
  const document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: (tag) => {
      const el = {
        tagName: String(tag).toUpperCase(),
        style: {}, dataset: {}, children: [], className: '', innerHTML: '', download: '', href: '', rel: '',
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild(c) { this.children.push(c); },
        removeChild() {},
        remove() { this.removed = true; },
        addEventListener() {},
        setAttribute() {},
        removeAttribute() {},
        select() {},
        click() { this.clicked = true; },
      };
      created.push(el);
      return el;
    },
    body: { appendChild() {}, removeChild() {} },
    addEventListener() {},
  };
  const sandbox = {
    console: { log() {}, warn() {}, error: (...a) => console.error(...a), info() {} },
    localStorage,
    document,
    jsyaml,
    JSON, Date, Math, String, Number, Array, Object, RegExp, parseInt, parseFloat, isNaN,
    Blob: class { constructor(parts, opts) { this.parts = parts; this.type = opts && opts.type; } },
    URL: {
      createObjectURL: (blob) => { urlCalls.push(blob); return 'blob:test-' + urlCalls.length; },
      revokeObjectURL: (url) => { revoked.push(url); },
    },
    alert: (m) => { sandbox.__alerts.push(String(m)); },
    confirm: (m, cb) => { if (typeof cb === 'function') cb(true); },
    schedule: { init() {}, refresh() {}, toggleOutputCards() {}, updateTimetableLabel() {} },
    saveTimetableState() {},
    __alerts: [],
  };
  // 测试进程不必等待定时器（导出会延迟 10s 释放 blob URL）
  sandbox.setTimeout = (fn, ms) => {
    const t = setTimeout(fn, ms);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
  };
  sandbox.clearTimeout = clearTimeout;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.__created = created;
  sandbox.__urlCalls = urlCalls;
  sandbox.__revoked = revoked;
  return sandbox;
}

function load(sandbox, files = ['cses.js', 'storage.js', 'classisland.js', 'app-es.js']) {
  const ctx = vm.createContext(sandbox);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'dev', 'scripts', f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const runner = (ctx) => (code) => vm.runInContext(code, ctx);

let passed = 0;
function check(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(() => { passed++; console.log('  ok  - ' + name); }, (e) => {
        console.error('  FAIL - ' + name);
        console.error('        ' + (e && e.message));
        process.exitCode = 1;
      });
    }
    passed++;
    console.log('  ok  - ' + name);
  } catch (e) {
    console.error('  FAIL - ' + name);
    console.error('        ' + (e && e.message));
    process.exitCode = 1;
  }
}

/* ================= 实例格式记录 ================= */
console.log('实例格式记忆');
{
  const sb = makeSandbox();
  const run = runner(load(sb));
  run('storage.init();');
  run("storage.setOutputMode('cy2', {silent:true, noRefresh:true});");
  sb.localStorage.setItem('currentTerminalId', 'inst-new');

  check('没有配置文件依据时不写入、不记录（保持当前格式）', () => {
    const mode = run("storage.applyInstanceOutputMode('inst-new')");
    assert.strictEqual(mode, 'cy2');
    const map = JSON.parse(sb.localStorage.getItem('cses-instance-modes') || '{}');
    assert.strictEqual(map['inst-new'], undefined, '不应提前记录新实例的格式');
  });
  check('有配置文件版本时才落定并记录', () => {
    const mode = run("storage.applyInstanceOutputMode('inst-new', 'cy1')");
    assert.strictEqual(mode, 'cy1');
    const map = JSON.parse(sb.localStorage.getItem('cses-instance-modes'));
    assert.strictEqual(map['inst-new'], 'cy1');
  });
  check('已有记录时以记录为准（不被文件版本覆盖）', () => {
    sb.localStorage.setItem('currentTerminalId', 'inst-old');
    run("storage.setOutputMode('es', {silent:true, noRefresh:true});");
    assert.strictEqual(run("storage.applyInstanceOutputMode('inst-old', 'cy2')"), 'es');
  });
}

/* ================= 导出按钮 ================= */
console.log('左上角导出按钮（file.exportL）');
{
  const sb = makeSandbox();
  const run = runner(load(sb));
  run('storage.init();');
  run(`currentData = cses.toInternal({ version: 1, subjects: [{ name: '旧科目' }], schedules: [] }); storage.save();`);
  // 模拟编辑器 iframe 里的改动：只写 localStorage，不改宿主页面内存
  sb.localStorage.setItem('csesData', JSON.stringify({ version: 1, subjects: [{ name: '新科目' }], schedules: [] }));

  check('导出预览使用最新的本地数据（不会导出宿主页面的过期副本）', () => {
    const yaml = run("file.preview('cy1')");
    assert.strictEqual(jsyaml.load(yaml).subjects[0].name, '新科目');
  });
  check('保存到云的负载同样使用最新数据', () => {
    const payload = JSON.parse(run('buildCloudPayload()'));
    assert.strictEqual(payload.subjects[0].name, '新科目');
  });
  check('导出会生成下载锚点且不立即 revoke', () => {
    sb.__revoked.length = 0;
    run('file.exportL();');
    const anchor = sb.__created.find((el) => el.tagName === 'A' && el.download);
    assert.ok(anchor, '应创建带 download 的锚点');
    assert.strictEqual(anchor.download, 'cses-v1.yaml');
    assert.strictEqual(anchor.clicked, true);
    assert.strictEqual(sb.__revoked.length, 0, '不应在点击后立刻释放 blob URL');
    const blob = sb.__urlCalls[sb.__urlCalls.length - 1];
    assert.ok(String(blob.parts[0]).includes('新科目'), '导出的内容应为最新文档');
    assert.strictEqual(blob.type, 'application/yaml');
  });
  check('ClassIsland 模式导出为 JSON 文件名', () => {
    run("storage.setOutputMode('ci', {silent:true, noRefresh:true});");
    run('file.exportL();');
    const anchor = sb.__created.filter((el) => el.tagName === 'A' && el.download).pop();
    assert.strictEqual(anchor.download, 'classisland.json');
  });
  check('导出出错时有提示而不是静默失败', () => {
    sb.__alerts.length = 0;
    const broken = makeSandbox();
    delete broken.URL;
    const run2 = runner(load(broken));
    run2('storage.init();');
    run2('file.exportL();');
    assert.ok(broken.__alerts.some((m) => m.includes('导出失败')), '应提示导出失败：' + broken.__alerts.join(','));
  });
}

/* ================= 实例页面下拉框 ================= */
let JSDOM;
try {
  ({ JSDOM } = require(path.join(ROOT, 'node_modules', 'jsdom')));
} catch (e) {
  console.error('未安装 jsdom，跳过实例页面 DOM 测试');
  console.log('\n通过 ' + passed + ' 项检查' + (process.exitCode ? '（存在失败）' : ''));
  process.exit(process.exitCode || 0);
}

{
  const html = fs.readFileSync(path.join(ROOT, 'dev', 'pages', 'editor', 'cloud.html'), 'utf8');
  const bodyStart = html.indexOf('<body>');
  const lastScript = html.lastIndexOf('<script>');
  const bodyHtml = html.slice(bodyStart, lastScript);
  const inlineCode = html.slice(lastScript + '<script>'.length, html.indexOf('</script>', lastScript));

  const dom = new JSDOM(`<!DOCTYPE html><html><head></head>${bodyHtml}</body></html>`, {
    runScripts: 'outside-only',
    url: 'http://localhost/dev/pages/editor/cloud.html',
  });
  const w = dom.window;
  w.jsyaml = jsyaml;
  w.alert = () => {};
  w.localStorage.setItem('output-mode', 'cy1');
  w.localStorage.setItem('currentTerminalId', 'inst-a');
  w.localStorage.setItem('cses-instance-modes', JSON.stringify({ 'inst-a': 'ci', 'inst-b': 'es' }));
  w.localStorage.setItem('csesData', JSON.stringify({ version: 1, subjects: [], schedules: [] }));

  const ctx = dom.getInternalVMContext();
  for (const f of ['cses.js', 'storage.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'dev', 'scripts', f), 'utf8'), ctx, { filename: f });
  }
  const run = (code) => vm.runInContext(code, ctx);

  run(inlineCode);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));

  check('实例类型用原生 select 渲染（不受 CDN 组件升级时序影响）', () => {
    const el = w.document.getElementById('output-mode');
    assert.ok(el, '找不到 #output-mode');
    assert.strictEqual(el.tagName, 'SELECT');
    // 4 个真实类型 + 1 个「跟随实例配置」占位项（没有本机记录时不谎报类型）
    assert.strictEqual(el.querySelectorAll('option').length, 5);
  });
  check('初始选中项 = 当前实例记录的类型（不是第一项）', () => {
    assert.strictEqual(w.document.getElementById('output-mode').value, 'ci');
  });
  check('父页面切换实例后下拉框跟随', () => {
    w.localStorage.setItem('currentTerminalId', 'inst-b');
    w.dispatchEvent(new w.StorageEvent('storage', { key: 'currentTerminalId' }));
    assert.strictEqual(w.document.getElementById('output-mode').value, 'es');
    assert.strictEqual(run('storage.getOutputMode()'), 'es');
  });
  check('没有记录的实例显示「跟随实例配置」，不显示别的实例的类型', () => {
    w.localStorage.setItem('currentTerminalId', 'inst-new');
    w.localStorage.setItem('output-mode', 'es'); // 上一个实例留下的全局值
    w.dispatchEvent(new w.StorageEvent('storage', { key: 'currentTerminalId' }));
    assert.strictEqual(w.document.getElementById('output-mode').value, '');
    assert.strictEqual(w.localStorage.getItem('output-mode'), 'es', '全局格式不该被无依据地改写');
    w.localStorage.setItem('currentTerminalId', 'inst-b');
    w.dispatchEvent(new w.StorageEvent('storage', { key: 'currentTerminalId' }));
    assert.strictEqual(w.document.getElementById('output-mode').value, 'es');
  });
  check('刷新（重新初始化）后仍是该实例的类型', () => {
    run('storage.init(); storage.applyInstanceOutputMode(storage.currentTerminalId()); storage.syncInstanceTypeSelectors();');
    assert.strictEqual(w.document.getElementById('output-mode').value, 'es');
  });
  check('手动改选后写入实例记录并回填', () => {
    const el = w.document.getElementById('output-mode');
    // jsdom 的 outside-only 模式不会编译 HTML 内联事件，这里直接调用它对应的处理逻辑
    assert.strictEqual(el.getAttribute('onchange'), 'storage.outputSet(this)');
    el.value = 'cy2';
    run('storage.outputSet(document.getElementById("output-mode"));');
    assert.strictEqual(run('storage.getOutputMode()'), 'cy2');
    const map = JSON.parse(w.localStorage.getItem('cses-instance-modes'));
    assert.strictEqual(map['inst-b'], 'cy2');
    assert.strictEqual(w.document.getElementById('output-mode').value, 'cy2');
  });
  check('空值不会被降级成 cy1（「跟随实例配置」是合法状态）', () => {
    run('storage.outputSet(document.getElementById("output-mode"));'); // 当前是 cy2
    assert.strictEqual(run('storage.getOutputMode()'), 'cy2');
    run('storage.setOutputMode(""); storage.setOutputMode(undefined); storage.setOutputMode("bogus");');
    assert.strictEqual(run('storage.getOutputMode()'), 'cy2');
  });
  check('文档与旧链接兼容：实例类型选项与后端约定一致', () => {
    const values = Array.from(w.document.querySelectorAll('#output-mode option')).map((o) => o.value);
    // 首位空值是「跟随实例配置」占位，其余四个值与后端 / 旧链接约定一致
    assert.deepStrictEqual(values, ['', 'cy1', 'cy2', 'ci', 'es']);
  });

  w.close();
}

console.log('\n通过 ' + passed + ' 项检查' + (process.exitCode ? '（存在失败）' : ''));
