/*
 * 集成测试：在最小 DOM 沙箱中加载 cses.js / storage.js / classisland.js / app-es.js，
 * 验证时间统一、v1↔v2 导入导出、ClassIsland 互转等真实流程。
 * 运行：node tests/integration.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const jsyaml = require(path.join(ROOT, 'node_modules', 'js-yaml'));

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
    JSON,
    Date,
    Math,
    String,
    Number,
    Array,
    Object,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    setTimeout,
    alert: (msg) => { sandbox.__alerts.push(String(msg)); },
    confirm: (msg, cb) => { if (typeof cb === 'function') cb(true); },
    // 宿主页面里由 schedule.js 提供，这里用最小桩替代
    schedule: { init() {}, refresh() {}, toggleOutputCards() {}, updateTimetableLabel() {} },
    saveTimetableState() {},
    __alerts: [],
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

const scripts = ['cses.js', 'storage.js', 'classisland.js', 'app-es.js'];

function load(sandbox, files = scripts) {
  const ctx = vm.createContext(sandbox);
  for (const f of files) {
    const code = fs.readFileSync(path.join(ROOT, 'dev', 'scripts', f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx;
}

function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

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

/* ------------------------------------------------------------------ */
console.log('旧数据迁移（v1 / HH:MM -> HH:MM:SS）');
{
  const legacy = {
    version: 1,
    subjects: [{ name: '数学', room: '101', simplified_name: '数', teacher: '张三' }],
    schedules: [
      { name: 'Odd_Monday', enable_day: 1, weeks: 'odd', classes: [{ subject: '数学', start_time: '08:00', end_time: '08:40' }] },
    ],
    timetables: [{ name: '标准', times: [{ starttime: '08:00', endtime: '08:45' }] }],
  };
  const sb = makeSandbox();
  sb.localStorage.setItem('csesData', JSON.stringify(legacy));
  const ctx = load(sb);
  run(ctx, 'storage.init();');

  check('时间被补齐为 HH:MM:SS', () => {
    assert.strictEqual(run(ctx, 'currentData.schedules[0].classes[0].start_time'), '08:00:00');
    assert.strictEqual(run(ctx, 'currentData.schedules[0].classes[0].end_time'), '08:40:00');
  });
  check('enable_day 归一化为数组', () => {
    assert.deepStrictEqual(JSON.parse(run(ctx, 'JSON.stringify(currentData.schedules[0].enable_day)')), [1]);
  });
  check('时间表模板时间被补齐', () => {
    assert.strictEqual(run(ctx, 'currentData.timetables[0].times[0].starttime'), '08:00:00');
  });
  check('迁移结果写回 localStorage', () => {
    const saved = JSON.parse(sb.localStorage.getItem('csesData'));
    assert.strictEqual(saved.schedules[0].classes[0].start_time, '08:00:00');
    assert.deepStrictEqual(saved.schedules[0].enable_day, [1]);
  });
  check('默认导出版本为 1', () => assert.strictEqual(run(ctx, 'storage.getCsesVersion()'), 1));

  check('v1 导出符合 schema（时间 HH:MM:SS、room、weeks、整数 enable_day）', () => {
    const preview = run(ctx, 'JSON.stringify(csesFromInternal(storage.buildData(), storage.getCsesVersion()))');
    const doc = JSON.parse(preview);
    assert.strictEqual(doc.version, 1);
    assert.strictEqual(doc.subjects[0].room, '101');
    assert.strictEqual(doc.schedules[0].enable_day, 1);
    assert.strictEqual(doc.schedules[0].weeks, 'odd');
    assert.match(doc.schedules[0].classes[0].start_time, /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/);
    const result = JSON.parse(run(ctx, 'JSON.stringify(storage.validate())'));
    assert.deepStrictEqual(result.errors, []);
  });

  check('file.preview 为合法 YAML 且时间带秒', () => {
    const yaml = run(ctx, 'file.preview("cy")');
    const doc = jsyaml.load(yaml);
    assert.strictEqual(doc.schedules[0].classes[0].start_time, '08:00:00');
  });
}

