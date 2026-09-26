/*
 * DOM 级测试：用 jsdom 加载真实的 schedule.html / time.html 结构 + cses.js/storage.js/schedule.js，
 * 验证课表编辑器在 v1 / v2 下的行为（时间输入、启用日多选、表格视图、时间表模板）。
 * 运行：node tests/dom.test.js   （需要 jsdom：npm i jsdom --no-save）
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
  console.error('未安装 jsdom，跳过 DOM 测试（npm i jsdom --no-save）');
  process.exit(0);
}
const jsyaml = require(path.join(ROOT, 'node_modules', 'js-yaml'));

function buildDom(pageRelPath) {
  const html = fs.readFileSync(path.join(ROOT, pageRelPath), 'utf8');
  const bodyStart = html.indexOf('<body>');
  const bodyEnd = html.lastIndexOf('<script>');
  const body = html.slice(bodyStart, bodyEnd);
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head>${body}</body></html>`, {
    runScripts: 'outside-only',
    url: 'http://localhost/dev/pages/editor/schedule.html',
    pretendToBeVisual: true,
  });
  dom.window.jsyaml = jsyaml;
  dom.window.alert = () => {};
  dom.window.confirm = (msg, cb) => { if (typeof cb === 'function') cb(true); };
  dom.window.prompt = () => null;
  return dom;
}

const SCRIPTS = ['cses.js', 'storage.js', 'schedule.js'];

function makeRunner(dom, scriptList) {
  const ctx = dom.getInternalVMContext();
  for (const f of (scriptList || SCRIPTS)) {
    const code = fs.readFileSync(path.join(ROOT, 'dev', 'scripts', f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  const run = (code) => vm.runInContext(code, ctx);
  const json = (expr) => JSON.parse(run(`JSON.stringify(${expr})`));
  return { ctx, run, json };
}

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  - ' + name);
  } catch (e) {
    console.error('  FAIL - ' + name);
    console.error('        ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n        ') : e));
    process.exitCode = 1;
  }
}

/* ---------------- 课表编辑（schedule.html） ---------------- */
const { run, json } = makeRunner(buildDom('dev/pages/editor/schedule.html'));

run('storage.init();');
run(`currentData = cses.toInternal({
  version: 1,
  subjects: [{ name: '数学', simplified_name: '数', teacher: '张三', room: '101' }],
  schedules: [
    { name: 'Odd_Monday', enable_day: 1, weeks: 'odd', classes: [{ subject: '数学', start_time: '08:00:00', end_time: '08:40:00' }] }
  ]
});`);

console.log('v1 课表编辑');
check('load 不抛异常且显示单日/轮周卡片', () => {
  run('schedule.load(0, false);');
  assert.strictEqual(run(`document.getElementById('card-schedule0').style.display`), 'flex');
  assert.strictEqual(run(`document.getElementById('card-schedule1').style.display`), 'flex');
  assert.strictEqual(run(`document.getElementById('card-schedule-days').style.display`), 'none');
});
check('单日/轮周下拉框回填', () => {
  assert.strictEqual(run(`document.getElementById('day-mode').value`), '1');
  assert.strictEqual(run(`document.getElementById('week-mode').value`), 'odd');
});
check('选中课时后时间输入为 HH:MM:SS', () => {
  run(`document.getElementById('class-list').firstChild.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));`);
  assert.deepStrictEqual(json(`Array.from(document.querySelectorAll('.time-input')).map(i => i.value)`), ['08:00:00', '08:40:00']);
});
check('setTime 会把 HH:MM 补成 HH:MM:SS', () => {
  run(`document.querySelectorAll('.time-input')[0].value = '09:05';
       document.querySelectorAll('.time-input')[1].value = '09:45';
       schedule.setTime();`);
  assert.strictEqual(run('currentData.schedules[0].classes[0].start_time'), '09:05:00');
  assert.strictEqual(run('currentData.schedules[0].classes[0].end_time'), '09:45:00');
});
check('setTime 在输入为空时不清空已有数据', () => {
  run(`document.querySelectorAll('.time-input')[0].value = '';
       document.querySelectorAll('.time-input')[1].value = '';
       schedule.setTime();`);
  assert.strictEqual(run('currentData.schedules[0].classes[0].start_time'), '09:05:00');
});
check('addClass 写入 HH:MM:SS 并接续上一节', () => {
  run(`document.querySelectorAll('.time-input')[0].value = '';
       document.querySelectorAll('.time-input')[1].value = '';
       document.getElementById('current-subject').value = '数学';
       schedule.addClass();`);
  assert.strictEqual(run('currentData.schedules[0].classes.length'), 2);
  assert.strictEqual(run('currentData.schedules[0].classes[1].start_time'), '09:45:00');
  assert.match(run('currentData.schedules[0].classes[1].end_time'), /^\d{2}:\d{2}:00$/);
});
check('课表列表展示 HH:MM:SS', () => {
  const text = run(`Array.from(document.querySelectorAll('#class-list > *')).map(e => e.textContent).join('|')`);
  assert.ok(/09:05:00-09:45:00/.test(text), '实际：' + text);
});
check('v1 导出为整数 enable_day / room / weeks', () => {
  const doc = json('storage.buildDoc()');
  assert.strictEqual(doc.schedules[0].enable_day, 1);
  assert.strictEqual(doc.schedules[0].weeks, 'odd');
  assert.strictEqual(doc.subjects[0].room, '101');
});

