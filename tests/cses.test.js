/*
 * CSES 格式工具单元测试（node tests/cses.test.js）
 */
const assert = require('assert');
const path = require('path');
const cses = require(path.join(__dirname, '..', 'dev', 'scripts', 'cses.js'));

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

console.log('normalizeTime');
check('补全秒', () => assert.strictEqual(cses.normalizeTime('08:00'), '08:00:00'));
check('单位数补零', () => assert.strictEqual(cses.normalizeTime('8:5'), '08:05:00'));
check('保持 HH:MM:SS', () => assert.strictEqual(cses.normalizeTime('13:30:45'), '13:30:45'));
check('空值', () => assert.strictEqual(cses.normalizeTime(''), ''));
check('非法值原样返回', () => assert.strictEqual(cses.normalizeTime('abc'), 'abc'));

console.log('时间计算');
check('addMinutes 跨小时', () => assert.strictEqual(cses.addMinutes('08:45', 10), '08:55:00'));
check('addMinutes 带秒输入', () => assert.strictEqual(cses.addMinutes('08:45:30', 45), '09:30:00'));

console.log('normalizeEnableDay');
check('整数转数组', () => assert.deepStrictEqual(cses.normalizeEnableDay(3), [3]));
check('数组去重排序', () => assert.deepStrictEqual(cses.normalizeEnableDay([7, 1, 3, 3]), [1, 3, 7]));
check('过滤非法值', () => assert.deepStrictEqual(cses.normalizeEnableDay([0, 8, 'a']), []));

console.log('v1 -> internal');
const v1 = {
  version: 1,
  subjects: [{ name: '数学', room: '101', simplified_name: '数', teacher: '张三' }],
  schedules: [{
    name: 'Odd_Monday',
    enable_day: 1,
    weeks: 'odd',
    classes: [{ subject: '数学', start_time: '08:00', end_time: '08:40:00' }]
  }],
  timetables: [{ name: '标准', times: [{ starttime: '08:00', endtime: '08:45' }] }]
};
let internal = cses.toInternal(v1);
check('version 保持 1', () => assert.strictEqual(internal.version, 1));
check('enable_day 变为数组', () => assert.deepStrictEqual(internal.schedules[0].enable_day, [1]));
check('weeks 保留', () => assert.strictEqual(internal.schedules[0].weeks, 'odd'));
check('时间补全秒', () => {
  assert.strictEqual(internal.schedules[0].classes[0].start_time, '08:00:00');
  assert.strictEqual(internal.schedules[0].classes[0].end_time, '08:40:00');
});
check('模板时间补全秒', () => assert.strictEqual(internal.timetables[0].times[0].starttime, '08:00:00'));
check('location 映射到 room', () => assert.strictEqual(internal.subjects[0].room, '101'));

console.log('v2 -> internal');
const v2 = {
  version: 2,
  configuration: {
    name: '2026年下学期',
    description: '描述',
    cycle: { work_count: 5, rest_count: 2, spans: [{ activity: 'work', count: 3 }, { activity: 'rest', count: 1 }] }
  },
  subjects: [{ name: '数学', simplified_name: '数', teacher: '李梅', location: 'A101' }],
  schedules: [{ name: '周一课表', enable_day: [1, 7], classes: [{ subject: '数学', start_time: '08:00:00', end_time: '08:40:00' }] }]
};
const internal2 = cses.toInternal(v2);
check('version 为 2', () => assert.strictEqual(internal2.version, 2));
check('location -> room', () => assert.strictEqual(internal2.subjects[0].room, 'A101'));
check('enable_day 数组保留', () => assert.deepStrictEqual(internal2.schedules[0].enable_day, [1, 7]));
check('weeks 默认 all', () => assert.strictEqual(internal2.schedules[0].weeks, 'all'));
check('configuration 保留', () => assert.strictEqual(internal2.configuration.cycle.work_count, 5));

console.log('internal -> v1 / v2');
const backV1 = cses.fromInternal(internal2, 1);
check('v1 使用 room', () => assert.strictEqual(backV1.subjects[0].room, 'A101'));
check('v1 无 location', () => assert.strictEqual(backV1.subjects[0].location, undefined));
check('v1 enable_day 取首个', () => assert.strictEqual(backV1.schedules[0].enable_day, 1));
check('v1 有 weeks', () => assert.strictEqual(backV1.schedules[0].weeks, 'all'));
check('v1 无 configuration', () => assert.strictEqual(backV1.configuration, undefined));
check('v1 version', () => assert.strictEqual(backV1.version, 1));

const backV2 = cses.fromInternal(internal, 2);
check('v2 使用 location', () => assert.strictEqual(backV2.subjects[0].location, '101'));
check('v2 无 room', () => assert.strictEqual(backV2.subjects[0].room, undefined));
check('v2 enable_day 数组', () => assert.deepStrictEqual(backV2.schedules[0].enable_day, [1]));
check('v2 无 weeks', () => assert.strictEqual(backV2.schedules[0].weeks, undefined));
check('v2 含 configuration', () => assert.strictEqual(backV2.configuration.cycle.rest_count, 2));
check('v2 version', () => assert.strictEqual(backV2.version, 2));
check('v2 保留编辑器扩展 timetables', () => assert.strictEqual(backV2.timetables.length, 1));

console.log('往返一致性');
check('v1 文档往返不丢信息', () => {
  const round = cses.fromInternal(cses.toInternal(v1), 1);
  assert.strictEqual(round.subjects[0].room, '101');
  assert.strictEqual(round.schedules[0].weeks, 'odd');
  assert.strictEqual(round.schedules[0].enable_day, 1);
  assert.strictEqual(round.schedules[0].classes[0].start_time, '08:00:00');
});
check('v2 文档往返不丢信息', () => {
  const round = cses.fromInternal(cses.toInternal(v2), 2);
  assert.strictEqual(round.subjects[0].location, 'A101');
  assert.deepStrictEqual(round.schedules[0].enable_day, [1, 7]);
  assert.strictEqual(round.configuration.name, '2026年下学期');
});

console.log('validate');
check('合法 v1', () => {
  const r = cses.validate(cses.fromInternal(cses.toInternal(v1), 1));
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.ok, true);
});
check('HH:MM 会被判为错误', () => {
  const r = cses.validate({ version: 1, subjects: [{ name: '数学' }], schedules: [{ name: 'a', enable_day: 1, weeks: 'all', classes: [{ subject: '数学', start_time: '08:00', end_time: '08:40' }] }] });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => /HH:MM:SS/.test(e)));
});
check('合法 v2', () => {
  const r = cses.validate(cses.fromInternal(cses.toInternal(v2), 2));
  assert.deepStrictEqual(r.errors, []);
});
check('v2 缺 configuration 报错', () => {
  const r = cses.validate({ version: 2, subjects: [], schedules: [] });
  assert.ok(r.errors.some(e => /configuration/.test(e)));
});
check('v2 残留 weeks 报错', () => {
  const r = cses.validate({ version: 2, configuration: cses.defaultConfiguration(), subjects: [], schedules: [{ name: 'a', enable_day: [1], weeks: 'all', classes: [] }] });
  assert.ok(r.errors.some(e => /weeks/.test(e)));
});
check('spans 不一致给出警告', () => {
  const r = cses.validate(cses.fromInternal(cses.toInternal(v2), 2));
  assert.ok(r.warnings.some(w => /spans/.test(w)));
});

console.log('\n通过 ' + passed + ' 项检查' + (process.exitCode ? '（存在失败）' : ''));
