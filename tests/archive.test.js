/*
 * 档案页面（档案管理：课程表 / 时间表 / 科目）编辑功能回归测试。
 *
 * 用 jsdom 加载真实的 dev/pages 结构 + dev/scripts，逐项驱动编辑入口，
 * 断言「内存改动一定落到 localStorage 的 csesData」以及各页面互不污染。
 *
 * 运行：node tests/archive.test.js   （需要 jsdom）
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let JSDOM;
try {
  ({ JSDOM } = require(path.join(ROOT, 'node_modules', 'jsdom')));
} catch (e) {
  console.error('未安装 jsdom，跳过档案页面测试（npm i jsdom --no-save）');
  process.exit(0);
}
const jsyaml = require(path.join(ROOT, 'node_modules', 'js-yaml'));

/* ------------------------------------------------------------------ 工具 */

// 档案页面的三个编辑器都是 iframe（change/schedule/time/subject），
// 主面板还需要 ui.js 提供的 alert / confirm / prompt / showModal。
const MAIN_SCRIPTS = ['cses.js', 'storage.js', 'ui.js', 'schedule.js', 'subject.js'];
const EDITOR_SCRIPTS = ['cses.js', 'storage.js', 'ui.js', 'schedule.js', 'subject.js'];

/**
 * 用真实页面结构建一个 jsdom。
 * @param pageRelPath 相对仓库根目录的页面（片段页也可以，如 pages/explorer.html）
 * @param seed        预置到 localStorage 的键值（必须在加载脚本之前写入）
 */