console.log('v2 课表编辑');
check('切换到 v2 后显示启用日多选卡片', () => {
  run('storage.setCsesVersion(2, {silent:true, noRefresh:true}); schedule.load(0, false);');
  assert.strictEqual(run(`document.getElementById('card-schedule-days').style.display`), 'flex');
  assert.strictEqual(run(`document.getElementById('card-schedule0').style.display`), 'none');
  assert.strictEqual(run(`document.getElementById('card-schedule1').style.display`), 'none');
});
check('启用日 chip 渲染 7 天并高亮已选项', () => {
  const chips = json(`Array.from(document.querySelectorAll('#day-mode-multi .day-chip')).map(b => b.textContent + (b.classList.contains('selected') ? '*' : ''))`);
  assert.deepStrictEqual(chips, ['星期一*', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']);
});
check('点击 chip 增加启用日', () => {
  run(`document.querySelectorAll('#day-mode-multi .day-chip')[6].click();`);
  assert.deepStrictEqual(json('currentData.schedules[0].enable_day'), [1, 7]);
});
check('v2 自动命名使用中文课表名（不带单双周）', () => {
  assert.strictEqual(run('currentData.schedules[0].name'), '周一、周日课表');
});
check('v2 导出为数组 enable_day 且不含 weeks', () => {
  const doc = json('storage.buildDoc()');
  assert.strictEqual(doc.version, 2);
  assert.deepStrictEqual(doc.schedules[0].enable_day, [1, 7]);
  assert.strictEqual(doc.schedules[0].weeks, undefined);
  assert.strictEqual(doc.subjects[0].location, '101');
  assert.ok(doc.configuration && doc.configuration.cycle);
});
check('v2 表格视图把课程同时放入周一与周日', () => {
  // 表格视图由 change.html 提供（含 #change-table）
  const table = makeRunner(buildDom('dev/pages/editor/change.html'));
  table.run('storage.init();');
  table.run(`currentData = cses.toInternal({
    version: 2,
    subjects: [{ name: '数学' }],
    schedules: [{ name: '周一、周日课表', enable_day: [1, 7], classes: [{ subject: '数学', start_time: '08:00:00', end_time: '08:40:00' }] }]
  });`);
  table.run('storage.save(); schedule.setWeekView("all", false); schedule.view("all");');
  const cells = table.json(`Array.from(document.querySelectorAll('#change-table tbody tr')).map(tr => Array.from(tr.children).map(td => td.textContent).join(','))`);
  assert.ok(cells.length > 0, '表格未渲染');
  const first = cells[0].split(',');
  assert.strictEqual(first.length, 7);
  assert.strictEqual(first[0], '数学');
  assert.strictEqual(first[6], '数学');
});
check('切换回 v1 后单日卡片恢复', () => {
  run('storage.setCsesVersion(1, {silent:true, noRefresh:true}); schedule.load(0, false);');
  assert.strictEqual(run(`document.getElementById('card-schedule0').style.display`), 'flex');
  assert.strictEqual(run(`document.getElementById('card-schedule-days').style.display`), 'none');
});

/* ---------------- 时间表编辑（time.html） ---------------- */
console.log('时间表编辑');
const second = makeRunner(buildDom('dev/pages/editor/time.html'));
const run2 = second.run;
const json2 = second.json;
run2('storage.init();');
check('时间表行输入为 HH:MM:SS 且 step=1', () => {
  run2('schedule.renderTimeEditorRows([["08:00:00","08:45:00"]]);');
  assert.deepStrictEqual(json2(`Array.from(document.querySelectorAll('#time-rows input')).map(i => i.value + '/' + i.step)`), ['08:00:00/1', '08:45:00/1']);
});
check('新增时间行按课程/课间分钟自动推算 HH:MM:SS', () => {
  run2(`document.getElementById('quick-course-min').value = '45';
        document.getElementById('quick-break-min').value = '10';
        schedule.addTimeRow();`);
  const rows = json2(`Array.from(document.querySelectorAll('#time-rows > div')).map(r => [r.querySelector('.time-row-start').value, r.querySelector('.time-row-end').value])`);
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows[1], ['08:55:00', '09:40:00']);
});
check('保存时间表模板后 currentData.timetables 时间为 HH:MM:SS', () => {
  run2(`document.getElementById('time-template-name').value = '测试时间表';
        schedule.currentTimetableName = '测试时间表';
        schedule.saveTimeTemplate();`);
  assert.strictEqual(run2('JSON.stringify(currentData.timetables[0].times)'),
    '[{"starttime":"08:00:00","endtime":"08:45:00"},{"starttime":"08:55:00","endtime":"09:40:00"}]');
});
check('时间表模板导出 JSON 时间为 HH:MM:SS', () => {
  // 用 copyToClip 桩捕获导出的 JSON（jsdom 无剪贴板/下载能力）
  run2('window.__copied = null; copyToClip = function (arr) { window.__copied = arr[0]; };');
  run2('schedule.exportTimeTemplateJSON();');
  const out = run2('window.__copied || ""');
  const obj = JSON.parse(out);
  assert.strictEqual(obj.times[1].starttime, '08:55:00');
  assert.strictEqual(obj.times[1].endtime, '09:40:00');
});

/* ---------------- 实例启动向导（cloud.html，运行在 iframe 中） ---------------- */
console.log('实例启动向导');
{
  // 编辑器页面运行在 iframe 里，主页面才加载了 ui.js（showModal / alert / confirm）
  const alertCalls = [];
  const wizardDom = buildDom('dev/pages/editor/cloud.html');
  wizardDom.window.alert = (msg) => { alertCalls.push(String(msg)); };
  const wizard = makeRunner(wizardDom, ['cses.js', 'storage.js']);
  const runW = wizard.run;

  runW(`storage.init();
        localStorage.setItem('output-mode', 'ci');
        localStorage.setItem('directoryId', 'abc1234567');
        localStorage.setItem('currentTerminalId', '实验班');`);

  check('编辑器 iframe 内确实没有 showModal（复现前提）', () => {
    assert.strictEqual(runW('typeof showModal'), 'undefined');
  });

  check('没有主页面可用时向导不再抛 showModal is not defined', () => {
    alertCalls.length = 0;
    runW('storage.preview();');
    assert.strictEqual(alertCalls.length, 1);            // 退化为提示，而不是异常
    assert.match(alertCalls[0], /ClassIsland/);
  });

  check('向导会交给主页面弹出模态框', () => {
    const parentDom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'outside-only' });
    let captured = null;
    Object.defineProperty(wizardDom.window, 'parent', {
      configurable: true,
      value: {
        document: parentDom.window.document,
        showModal: (content) => {
          captured = content;
          const holder = parentDom.window.document.createElement('div');
          holder.innerHTML = content;
          parentDom.window.document.body.appendChild(holder);
        },
      },
    });
    const origSetTimeout = wizardDom.window.setTimeout;
    wizardDom.window.setTimeout = (fn) => { fn(); return 0; };  // 立即执行，便于同步断言
    try {
      runW('storage.preview();');
    } finally {
      wizardDom.window.setTimeout = origSetTimeout;
    }
    assert.ok(captured, '主页面未收到模态框内容');
    assert.match(captured, /在ClassIsland使用静态配置/);
    // 按钮在父页面里，必须从父页面查找并绑定，否则「下载清单文件」是死的
    const btn = parentDom.window.document.getElementById('download-manifest-btn');
    assert.ok(btn, '父页面里没有下载按钮');
    assert.strictEqual(typeof btn.onclick, 'function');

    // 点击后应当生成含正确清单地址的清单文件
    runW(`window.__blobText = null; window.__anchorClicked = false;
          window.Blob = function (parts) { window.__blobText = parts.join(''); };
          try { window.URL.createObjectURL = function () { return 'blob:test'; }; } catch (e) {}
          try { window.URL.revokeObjectURL = function () {}; } catch (e) {}
          var origCreate = document.createElement.bind(document);
          document.createElement = function (tag) {
            var el = origCreate(tag);
            if (String(tag).toLowerCase() === 'a') { el.click = function () { window.__anchorClicked = true; }; }
            return el;
          };`);
    btn.onclick();
    assert.strictEqual(runW('window.__anchorClicked'), true);
    assert.match(runW('window.__blobText'), /classisland\/manifest\.php\?id=abc1234567/);
    assert.match(runW('window.__blobText'), /"ManagementServerKind": 0/);
  });

  check('编辑器页面都带上了 initEnv / 向导需要的 js-yaml', () => {
    for (const page of ['cloud', 'control', 'change', 'subject', 'schedule', 'time', 'source']) {
      const html = fs.readFileSync(path.join(ROOT, 'dev', 'pages', 'editor', page + '.html'), 'utf8');
      assert.ok(/js-yaml/.test(html), `${page}.html 缺少 js-yaml`);
    }
  });
}

console.log('\n通过 ' + passed + ' 项检查' + (process.exitCode ? '（存在失败）' : ''));