/* ------------------------------------------------------------------ */
console.log('CSES v2 导入');
const v2doc = {
  version: 2,
  configuration: {
    name: '2026年下学期',
    description: '2026年下学期的课程表',
    cycle: { work_count: 5, rest_count: 2, spans: [{ activity: 'work', count: 5 }, { activity: 'rest', count: 2 }] },
  },
  subjects: [{ name: '数学', simplified_name: '数', teacher: '李梅', location: 'A101' }],
  schedules: [
    { name: '周一课表', enable_day: [1, 7], classes: [{ subject: '数学', start_time: '08:00:00', end_time: '08:40:00' }] },
    { name: '周二课表 - 单周', enable_day: [2], classes: [{ subject: '语文', start_time: '08:40', end_time: '09:20:00' }] },
  ],
};
{
  const sb = makeSandbox();
  const ctx = load(sb);
  run(ctx, 'storage.init();');
  run(ctx, `file.importS(${JSON.stringify(JSON.stringify(v2doc))}, false);`);

  check('识别并记录为 v2', () => {
    assert.strictEqual(run(ctx, 'currentData.version'), 2);
    assert.strictEqual(run(ctx, 'storage.getCsesVersion()'), 2);
  });
  check('location -> room', () => assert.strictEqual(run(ctx, 'currentData.subjects[0].room'), 'A101'));
  check('多启用日保留', () => {
    assert.deepStrictEqual(JSON.parse(run(ctx, 'JSON.stringify(currentData.schedules[0].enable_day)')), [1, 7]);
  });
  check('缺秒时间自动补齐', () => {
    assert.strictEqual(run(ctx, 'currentData.schedules[1].classes[0].start_time'), '08:40:00');
  });
  check('未知科目自动补入 subjects', () => {
    assert.ok(run(ctx, 'currentData.subjects.some(function(s){return s.name === "语文";})'));
  });
  check('configuration 保留', () => {
    assert.strictEqual(run(ctx, 'currentData.configuration.cycle.work_count'), 5);
  });

  check('v2 导出符合 schema（location、enable_day 数组、无 weeks、含 configuration）', () => {
    const doc = JSON.parse(run(ctx, 'JSON.stringify(csesFromInternal(storage.buildData(), storage.getCsesVersion()))'));
    assert.strictEqual(doc.version, 2);
    assert.strictEqual(doc.subjects[0].location, 'A101');
    assert.strictEqual(doc.subjects[0].room, undefined);
    assert.deepStrictEqual(doc.schedules[0].enable_day, [1, 7]);
    assert.strictEqual(doc.schedules[0].weeks, undefined);
    assert.strictEqual(doc.configuration.cycle.rest_count, 2);
    const result = JSON.parse(run(ctx, 'JSON.stringify(storage.validate())'));
    assert.deepStrictEqual(result.errors, []);
  });

  check('切回 v1 时 enable_day 取首个并补上 weeks', () => {
    run(ctx, 'storage.setCsesVersion(1);');
    const doc = JSON.parse(run(ctx, 'JSON.stringify(csesFromInternal(storage.buildData(), 1))'));
    assert.strictEqual(doc.version, 1);
    assert.strictEqual(doc.subjects[0].room, 'A101');
    assert.strictEqual(doc.subjects[0].location, undefined);
    assert.strictEqual(doc.schedules[0].enable_day, 1);
    assert.strictEqual(doc.schedules[0].weeks, 'all');
    assert.strictEqual(doc.configuration, undefined);
  });

  check('云端负载为合法 v2 JSON', () => {
    run(ctx, 'storage.setCsesVersion(2, {silent:true, noRefresh:true});');
    run(ctx, 'window.__payload = buildCloudPayload();');
    const payload = JSON.parse(run(ctx, 'window.__payload'));
    assert.strictEqual(payload.version, 2);
    const result = JSON.parse(run(ctx, 'JSON.stringify(cses.validate(JSON.parse(window.__payload)))'));
    assert.deepStrictEqual(result.errors, []);
  });

  check('ClassIsland 导出为多启用日生成多个课程计划', () => {
    const ci = JSON.parse(run(ctx, 'JSON.stringify(CsestoCiFromat(storage.buildData()))'));
    const plans = Object.values(ci.ClassPlans);
    // 周一课表有 2 个启用日 -> 2 个计划；周二课表 1 个
    assert.strictEqual(plans.length, 3);
    const weekdays = plans.map((p) => p.TimeRule.WeekDay).sort((a, b) => a - b);
    assert.deepStrictEqual(weekdays, [0, 1, 2]); // 周日(7->0)、周一、周二
    const first = Object.values(ci.TimeLayouts)[0];
    assert.match(first.Layouts[0].StartSecond, /^2025-01-01T\d{2}:\d{2}:\d{2}$/);
  });

  check('ClassIsland 导出时间点为 2.0 的 TimeSpan（StartTime/EndTime）', () => {
    const ci = JSON.parse(run(ctx, 'JSON.stringify(CsestoCiFromat(storage.buildData()))'));
    const layouts = Object.values(ci.TimeLayouts).flatMap((l) => l.Layouts);
    assert.ok(layouts.length > 0);
    for (const item of layouts) {
      assert.match(item.StartTime, /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/);
      assert.match(item.EndTime, /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/);
      // 旧版字段仍保留，兼容 2.0 之前的客户端
      assert.match(item.StartSecond, /^2025-01-01T\d{2}:\d{2}:\d{2}$/);
    }
  });

  check('ClassIsland 导入支持 2.0 的 TimeSpan 时间点', () => {
    const ciDoc = {
      Subjects: { s1: { Name: '数学', Initial: '数', TeacherName: '张三' } },
      TimeLayouts: {
        t1: {
          Name: '周一',
          Layouts: [
            { StartTime: '08:00:00', EndTime: '08:45:00', TimeType: 0, DefaultClassId: 's1' },
            { StartTime: '08:45:00', EndTime: '08:55:00', TimeType: 1, DefaultClassId: 's1' },
            { StartTime: '08:55:00', EndTime: '09:40:00', TimeType: 0, DefaultClassId: 's1' },
          ],
        },
      },
      ClassPlans: {
        c1: { TimeLayoutId: 't1', TimeRule: { WeekDay: 1, WeekCountDiv: 0, WeekCountDivTotal: 0 }, Classes: [{ SubjectId: 's1' }, { SubjectId: 's1' }], Name: '周一' },
      },
    };
    const sb2 = makeSandbox();
    const ctx2 = load(sb2);
    run(ctx2, 'storage.init();');
    run(ctx2, `file.importS(${JSON.stringify(JSON.stringify(ciDoc))}, false);`);
    assert.strictEqual(run(ctx2, 'currentData.schedules[0].classes[0].start_time'), '08:00:00');
    assert.strictEqual(run(ctx2, 'currentData.schedules[0].classes[1].start_time'), '08:55:00');
    assert.strictEqual(run(ctx2, 'currentData.schedules[0].classes[0].end_time'), '08:45:00');
  });

  check('ExamSchedule 导出时间带秒', () => {
    const es = JSON.parse(run(ctx, 'JSON.stringify(es_procees(storage.buildData()))'));
    assert.match(es.examInfos[0].start, /T\d{2}:\d{2}:\d{2}$/);
  });
}

