/*
 * 格式合并 + 格式检查器测试
 *  - 导出格式合并为 cy1 / cy2（CSES v1 / v2，统一 YAML）、ci、es，并兼容历史值 cy / cj
 *  - 导入时自动识别 CSES 版本
 *  - 右侧下栏格式检查器的渲染 / 跳转 / 收起
 * 运行：node tests/format.test.js
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
    _map: map,
  };
}

function makeSandbox() {
  const localStorage = makeStorage();
  const document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, setAttribute() {} }),
    addEventListener: () => {},
    body: { appendChild() {}, removeChild() {} },
  };
  const sandbox = {
    console: { log() {}, warn() {}, error: (...a) => console.error(...a), info() {} },
    localStorage,
    document,
    jsyaml,
    JSON, Date, Math, String, Number, Array, Object, RegExp, parseInt, parseFloat, isNaN, setTimeout,
    alert: (msg) => { sandbox.__alerts.push(String(msg)); },
    confirm: (msg, cb) => { if (typeof cb === 'function') cb(true); },
    schedule: { init() {}, refresh() {}, toggleOutputCards() {}, updateTimetableLabel() {} },
    saveTimetableState() {},
    __alerts: [],
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
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
    fn();
    passed++;
    console.log('  ok  - ' + name);
  } catch (e) {
    console.error('  FAIL - ' + name);
    console.error('        ' + (e && e.message));
    process.exitCode = 1;
  }
}

const v1doc = {
  version: 1,
  subjects: [{ name: '数学', simplified_name: '数', room: '101' }],
  schedules: [{ name: 'Odd_Monday', enable_day: 1, weeks: 'odd', classes: [{ subject: '数学', start_time: '08:00:00', end_time: '08:40:00' }] }],
};
const v2doc = {
  version: 2,
  configuration: {
    name: '2026年下学期',
    description: '2026年下学期的课程表',
    cycle: { work_count: 5, rest_count: 2, spans: [{ activity: 'work', count: 5 }, { activity: 'rest', count: 2 }] },
  },
  subjects: [{ name: '数学', simplified_name: '数', location: 'A101' }],
  schedules: [{ name: '周一课表', enable_day: [1, 7], classes: [{ subject: '数学', start_time: '08:00:00', end_time: '08:40:00' }] }],
};

/* ================= 导出格式合并 ================= */
console.log('导出格式（CSES v1 / v2 统一 YAML）');
{
  const sb = makeSandbox();
  const run = runner(load(sb));
  run('storage.init();');

  check('默认格式为 cy1', () => assert.strictEqual(run('storage.getOutputMode()'), 'cy1'));
  check("历史值 'cy' 迁移为 cy1 并写回", () => {
    sb.localStorage.setItem('output-mode', 'cy');
    assert.strictEqual(run('storage.getOutputMode()'), 'cy1');
    assert.strictEqual(sb.localStorage.getItem('output-mode'), 'cy1');
  });
  check("历史值 'cj'（已隐藏的 CSES JSON）迁移为 cy1", () => {
    sb.localStorage.setItem('output-mode', 'cj');
    assert.strictEqual(run('storage.getOutputMode()'), 'cy1');
  });
  check('未知值回退为 cy1', () => {
    sb.localStorage.setItem('output-mode', 'nonsense');
    assert.strictEqual(run('storage.getOutputMode()'), 'cy1');
  });
  check('cy1 与 cy2 都是 YAML，且版本正确', () => {
    const y1 = run("file.preview('cy1')");
    const y2 = run("file.preview('cy2')");
    assert.strictEqual(jsyaml.load(y1).version, 1);
    assert.strictEqual(jsyaml.load(y2).version, 2);
    assert.ok(!y1.trim().startsWith('{'), 'cy1 应是 YAML 文本');
  });
  check('ci / es 仍然输出 JSON', () => {
    assert.ok(run("file.preview('ci')").trim().startsWith('{'));
    assert.ok(run("file.preview('es')").trim().startsWith('{'));
  });
  check('切到 cy2 自动补 configuration 并把文档版本置为 2', () => {
    run("storage.setOutputMode('cy2', {silent:true, noRefresh:true});");
    assert.strictEqual(run('storage.getOutputMode()'), 'cy2');
    assert.strictEqual(run('storage.getCsesVersion()'), 2);
    assert.strictEqual(run('currentData.version'), 2);
    const doc = JSON.parse(run('JSON.stringify(storage.buildDoc())'));
    assert.strictEqual(doc.version, 2);
    assert.ok(doc.configuration && doc.configuration.cycle);
  });
  check('切到 ci 时不影响文档版本，getCsesVersion 回落到文档版本', () => {
    run("storage.setOutputMode('ci', {silent:true, noRefresh:true});");
    assert.strictEqual(run('storage.getOutputMode()'), 'ci');
    assert.strictEqual(run('storage.getCsesVersion()'), 2); // 文档本身还是 v2
  });
}

