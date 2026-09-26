/*
 * 用官方 JSON Schema（draft-07）校验编辑器导出的 CSES v1 / v2 文档。
 * 运行：node tests/schema.test.js    （需要 ajv：npm i ajv --no-save）
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let Ajv;
try {
  Ajv = require(path.join(ROOT, 'node_modules', 'ajv'));
} catch (e) {
  console.error('未安装 ajv，跳过 schema 测试（npm i ajv --no-save）');
  process.exit(0);
}
const ajv = new Ajv({ allErrors: true, strict: false });
const v1Schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema', 'cses-v1.schema.json'), 'utf8'));
const v2Schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema', 'cses-v2.schema.json'), 'utf8'));
const validateV1 = ajv.compile(v1Schema);
const validateV2 = ajv.compile(v2Schema);

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
function schemaErrors(validate) {
  return (validate.errors || []).map((e) => `${e.instancePath} ${e.message}`).join('; ');
}

/* 载入编辑器脚本（与真实页面相同的顺序） */
const cses = require(path.join(ROOT, 'dev', 'scripts', 'cses.js'));

const internal = cses.toInternal({
  version: 1,
  subjects: [
    { name: '数学', simplified_name: '数', teacher: '张三', room: '101' },
    { name: '语文', simplified_name: '语' },
  ],
  schedules: [
    { name: 'Odd_Monday', enable_day: 1, weeks: 'odd', classes: [{ subject: '数学', start_time: '08:00', end_time: '08:40' }] },
    { name: 'All_Sunday', enable_day: 7, weeks: 'all', classes: [{ subject: '语文', start_time: '13:30:00', end_time: '14:10:00' }] },
  ],
  timetables: [{ name: '标准', times: [{ starttime: '08:00', endtime: '08:45' }] }],
});
// 多启用日（来自 v2 文档或用户在 v2 下勾选）
const internal2 = cses.toInternal({
  version: 2,
  configuration: {
    name: '2026年下学期',
    description: '2026年下学期的课程表',
    cycle: { work_count: 5, rest_count: 2, spans: [{ activity: 'work', count: 5 }, { activity: 'rest', count: 2 }] },
  },
  subjects: [
    { name: '数学', simplified_name: '数', teacher: '李梅', location: 'A101' },
    { name: '语文', simplified_name: '语', location: '102' },
    { name: 'C语言程序设计教程 - 实验课', teacher: '赵军', location: 'A栋103' },
  ],
  schedules: [
    { name: '周一课表', enable_day: [1, 7], classes: [{ subject: '数学', start_time: '08:00:00', end_time: '08:40:00' }, { subject: '语文', start_time: '08:40:00', end_time: '09:20:00' }] },
  ],
});

console.log('导出的 v1 文档');
check('通过官方 v1 schema', () => {
  const doc = cses.fromInternal(internal, 1);
  assert.ok(validateV1(doc), schemaErrors(validateV1));
});
check('v1 顶层只含 version/subjects/schedules/timetables（无 configuration）', () => {
  const doc = cses.fromInternal(internal, 1);
  assert.strictEqual(doc.configuration, undefined);
  assert.strictEqual(doc.version, 1);
  assert.ok(Array.isArray(doc.subjects) && Array.isArray(doc.schedules));
});
check('v1 schedule 必需字段齐全（name/enable_day/weeks/classes）', () => {
  const doc = cses.fromInternal(internal, 1);
  doc.schedules.forEach((s) => {
    assert.ok(typeof s.name === 'string' && s.name, 'name 缺失');
    assert.ok([1, 2, 3, 4, 5, 6, 7].includes(s.enable_day), 'enable_day 非法：' + s.enable_day);
    assert.ok(['all', 'odd', 'even'].includes(s.weeks), 'weeks 非法：' + s.weeks);
    assert.ok(Array.isArray(s.classes));
  });
});
check('v1 所有时间均满足 HH:MM:SS pattern', () => {
  const doc = cses.fromInternal(internal, 1);
  doc.schedules.forEach((s) => s.classes.forEach((c) => {
    assert.match(c.start_time, /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/);
    assert.match(c.end_time, /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/);
  }));
});