function buildDom(pageRelPath, seed) {
  const html = fs.readFileSync(path.join(ROOT, pageRelPath), 'utf8');
  let body;
  if (html.includes('<body>')) {
    body = html.slice(html.indexOf('<body>'), html.lastIndexOf('<script>'));
  } else {
    body = html; // 纯片段（没有 <body>）
  }
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${body}</body></html>`, {
    runScripts: 'outside-only',
    url: 'http://localhost/dev/pages/explorer.html',
    pretendToBeVisual: true,
  });
  dom.window.jsyaml = jsyaml;
  if (seed) Object.keys(seed).forEach((k) => dom.window.localStorage.setItem(k, seed[k]));
  return dom;
}

/** 在 jsdom 上下文里执行开发脚本，并返回 run/json 帮助函数 */
function makeRunner(dom, scriptList) {
  const ctx = dom.getInternalVMContext();
  for (const f of (scriptList || MAIN_SCRIPTS)) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'dev', 'scripts', f), 'utf8'), ctx, { filename: f });
  }
  const run = (code) => vm.runInContext(code, ctx);
  const json = (expr) => JSON.parse(run(`JSON.stringify(${expr})`));
  /*
   * ui.js 用 function 声明定义了 alert / confirm / prompt / showModal，
   * 会遮蔽 window 上的同名实现，所以必须在脚本加载之后再替换。
   * confirm 默认点「确定」，prompt 默认返回 preset。
   */
  const dialogs = { alerts: [], confirms: [], prompts: [] };
  run(`
    window.__alerts = []; window.__confirms = []; window.__prompts = [];
    alert = function (m) { window.__alerts.push(String(m)); };
    confirm = function (m, cb, args) { window.__confirms.push(String(m)); if (typeof cb === 'function') cb(true, args); };
    prompt = function (m, cb) { window.__prompts.push(String(m)); if (typeof cb === 'function') cb(window.__promptValue === undefined ? null : window.__promptValue); };
    showModal = function (m) { window.__alerts.push(String(m)); };
  `);
  dialogs.read = () => ({
    alerts: json('window.__alerts'),
    confirms: json('window.__confirms'),
    prompts: json('window.__prompts'),
  });
  return { dom, ctx, run, json, dialogs };
}

/** 读取 localStorage 里的 csesData（导出用的持久化文档） */
function stored(r) {
  return JSON.parse(r.run('localStorage.getItem("csesData") || "{}"'));
}
const storedSubjects = (r) => (stored(r).subjects || []).map((s) => s.name);
const storedTimetables = (r) => (stored(r).timetables || []).map((t) => t.name);
const memSubjects = (r) => r.run('currentData.subjects.map(s => s.name).join(",")');

function makeDoc(over) {
  return Object.assign({
    version: 1,
    subjects: [{ name: '语文', simplified_name: '语', teacher: '张三', room: '101' }, { name: '数学', simplified_name: '数' }],
    schedules: [{ name: 'All_Monday', enable_day: [1], weeks: 'all', classes: [{ subject: '语文', start_time: '08:00:00', end_time: '08:45:00' }] }],
    timetables: [],
  }, over || {});
}
const seedDoc = (doc) => ({ csesData: JSON.stringify(doc) });

/** 打开主面板（档案页外壳） */
function openPanel(doc, extraSeed) {
  const dom = buildDom('dev/pages/explorer.html', Object.assign(seedDoc(doc), extraSeed || {}));
  const r = makeRunner(dom, MAIN_SCRIPTS);
  r.run('storage.init(); schedule.init(); subjects.init();');
  return r;
}

/** 打开某个编辑器 iframe 页面 */
function openEditor(page, doc, extraSeed) {
  const dom = buildDom(`dev/pages/editor/${page}.html`, Object.assign(seedDoc(doc), extraSeed || {}));
  const r = makeRunner(dom, EDITOR_SCRIPTS);
  r.run('storage.init();');
  return r;
}

/* ------------------------------------------------------------ 断言框架 */
let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  - ' + name);
  } catch (e) {
    failures.push(name);
    console.error('  FAIL - ' + name);
    console.error('        ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n        ') : e));
    process.exitCode = 1;
  }
}
function group(title) { console.log(title); }

/* =========================================================== 科目编辑 */
group('科目编辑（档案 → 科目）');

check('科目列表按文档渲染', () => {
  const r = openPanel(makeDoc());
  assert.deepStrictEqual(r.json(`Array.from(document.querySelectorAll('#subject-list .explorer-item')).map(e => e.textContent.replace(/\\s|\\u00a0/g,''))`), ['语文', '数学']);
});

check('新增科目会写入 localStorage（此前只在内存里）', () => {
  const r = openPanel(makeDoc());
  r.run(`window.__promptValue = '化学'; subjects.add();`);
  assert.strictEqual(memSubjects(r), '语文,数学,化学');
  assert.deepStrictEqual(storedSubjects(r), ['语文', '数学', '化学']);
});

check('新增同名科目不会产生重复项', () => {
  const r = openPanel(makeDoc());
  r.run(`window.__promptValue = '语文'; subjects.add();`);
  assert.deepStrictEqual(storedSubjects(r), ['语文', '数学']);
});

check('右键删除科目会写入 localStorage（此前只在内存里）', () => {
  const r = openPanel(makeDoc());
  r.run(`document.querySelectorAll('#subject-list .explorer-item')[1].dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));`);
  assert.strictEqual(memSubjects(r), '语文');
  assert.deepStrictEqual(storedSubjects(r), ['语文']);
  assert.strictEqual(r.run(`document.querySelectorAll('#subject-list .explorer-item').length`), 1);
});

check('科目面板有可见的新增入口', () => {
  const html = fs.readFileSync(path.join(ROOT, 'dev', 'pages', 'explorer.html'), 'utf8');
  assert.ok(/id="add-subject-btn"[^>]*onclick="subjects\.add\(\)"/.test(html), '缺少新增科目按钮');
});

check('编辑器保存改名是原地改写而不是新增科目', () => {
  const r = openEditor('subject', makeDoc());
  r.run('subjects.load(1, false);');
  assert.strictEqual(r.run(`document.getElementById('subject-name').value`), '数学');
  r.run(`document.getElementById('subject-name').value = '数学分析';
         document.getElementById('subject-simple').value = '数分';
         subjects.save();`);
  assert.deepStrictEqual(storedSubjects(r), ['语文', '数学分析']);
  const saved = stored(r).subjects[1];
  assert.strictEqual(saved.name, '数学分析');
  assert.strictEqual(saved.simplified_name, '数分');
});

check('改名会级联更新课程表里对旧名称的引用', () => {
  const doc = makeDoc({
    schedules: [{ name: 'All_Monday', enable_day: [1], weeks: 'all', classes: [{ subject: '数学', start_time: '08:00:00', end_time: '08:45:00' }] }],
  });
  const r = openEditor('subject', doc);
  r.run('subjects.load(1, false);');
  r.run(`document.getElementById('subject-name').value = '数学分析'; subjects.save();`);
  assert.strictEqual(stored(r).schedules[0].classes[0].subject, '数学分析');
});

check('改名为已存在的科目名会被拒绝', () => {
  const r = openEditor('subject', makeDoc());
  r.run('subjects.load(0, false);');
  r.run(`document.getElementById('subject-name').value = '数学'; subjects.save();`);
  assert.deepStrictEqual(storedSubjects(r), ['语文', '数学']);
  assert.ok(r.dialogs.read().alerts.some((m) => /同名科目/.test(m)), '没有给出重名提示');
});

check('只改简称/教师不改名时不会新增科目', () => {
  const r = openEditor('subject', makeDoc());
  r.run('subjects.load(0, false);');
  r.run(`document.getElementById('subject-simple').value = '语';
         document.getElementById('subject-teacher').value = '李四';
         document.getElementById('subject-room').value = '202';
         subjects.save();`);
  assert.strictEqual(stored(r).subjects.length, 2);
  assert.deepStrictEqual(stored(r).subjects[0], { name: '语文', simplified_name: '语', teacher: '李四', room: '202' });
});

check('科目名为空时不写入并提示', () => {
  const r = openEditor('subject', makeDoc());
  r.run('subjects.load(0, false);');
  r.run(`document.getElementById('subject-name').value = ''; subjects.save();`);
  assert.strictEqual(stored(r).subjects.length, 2);
  assert.ok(r.dialogs.read().alerts.length > 0, '没有提示');
});

/* ========================================================= 时间表编辑 */
group('时间表编辑（档案 → 时间表）');

check('时间表面板有新建 / 导入入口', () => {
  const html = fs.readFileSync(path.join(ROOT, 'dev', 'pages', 'explorer.html'), 'utf8');
  assert.ok(/id="add-timetable-btn"[^>]*onclick="schedule\.addTimetableUI\(\)"/.test(html), '缺少新建时间表按钮');
  assert.ok(/id="import-timetable-json-btn"/.test(html), '缺少导入JSON按钮');
});

check('时间表列表按文档渲染，空列表给出提示', () => {
  const r = openPanel(makeDoc({ timetables: [{ name: 'T1', times: [{ starttime: '08:00:00', endtime: '08:45:00' }] }] }));
  assert.deepStrictEqual(
    r.json(`Array.from(document.querySelectorAll('#timetable-list .explorer-item')).map(e => e.textContent.replace(/\\s|\\u00a0/g,''))`),
    ['T1']
  );
  r.run('customTimetables = []; schedule.renderTimetableList();');
  assert.match(r.run(`document.getElementById('timetable-list').textContent`), /暂无时间表/);
});

check('右键删除时间表会同时清理文档与本地缓存', () => {
  const r = openPanel(makeDoc({ timetables: [{ name: 'T1', times: [{ starttime: '08:00:00', endtime: '08:45:00' }] }] }));
  r.run(`document.querySelectorAll('#timetable-list .explorer-item')[0].dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));`);
  assert.deepStrictEqual(storedTimetables(r), []);
  assert.deepStrictEqual(r.json(`JSON.parse(localStorage.getItem('cses_timetable_templates') || '[]')`), []);
  assert.strictEqual(r.run(`document.querySelectorAll('#timetable-list .explorer-item').length`), 0);
});

check('打开已有时间表会回填全部课时（文档有、本地缓存缺失）', () => {
  const doc = makeDoc({ timetables: [{ name: 'T1', times: [{ starttime: '08:00:00', endtime: '08:45:00' }, { starttime: '08:55:00', endtime: '09:40:00' }] }] });
  const r = openEditor('time', doc);
  r.run(`schedule.showTimeEditor('T1', false);`);
  assert.strictEqual(r.run(`document.getElementById('time-template-name').value`), 'T1');
  assert.deepStrictEqual(
    r.json(`Array.from(document.querySelectorAll('#time-rows > div')).map(d => d.querySelector('.time-row-start').value + '-' + d.querySelector('.time-row-end').value)`),
    ['08:00:00-08:45:00', '08:55:00-09:40:00']
  );
});

check('打开已有时间表再保存不会清空模板（数据不丢）', () => {
  const doc = makeDoc({ timetables: [{ name: 'T1', times: [{ starttime: '08:00:00', endtime: '08:45:00' }, { starttime: '08:55:00', endtime: '09:40:00' }] }] });
  const r = openEditor('time', doc);
  r.run(`schedule.showTimeEditor('T1', false); schedule.saveTimeTemplate();`);
  const saved = stored(r).timetables;
  assert.strictEqual(saved.length, 1);
  assert.deepStrictEqual(saved[0].times, [
    { starttime: '08:00:00', endtime: '08:45:00' },
    { starttime: '08:55:00', endtime: '09:40:00' },
  ]);
});

check('时间表编辑器里改时间后保存会写入文档', () => {
  const doc = makeDoc({ timetables: [{ name: 'T1', times: [{ starttime: '08:00:00', endtime: '08:45:00' }] }] });
  const r = openEditor('time', doc);
  r.run(`schedule.showTimeEditor('T1', false);
         document.querySelector('#time-rows .time-row-start').value = '07:30:00';
         schedule.saveTimeTemplate();`);
  assert.deepStrictEqual(stored(r).timetables[0].times, [{ starttime: '07:30:00', endtime: '08:45:00' }]);
});

check('打开不存在的时间表会给出提示', () => {
  const r = openEditor('time', makeDoc());
  r.run(`schedule.showTimeEditor('不存在的表', false);`);
  assert.ok(r.dialogs.read().alerts.some((m) => /未找到时间表/.test(m)), '没有提示模板不存在');
});

check('新建时间表会写入文档', () => {
  const r = openPanel(makeDoc());
  r.run(`schedule.createTimetableFromCurrent('新课表时间');`);
  assert.deepStrictEqual(storedTimetables(r), ['新课表时间']);
});

check('同名时间表会自动改名而不是覆盖', () => {
  const r = openPanel(makeDoc({ timetables: [{ name: '同一张', times: [{ starttime: '08:00:00', endtime: '08:45:00' }] }] }));
  r.run(`schedule.createTimetableFromCurrent('同一张');`);
  assert.deepStrictEqual(storedTimetables(r), ['同一张', '同一张(1)']);
  assert.deepStrictEqual(stored(r).timetables[0].times, [{ starttime: '08:00:00', endtime: '08:45:00' }]);
});

check('从当前课表保存为时间表会带上课时时间', () => {
  const r = openEditor('schedule', makeDoc());
  r.run('schedule.load(0, false);');
  r.run(`schedule.createTimetableFromCurrent('由课表生成');`);
  assert.deepStrictEqual(storedTimetables(r), ['由课表生成']);
  assert.deepStrictEqual(stored(r).timetables[0].times, [{ starttime: '08:00:00', endtime: '08:45:00' }]);
});

check('导入时间表 JSON 会归一化时间并写入文档', () => {
  const r = openPanel(makeDoc());
  r.run(`window.__promptValue = JSON.stringify({ name: '导入表', times: [{ starttime: '09:00', endtime: '09:45' }] });`);
  r.run('schedule.importTimeTemplateJSONUI();');
  assert.deepStrictEqual(storedTimetables(r), ['导入表']);
  assert.deepStrictEqual(stored(r).timetables[0].times, [{ starttime: '09:00:00', endtime: '09:45:00' }]);
  assert.ok(r.dialogs.read().alerts.some((m) => /导入成功/.test(m)));
});

check('导入非法 JSON 不会破坏已有模板', () => {
  const r = openPanel(makeDoc({ timetables: [{ name: 'T1', times: [{ starttime: '08:00:00', endtime: '08:45:00' }] }] }));
  r.run(`window.__promptValue = '{ bad json';`);
  r.run('schedule.importTimeTemplateJSONUI();');
  assert.deepStrictEqual(storedTimetables(r), ['T1']);
  assert.ok(r.dialogs.read().alerts.some((m) => /导入失败/.test(m)));
});

check('导出时间表 JSON 为 HH:MM:SS', () => {
  const r = openEditor('time', makeDoc({ timetables: [{ name: 'T1', times: [{ starttime: '08:00', endtime: '08:45' }] }] }));
  r.run(`window.__copied = null; copyToClip = function (arr) { window.__copied = arr[0]; };`);
  r.run(`schedule.showTimeEditor('T1', false); schedule.exportTimeTemplateJSON();`);
  const out = JSON.parse(r.run('window.__copied'));
  assert.strictEqual(out.name, 'T1');
  assert.deepStrictEqual(out.times, [{ starttime: '08:00:00', endtime: '08:45:00' }]);
});

check('在时间表编辑器里改名是原地改名，不会变成两张表', () => {
  const doc = makeDoc({ timetables: [{ name: 'T1', times: [{ starttime: '08:00:00', endtime: '08:45:00' }] }] });
  const r = openEditor('time', doc);
  r.run(`schedule.showTimeEditor('T1', false);
         document.getElementById('time-template-name').value = 'T2';
         schedule.saveTimeTemplate();`);
  assert.deepStrictEqual(storedTimetables(r), ['T2']);
  assert.deepStrictEqual(stored(r).timetables[0].times, [{ starttime: '08:00:00', endtime: '08:45:00' }]);
});

check('改名为已存在的时间表名会被拒绝', () => {
  const doc = makeDoc({ timetables: [
    { name: 'T1', times: [{ starttime: '08:00:00', endtime: '08:45:00' }] },
    { name: 'T2', times: [{ starttime: '09:00:00', endtime: '09:45:00' }] },
  ] });
  const r = openEditor('time', doc);
  r.run(`schedule.showTimeEditor('T1', false);
         document.getElementById('time-template-name').value = 'T2';
         schedule.saveTimeTemplate();`);
  assert.deepStrictEqual(storedTimetables(r), ['T1', 'T2']);
  assert.ok(r.dialogs.read().alerts.some((m) => /同名时间表/.test(m)), '没有给出重名提示');
});

check('时间表编辑器里的删除按钮会从文档中移除模板', () => {
  const doc = makeDoc({ timetables: [
    { name: 'T1', times: [{ starttime: '08:00:00', endtime: '08:45:00' }] },
    { name: 'T2', times: [{ starttime: '09:00:00', endtime: '09:45:00' }] },
  ] });
  const r = openEditor('time', doc);
  r.run(`schedule.showTimeEditor('T1', false); schedule.deleteTimeTemplateInEditor();`);
  assert.deepStrictEqual(storedTimetables(r), ['T2']);
});

check('导入不含时间表的新文档不会残留上一份文档的模板', () => {
  const doc = makeDoc({ timetables: [{ name: 'T1', times: [{ starttime: '08:00:00', endtime: '08:45:00' }] }] });
  const dom = buildDom('dev/pages/explorer.html', seedDoc(doc));
  const r = makeRunner(dom, ['cses.js', 'storage.js', 'ui.js', 'classisland.js', 'app-es.js', 'schedule.js', 'subject.js']);
  r.run('storage.init(); schedule.init();');
  assert.deepStrictEqual(storedTimetables(r), ['T1']);
  const incoming = JSON.stringify({ version: 1, subjects: [{ name: '数学' }], schedules: [] });
  r.run(`file.importS(${JSON.stringify(incoming)}, false);`);
  assert.deepStrictEqual(r.json('currentData.subjects.map(s => s.name)'), ['数学']);
  assert.deepStrictEqual(storedTimetables(r), []);
  assert.strictEqual(r.run(`localStorage.getItem('cses_timetable_templates')`), null);
});

/* =========================================================== 课表编辑 */
group('课表编辑（档案 → 课程表）');

check('新建课表会写入文档', () => {
  const r = openPanel(makeDoc({ schedules: [] }));
  r.run('schedule.add();');
  assert.strictEqual(stored(r).schedules.length, 1);
  assert.strictEqual(r.run('currentData.schedules.length'), 1);
});

check('右键删除课表会写入文档', () => {
  const doc = makeDoc({ schedules: [
    { name: 'All_Monday', enable_day: [1], weeks: 'all', classes: [] },
    { name: 'All_Tuesday', enable_day: [2], weeks: 'all', classes: [] },
  ] });
  const r = openPanel(doc);
  r.run(`document.querySelectorAll('#schedule-list .explorer-item')[1].dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));`);
  assert.deepStrictEqual(r.json('currentData.schedules.map(s => s.name)'), ['All_Tuesday']);
  assert.deepStrictEqual(stored(r).schedules.map((s) => s.name), ['All_Tuesday']);
});

check('克隆课表会写入文档', () => {
  const r = openEditor('schedule', makeDoc());
  r.run('schedule.load(0, false); schedule.clone();');
  assert.strictEqual(stored(r).schedules.length, 2);
  assert.deepStrictEqual(stored(r).schedules[1].classes, [{ subject: '语文', start_time: '08:00:00', end_time: '08:45:00' }]);
});

check('快速填充生成周一~周日七张通用周课表', () => {
  const r = openEditor('schedule', makeDoc({ schedules: [] }));
  r.run('schedule.fastFill();');
  assert.deepStrictEqual(
    r.json('currentData.schedules.map(s => s.name)'),
    ['All_Monday', 'All_Tuesday', 'All_Wednesday', 'All_Thursday', 'All_Friday', 'All_Saturday', 'All_Sunday']
  );
  assert.strictEqual(stored(r).schedules.length, 7);
});

check('切换启用星期 / 轮周会重写课表名并落盘', () => {
  const r = openEditor('schedule', makeDoc());
  r.run('schedule.load(0, false);');
  r.run(`document.getElementById('week-mode').value = 'even';
         document.getElementById('day-mode').value = '3';
         schedule.save();`);
  const saved = stored(r).schedules[0];
  assert.strictEqual(saved.name, 'Even_Wednesday');
  assert.deepStrictEqual(saved.enable_day, [3]);
  assert.strictEqual(saved.weeks, 'even');
});

check('v2 启用日多选会落盘并自动命名', () => {
  const doc = makeDoc();
  doc.version = 2;
  const dom = buildDom('dev/pages/editor/schedule.html', Object.assign(seedDoc(doc), { 'output-mode': 'cy2' }));
  const r = makeRunner(dom, EDITOR_SCRIPTS);
  r.run('storage.init(); schedule.load(0, false);');
  r.run(`document.querySelectorAll('#day-mode-multi .day-chip')[6].click();`);
  assert.deepStrictEqual(stored(r).schedules[0].enable_day, [1, 7]);
  assert.strictEqual(stored(r).schedules[0].name, '周一、周日课表');
});

check('添加课时接续上一节时间并落盘', () => {
  const r = openEditor('schedule', makeDoc());
  r.run('schedule.load(0, false);');
  r.run(`document.querySelectorAll('.time-input')[0].value = '';
         document.querySelectorAll('.time-input')[1].value = '';
         schedule.addClass();`);
  const classes = stored(r).schedules[0].classes;
  assert.strictEqual(classes.length, 2);
  assert.strictEqual(classes[1].start_time, '08:45:00');
  assert.strictEqual(classes[1].end_time, '09:30:00');
});

check('删除当前课时会落盘', () => {
  const r = openEditor('schedule', makeDoc());
  r.run('schedule.load(0, false);');
  r.run(`document.querySelectorAll('#class-list > *')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
         schedule.delClass();`);
  assert.deepStrictEqual(stored(r).schedules[0].classes, []);
});

check('选中课时后改时间会落盘（HH:MM 补成 HH:MM:SS）', () => {
  const r = openEditor('schedule', makeDoc());
  r.run('schedule.load(0, false);');
  r.run(`document.querySelectorAll('#class-list > *')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
         document.querySelectorAll('.time-input')[0].value = '09:05';
         document.querySelectorAll('.time-input')[1].value = '09:45';
         schedule.setTime();`);
  assert.strictEqual(stored(r).schedules[0].classes[0].start_time, '09:05:00');
  assert.strictEqual(stored(r).schedules[0].classes[0].end_time, '09:45:00');
});

check('快速添加课程：空课表连续点击会逐节添加', () => {
  const doc = makeDoc({ schedules: [{ name: 'All_Monday', enable_day: [1], weeks: 'all', classes: [] }] });
  const r = openEditor('schedule', doc);
  r.run('schedule.load(0, false);');
  ['语文', '数学', '语文'].forEach((name) => {
    r.run(`Array.from(document.querySelectorAll('.subject-grid fluent-button')).find(b => b.textContent === ${JSON.stringify(name)}).click();`);
  });
  const classes = stored(r).schedules[0].classes;
  assert.deepStrictEqual(classes.map((c) => c.subject), ['语文', '数学', '语文']);
  // 时间必须连续且格式合法
  assert.deepStrictEqual(classes.map((c) => c.start_time), ['08:00:00', '08:45:00', '09:30:00']);
  assert.ok(classes.every((c) => /^\d{2}:\d{2}:\d{2}$/.test(c.start_time) && /^\d{2}:\d{2}:\d{2}$/.test(c.end_time)));
});

check('快速添加课程：优先补没有科目的空槽位', () => {
  const doc = makeDoc({ schedules: [{ name: 'All_Monday', enable_day: [1], weeks: 'all', classes: [
    { subject: '语文', start_time: '08:00:00', end_time: '08:45:00' },
    { subject: '', start_time: '08:55:00', end_time: '09:40:00' },
    { subject: '-', start_time: '10:00:00', end_time: '10:45:00' },
  ] }] });
  const r = openEditor('schedule', doc);
  r.run('schedule.load(0, false);');
  r.run(`Array.from(document.querySelectorAll('.subject-grid fluent-button')).find(b => b.textContent === '数学').click();`);
  r.run(`Array.from(document.querySelectorAll('.subject-grid fluent-button')).find(b => b.textContent === '语文').click();`);
  assert.deepStrictEqual(stored(r).schedules[0].classes.map((c) => c.subject), ['语文', '数学', '语文']);
});

check('快速添加课程：选中某节后先覆盖该节，填满再续一节', () => {
  const doc = makeDoc({ schedules: [{ name: 'All_Monday', enable_day: [1], weeks: 'all', classes: [
    { subject: '语文', start_time: '08:00:00', end_time: '08:45:00' },
    { subject: '数学', start_time: '08:55:00', end_time: '09:40:00' },
  ] }] });
  const r = openEditor('schedule', doc);
  r.run('schedule.load(0, false);');
  r.run(`document.querySelectorAll('#class-list > *')[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));`);
  r.run(`Array.from(document.querySelectorAll('.subject-grid fluent-button')).find(b => b.textContent === '语文').click();`);
  assert.deepStrictEqual(stored(r).schedules[0].classes.map((c) => c.subject), ['语文', '语文']);
  r.run(`Array.from(document.querySelectorAll('.subject-grid fluent-button')).find(b => b.textContent === '数学').click();`);
  assert.deepStrictEqual(stored(r).schedules[0].classes.map((c) => c.subject), ['语文', '语文', '数学']);
});

check('未选中课时时下拉框改科目不会写入', () => {
  const r = openEditor('schedule', makeDoc({ schedules: [{ name: 'All_Monday', enable_day: [1], weeks: 'all', classes: [] }] }));
  r.run('schedule.load(0, false); currentClassIndex = -1; schedule.setSubject("数学");');
  assert.deepStrictEqual(stored(r).schedules[0].classes, []);
});

check('选中课时后用下拉框改科目会落盘', () => {
  const r = openEditor('schedule', makeDoc());
  r.run('schedule.load(0, false);');
  r.run(`document.querySelectorAll('#class-list > *')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
         schedule.setSubject('数学');`);
  assert.strictEqual(stored(r).schedules[0].classes[0].subject, '数学');
});

check('课时列表展示「科目 (起-止)」', () => {
  const r = openEditor('schedule', makeDoc());
  r.run('schedule.load(0, false);');
  const text = r.run(`Array.from(document.querySelectorAll('#class-list > *')).map(e => e.textContent).join('|')`);
  assert.match(text, /语文 \(08:00:00-08:45:00\)/, '实际：' + text);
});

check('课时编辑器可折叠 / 展开', () => {
  const r = openEditor('schedule', makeDoc());
  r.run('schedule.load(0, false);');
  assert.strictEqual(r.run(`document.querySelectorAll('.time-input')[0].style.display`), 'none');
  assert.strictEqual(r.run(`document.getElementById('toggle-time-editor').textContent`), '显示课时编辑器');
  r.run('schedule.toggleTimeEditor();');
  assert.strictEqual(r.run(`document.querySelectorAll('.time-input')[0].style.display`), 'inline-block');
  assert.strictEqual(r.run(`document.getElementById('add-class-btn').style.display`), 'inline-block');
  assert.strictEqual(r.run(`document.getElementById('toggle-time-editor').textContent`), '收起课时编辑器');
  r.run('schedule.toggleTimeEditor();');
  assert.strictEqual(r.run(`document.querySelectorAll('.time-input')[0].style.display`), 'none');
});

check('ExamSchedule 模式下选择日期会落盘', () => {
  const doc = makeDoc();
  const dom = buildDom('dev/pages/editor/schedule.html', Object.assign(seedDoc(doc), { 'output-mode': 'es' }));
  const r = makeRunner(dom, EDITOR_SCRIPTS);
  r.run('storage.init(); schedule.load(0, false);');
  assert.strictEqual(r.run(`document.getElementById('card-schedule2').style.display`), 'flex');
  r.run(`document.getElementById('schedule-date').value = '2026-03-02'; schedule.save();`);
  assert.strictEqual(stored(r).schedules[0].date, '2026-03-02');
});

check('应用时间表会补齐课时并落盘', () => {
  const doc = makeDoc({
    schedules: [{ name: 'All_Monday', enable_day: [1], weeks: 'all', classes: [] }],
    timetables: [{ name: 'TT', times: [{ starttime: '10:00:00', endtime: '10:45:00' }, { starttime: '10:55:00', endtime: '11:40:00' }] }],
  });
  const r = openEditor('schedule', doc);
  r.run('schedule.init(); schedule.load(0, false);');
  r.run(`schedule.applyTimetableFromSelect('TT');`);
  const classes = stored(r).schedules[0].classes;
  assert.strictEqual(classes.length, 2);
  assert.deepStrictEqual(classes.map((c) => [c.start_time, c.end_time]), [['10:00:00', '10:45:00'], ['10:55:00', '11:40:00']]);
  assert.strictEqual(stored(r).schedules[0].timetable_name, 'TT');
});

check('应用时间表时选择「未选择」不会改动课时', () => {
  const doc = makeDoc({ timetables: [{ name: 'TT', times: [{ starttime: '10:00:00', endtime: '10:45:00' }] }] });
  const r = openEditor('schedule', doc);
  r.run('schedule.init(); schedule.load(0, false);');
  r.run(`schedule.applyTimetableFromSelect('');`);
  assert.strictEqual(stored(r).schedules[0].classes.length, 1);
});

/* ======================================================== 表格视图编辑 */
group('表格视图编辑（档案 → 课程表 → 表格视图）');

check('表格视图按天渲染课程', () => {
  const r = openEditor('change', makeDoc());
  r.run(`schedule.setWeekView('all', false); schedule.view('all');`);
  const first = r.json(`Array.from(document.querySelectorAll('#change-table tbody tr')[0].children).map(td => td.textContent)`);
  assert.strictEqual(first[0], '语文');
  assert.strictEqual(first.length, 7);
});

check('点击单元格选科目会落盘', () => {
  const r = openEditor('change', makeDoc());
  r.run(`schedule.setWeekView('all', false); schedule.view('all');`);
  r.run(`document.querySelectorAll('#change-table tbody tr')[0].children[0].click();`);
  assert.deepStrictEqual(r.json(`Array.from(document.querySelectorAll('.subject-selector2 fluent-button')).map(b => b.textContent)`), ['语文', '数学']);
  r.run(`document.querySelectorAll('.subject-selector2 fluent-button')[1].click();`);
  assert.strictEqual(stored(r).schedules[0].classes[0].subject, '数学');
});

check('重复重绘表格不会残留科目浮层', () => {
  const r = openEditor('change', makeDoc());
  r.run(`schedule.setWeekView('all', false); schedule.view('all');`);
  assert.strictEqual(r.run(`document.querySelectorAll('.subject-selector2').length`), 1);
  r.run(`for (let i = 0; i < 5; i++) schedule.view('all');`);
  assert.strictEqual(r.run(`document.querySelectorAll('.subject-selector2').length`), 1);
});

check('schedule.load() 在缺少左侧列表的编辑器页不抛异常', () => {
  for (const page of ['change', 'time']) {
    const r = openEditor(page, makeDoc());
    assert.doesNotThrow(() => r.run('schedule.load(0, false);'), `${page}.html 里 schedule.load 抛异常`);
  }
});

/* --------------------------------------------------------------- 收尾 */
console.log('\n通过 ' + passed + ' 项检查' + (failures.length ? `（${failures.length} 项失败）` : ''));