/* ================= 导入自动识别 ================= */
console.log('导入时自动识别 CSES 版本');
{
  const sb = makeSandbox();
  const run = runner(load(sb));
  run('storage.init();');

  check('JSON 的 CSES v2 -> cy2', () => {
    run(`file.importS(${JSON.stringify(JSON.stringify(v2doc))}, false);`);
    assert.strictEqual(run('storage.getOutputMode()'), 'cy2');
    assert.strictEqual(run('currentData.version'), 2);
    assert.strictEqual(run('currentData.subjects[0].room'), 'A101');
  });
  check('YAML 的 CSES v1 -> cy1', () => {
    const yaml = jsyaml.dump(cses.fromInternal(cses.toInternal(v1doc), 1));
    run(`file.importS(${JSON.stringify(yaml)}, false);`);
    assert.strictEqual(run('storage.getOutputMode()'), 'cy1');
    assert.strictEqual(run('currentData.version'), 1);
    assert.strictEqual(run('currentData.schedules[0].weeks'), 'odd');
  });
  check('编辑器导出的 v2 YAML 再导入仍然识别为 v2（往返）', () => {
    const yaml = jsyaml.dump(cses.fromInternal(cses.toInternal(v2doc), 2));
    run(`file.importS(${JSON.stringify(yaml)}, false);`);
    assert.strictEqual(run('storage.getOutputMode()'), 'cy2');
    assert.deepStrictEqual(JSON.parse(run('JSON.stringify(currentData.schedules[0].enable_day)')), [1, 7]);
    assert.strictEqual(run('currentData.subjects[0].room'), 'A101');
  });
  check('ClassIsland 档案仍然识别为 ci', () => {
    const ciDoc = {
      Subjects: { s1: { Name: '数学', Initial: '数', TeacherName: '' } },
      TimeLayouts: { t1: { Name: '周一', Layouts: [{ StartTime: '08:00:00', EndTime: '08:45:00', TimeType: 0, DefaultClassId: 's1' }] } },
      ClassPlans: { c1: { TimeLayoutId: 't1', TimeRule: { WeekDay: 1, WeekCountDiv: 0 }, Classes: [{ SubjectId: 's1' }], Name: '周一' } },
    };
    run(`file.importS(${JSON.stringify(JSON.stringify(ciDoc))}, false);`);
    assert.strictEqual(run('storage.getOutputMode()'), 'ci');
  });
}

/* ================= 结构化校验结果 ================= */
console.log('结构化校验结果');
{
  const sb = makeSandbox();
  const run = runner(load(sb));
  run('storage.init();');
  check('validateStored 以本地存储为准并给出 issues', () => {
    sb.localStorage.setItem('csesData', JSON.stringify({
      version: 1,
      subjects: [{ name: '' }, { name: '语文' }],
      schedules: [{
        name: 'a',
        enable_day: 1,
        weeks: 'all',
        classes: [
          { subject: '语文', start_time: '09:00:00', end_time: '08:00:00' }, // 结束早于开始 -> 警告
          { subject: '数学', start_time: 'abc', end_time: '08:40:00' },      // 非法时间文本 -> 错误
        ],
      }],
    }));
    sb.localStorage.setItem('output-mode', 'cy1');
    const result = JSON.parse(run('JSON.stringify(storage.validateStored())'));
    assert.strictEqual(result.ok, false);
    assert.ok(result.issues.some((i) => i.field === 'start_time' && i.scheduleIndex === 0 && i.classIndex === 1), '应有课时的结构化问题');
    assert.ok(result.issues.some((i) => i.subjectIndex === 0), '应有科目的结构化问题');
    assert.ok(result.issues.some((i) => i.level === 'warning' && i.scheduleIndex === 0), '应有可跳转的警告');
  });
  check('缺失秒位的旧数据在加载时被补齐，因此不再报时间格式错误', () => {
    sb.localStorage.setItem('csesData', JSON.stringify({
      version: 1,
      subjects: [{ name: '数学' }],
      schedules: [{ name: 'a', enable_day: 1, weeks: 'all', classes: [{ subject: '数学', start_time: '08:00', end_time: '08:40' }] }],
    }));
    const result = JSON.parse(run('JSON.stringify(storage.validateStored())'));
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.issues, []);
  });
  check('validateStored 对干净数据返回空 issues', () => {
    sb.localStorage.setItem('csesData', JSON.stringify(cses.fromInternal(cses.toInternal(v1doc), 1)));
    const result = JSON.parse(run('JSON.stringify(storage.validateStored())'));
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.issues, []);
  });
}