console.log('导出的 v2 文档');
check('通过官方 v2 schema', () => {
  const doc = cses.fromInternal(internal2, 2);
  assert.ok(validateV2(doc), schemaErrors(validateV2));
});
check('v2 使用 location 且不含 room', () => {
  const doc = cses.fromInternal(internal2, 2);
  doc.subjects.forEach((s) => {
    assert.strictEqual(s.room, undefined);
    if (s.location !== undefined) assert.strictEqual(typeof s.location, 'string');
  });
});
check('v2 enable_day 为整数数组且无 weeks', () => {
  const doc = cses.fromInternal(internal2, 2);
  assert.deepStrictEqual(doc.schedules[0].enable_day, [1, 7]);
  assert.strictEqual(doc.schedules[0].weeks, undefined);
});
check('v2 configuration 满足必需字段与 cycle 约束', () => {
  const doc = cses.fromInternal(internal2, 2);
  assert.strictEqual(typeof doc.configuration.name, 'string');
  assert.strictEqual(typeof doc.configuration.description, 'string');
  assert.ok(doc.configuration.cycle.work_count >= 2);
  assert.ok(doc.configuration.cycle.rest_count >= 2);
  assert.ok(doc.configuration.cycle.spans.length >= 1);
  doc.configuration.cycle.spans.forEach((s) => {
    assert.ok(['work', 'rest'].includes(s.activity));
    assert.ok(s.count >= 1);
  });
});
check('v1 文档也能通过 v2 schema 的 subjects/schedules 定义（除 version/configuration）', () => {
  // 反向：把 v1 导出的 subjects/schedules 塞进 v2 外壳应通过
  const doc1 = cses.fromInternal(internal, 1);
  const doc = {
    version: 2,
    configuration: cses.defaultConfiguration(),
    subjects: doc1.subjects.map((s) => ({ ...s, location: s.room })).map(({ room, ...rest }) => rest),
    schedules: doc1.schedules.map((s) => ({ name: s.name, enable_day: [s.enable_day], classes: s.classes })),
  };
  assert.ok(validateV2(doc), schemaErrors(validateV2));
});

console.log('反例（证明校验有效）');
check('HH:MM 的 v1 文档无法通过 schema', () => {
  const bad = {
    version: 1,
    subjects: [{ name: '数学' }],
    schedules: [{ name: 'a', enable_day: 1, weeks: 'all', classes: [{ subject: '数学', start_time: '08:00', end_time: '08:40' }] }],
  };
  assert.strictEqual(validateV1(bad), false);
});
check('v1 文档缺 weeks 无法通过 schema', () => {
  const bad = {
    version: 1,
    subjects: [{ name: '数学' }],
    schedules: [{ name: 'a', enable_day: 1, classes: [] }],
  };
  assert.strictEqual(validateV1(bad), false);
});
check('v2 文档缺 configuration 无法通过 schema', () => {
  const bad = { version: 2, subjects: [], schedules: [] };
  assert.strictEqual(validateV2(bad), false);
});
check('v2 中 enable_day 用整数无法通过 schema', () => {
  const bad = {
    version: 2,
    configuration: cses.defaultConfiguration(),
    subjects: [],
    schedules: [{ name: 'a', enable_day: 1, classes: [] }],
  };
  assert.strictEqual(validateV2(bad), false);
});

console.log('官方示例文档');
check('官方 v2 示例通过 schema', () => {
  const sample = {
    version: 2,
    configuration: {
      name: '2026年下学期',
      description: '2026年下学期的课程表',
      cycle: { work_count: 5, rest_count: 2, spans: [{ activity: 'work', count: 3 }, { activity: 'rest', count: 1 }] },
    },
    subjects: [
      { name: '数学', simplified_name: '数', teacher: '李梅', location: '101' },
      { name: '语文', simplified_name: '语', location: '102' },
      { name: 'C语言程序设计教程 - 实验课', teacher: '赵军', location: 'A栋103' },
    ],
    schedules: [
      { name: '周一课表', enable_day: [1, 7], classes: [{ subject: '数学', start_time: '08:00:00', end_time: '08:40:00' }, { subject: '语文', start_time: '08:40:00', end_time: '09:20:00' }] },
      { name: '周二课表 - 单周', enable_day: [2], classes: [{ subject: '数学', start_time: '08:00:00', end_time: '08:40:00' }] },
    ],
  };
  assert.ok(validateV2(sample), schemaErrors(validateV2));
});
check('官方 v2 示例经编辑器往返后仍通过 schema', () => {
  const sample = {
    version: 2,
    configuration: {
      name: '2026年下学期',
      description: '2026年下学期的课程表',
      cycle: { work_count: 5, rest_count: 2, spans: [{ activity: 'work', count: 3 }, { activity: 'rest', count: 1 }] },
    },
    subjects: [{ name: '数学', simplified_name: '数', teacher: '李梅', location: '101' }],
    schedules: [{ name: '周一课表', enable_day: [1, 7], classes: [{ subject: '数学', start_time: '08:00:00', end_time: '08:40:00' }] }],
  };
  const round = cses.fromInternal(cses.toInternal(sample), 2);
  assert.ok(validateV2(round), schemaErrors(validateV2));
});

console.log('\n通过 ' + passed + ' 项检查' + (process.exitCode ? '（存在失败）' : ''));