/* ------------------------------------------------------------------ */
console.log('ClassIsland 导入（时间统一）');
{
  const ciDoc = {
    Subjects: { s1: { Name: '数学', Initial: '数', TeacherName: '张三' } },
    TimeLayouts: {
      t1: {
        Name: '周一',
        Layouts: [
          { StartSecond: '2025-01-01T08:00:00', EndSecond: '2025-01-01T08:45:00', TimeType: 0, DefaultClassId: 's1' },
        ],
      },
    },
    ClassPlans: {
      c1: { TimeLayoutId: 't1', TimeRule: { WeekDay: 1, WeekCountDiv: 1 }, Classes: [{ SubjectId: 's1' }], Name: '周一' },
    },
  };
  const sb = makeSandbox();
  const ctx = load(sb);
  run(ctx, 'storage.init();');
  run(ctx, `file.importS(${JSON.stringify(JSON.stringify(ciDoc))}, false);`);
  check('CI 导入时间仍为 HH:MM:SS', () => {
    assert.match(run(ctx, 'currentData.schedules[0].classes[0].start_time'), /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/);
  });
  check('CI 导入 weeks 为单周', () => assert.strictEqual(run(ctx, 'currentData.schedules[0].weeks'), 'odd'));
  check('CI 导入为 v1 文档且通过校验', () => {
    const result = JSON.parse(run(ctx, 'JSON.stringify(storage.validate())'));
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(run(ctx, 'storage.getCsesVersion()'), 1);
  });
}

/* ------------------------------------------------------------------ */
console.log('空数据处理');
{
  const sb = makeSandbox();
  const ctx = load(sb);
  run(ctx, 'storage.init();');
  check('空文档 v1 校验通过', () => {
    const result = JSON.parse(run(ctx, 'JSON.stringify(storage.validate())'));
    assert.deepStrictEqual(result.errors, []);
  });
  check('空文档切到 v2 也通过校验', () => {
    run(ctx, 'storage.setCsesVersion(2, {silent:true, noRefresh:true});');
    const doc = JSON.parse(run(ctx, 'JSON.stringify(storage.buildDoc())'));
    assert.strictEqual(doc.version, 2);
    assert.ok(doc.configuration && doc.configuration.cycle);
    const result = JSON.parse(run(ctx, 'JSON.stringify(storage.validate())'));
    assert.deepStrictEqual(result.errors, []);
  });
}

console.log('\n通过 ' + passed + ' 项检查' + (process.exitCode ? '（存在失败）' : ''));