/* ================= 格式检查器 UI ================= */
console.log('格式检查器（右侧下栏）');
let JSDOM;
try {
  ({ JSDOM } = require(path.join(ROOT, 'node_modules', 'jsdom')));
} catch (e) {
  console.error('未安装 jsdom，跳过 UI 测试');
  console.log('\n通过 ' + passed + ' 项检查' + (process.exitCode ? '（存在失败）' : ''));
  process.exit(process.exitCode || 0);
}
{
  const problems = fs.readFileSync(path.join(ROOT, 'dev', 'pages', 'problems.html'), 'utf8');
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body><div class="editor-area"><div id="editor-frame"></div>${problems}</div></body></html>`, {
    runScripts: 'outside-only',
    url: 'http://localhost/panel.php',
  });
  const w = dom.window;
  w.jsyaml = jsyaml;
  w.alert = () => {};
  w.__jump = [];
  w.schedule = { load: (i) => w.__jump.push('schedule:' + i) };
  w.subjects = { load: (i) => w.__jump.push('subject:' + i) };
  w.activityBar = { toggle: (v) => w.__jump.push('view:' + v) };
  w.setEditorSrc = (v) => w.__jump.push('editor:' + v);
  w.localStorage.setItem('output-mode', 'cy1');
  w.localStorage.setItem('csesData', JSON.stringify({
    version: 1,
    subjects: [{ name: '' }, { name: '语文' }],
    schedules: [{
      name: 'a',
      enable_day: 1,
      weeks: 'all',
      classes: [
        { subject: '语文', start_time: '09:00:00', end_time: '08:00:00' },
        { subject: '数学', start_time: 'abc', end_time: '08:40:00' },
      ],
    }],
  }));

  const ctx = dom.getInternalVMContext();
  for (const f of ['cses.js', 'storage.js', 'checker.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'dev', 'scripts', f), 'utf8'), ctx, { filename: f });
  }
  const run = (code) => vm.runInContext(code, ctx);
  run('formatChecker.refresh(true);');

  check('下栏显示错误数量与版本', () => {
    const summary = w.document.getElementById('format-checker-summary').textContent;
    assert.match(summary, /错误/);
    assert.match(w.document.getElementById('format-checker-title').textContent, /CSES v1/);
    assert.ok(w.document.getElementById('format-checker').classList.contains('error'));
  });
  check('发现错误时自动展开', () => {
    assert.ok(!w.document.getElementById('format-checker').classList.contains('collapsed'));
    assert.strictEqual(run('formatChecker.expanded'), true);
  });
  check('问题条目带有跳转按钮', () => {
    const jumps = w.document.querySelectorAll('.format-checker-jump');
    assert.ok(jumps.length >= 2, '应至少有课表与科目两种跳转');
  });
  check('点击课表跳转按钮会打开对应课表', () => {
    const rows = Array.from(w.document.querySelectorAll('.format-checker-issue'));
    const row = rows.find((r) => /start_time/.test(r.textContent));
    assert.ok(row, '应有课时时间问题行：' + rows.map((r) => r.textContent).join(' | '));
    row.querySelector('.format-checker-jump').click();
    assert.ok(w.__jump.includes('schedule:0'), '应跳转到课表 0：' + w.__jump.join(','));
  });
  check('点击科目跳转按钮会打开对应科目', () => {
    const rows = Array.from(w.document.querySelectorAll('.format-checker-issue'));
    const row = rows.find((r) => /subjects\[0\]/.test(r.textContent));
    assert.ok(row, '应有科目问题行');
    row.querySelector('.format-checker-jump').click();
    assert.ok(w.__jump.includes('subject:0'), '应跳转到科目 0：' + w.__jump.join(','));
  });
  check('收起 / 展开切换正常', () => {
    run('formatChecker.toggle(false);');
    assert.ok(w.document.getElementById('format-checker').classList.contains('collapsed'));
    run('formatChecker.toggle(true);');
    assert.ok(!w.document.getElementById('format-checker').classList.contains('collapsed'));
  });
  check('数据修好后显示“未发现格式问题”', () => {
    w.localStorage.setItem('csesData', JSON.stringify(cses.fromInternal(cses.toInternal(v1doc), 1)));
    run('formatChecker.refresh(true);');
    assert.strictEqual(w.document.getElementById('format-checker-summary').textContent, '未发现格式问题');
    assert.ok(w.document.getElementById('format-checker').classList.contains('ok'));
  });
  check('show(false) 隐藏下栏、show(true) 恢复', () => {
    run('formatChecker.show(false);');
    assert.strictEqual(w.document.getElementById('format-checker').style.display, 'none');
    run('formatChecker.show(true);');
    assert.notStrictEqual(w.document.getElementById('format-checker').style.display, 'none');
  });

  run('clearInterval(formatChecker.autoTimer);');
  w.close();
}

console.log('\n通过 ' + passed + ' 项检查' + (process.exitCode ? '（存在失败）' : ''));
