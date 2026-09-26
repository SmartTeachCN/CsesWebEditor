/*
 * cses.js —— CSES 文档格式工具（v1 / v2）
 *
 * 目标：
 *  1. 统一时间格式为 HH:MM:SS（CSES 规范 pattern: ([01]\d|2[0-3]):([0-5]\d):([0-5]\d)）。
 *  2. 提供 CSES v1 / v2 文档与编辑器内部数据结构之间的双向转换。
 *  3. 提供文档格式校验，便于在导出前提示问题。
 *
 * 编辑器内部结构（canonical）：
 *   {
 *     version: 1 | 2,                       // 目标导出用的 CSES 版本
 *     configuration: {...},                 // v2 专用（v1 导出时丢弃）
 *     subjects: [{ name, simplified_name, teacher, room }],
 *     schedules: [{ name, enable_day: number[], weeks, classes: [{subject,start_time,end_time}] }],
 *     timetables: [...]                     // 编辑器扩展字段
 *   }
 *
 * 说明：内部一律使用 room（v1 字段名）与 enable_day 数组，
 *      导出时按版本映射为 room/location 与整数/数组。
 *
 * 该文件不依赖 DOM，既能被浏览器页面直接引入，也能在 Node 中 require 做单元测试。
 */
(function (root) {
  'use strict';

  var TIME_PATTERN = '([01]\\d|2[0-3]):([0-5]\\d):([0-5]\\d)';
  var TIME_RE = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
  var LOOSE_TIME_RE = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;
  var SHORT_TIME_RE = /^(\d{1,2}):(\d{1,2})/;
  var SUPPORTED_VERSIONS = [1, 2];

  function pad2(n) {
    n = parseInt(n, 10) || 0;
    return (n < 10 ? '0' : '') + n;
  }

  function isObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function clone(v) {
    if (v === undefined || v === null) return v;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }

  function copyOwn(target, source) {
    if (!isObject(source)) return target;
    Object.keys(source).forEach(function (k) { target[k] = source[k]; });
    return target;
  }

  /** 把任意可识别的时间字符串补全为 HH:MM:SS；无法识别时原样返回。 */
  function normalizeTime(value) {
    if (value === undefined || value === null) return '';
    var raw = String(value).trim();
    if (!raw) return '';
    if (TIME_RE.test(raw)) return raw;
    var m = LOOSE_TIME_RE.exec(raw);
    if (!m) return raw;
    var h = Math.min(23, parseInt(m[1], 10) || 0);
    var mi = Math.min(59, parseInt(m[2], 10) || 0);
    var se = m[3] === undefined ? 0 : Math.min(59, parseInt(m[3], 10) || 0);
    return pad2(h) + ':' + pad2(mi) + ':' + pad2(se);
  }

  function isValidTime(value) {
    return TIME_RE.test(String(value === undefined || value === null ? '' : value).trim());
  }

  /** HH:MM(:SS) -> 分钟数（用于计算），非法返回 null。 */
  function timeToMinutes(value) {
    var m = SHORT_TIME_RE.exec(String(value === undefined || value === null ? '' : value).trim());
    if (!m) return null;
    var h = parseInt(m[1], 10);
    var mi = parseInt(m[2], 10);
    if (isNaN(h) || isNaN(mi)) return null;
    return h * 60 + mi;
  }

  /** 分钟数 -> HH:MM:SS */
  function minutesToTime(mins) {
    var total = Math.round(Number(mins) || 0);
    total = ((total % 1440) + 1440) % 1440;
    return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60) + ':00';
  }

  /** 在时间上加减分钟，返回 HH:MM:SS；无法解析返回 ''。 */
  function addMinutes(value, delta) {
    var base = timeToMinutes(value);
    if (base === null) return '';
    return minutesToTime(base + (parseInt(delta, 10) || 0));
  }

  /** enable_day 归一化为升序去重的 1-7 整数数组。 */
  function normalizeEnableDay(value) {
    var arr;
    if (Array.isArray(value)) arr = value;
    else if (value === undefined || value === null || value === '') arr = [];
    else arr = [value];
    var out = [];
    arr.forEach(function (item) {
      var n = parseInt(item, 10);
      if (!isNaN(n) && n >= 1 && n <= 7 && out.indexOf(n) === -1) out.push(n);
    });
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function normalizeWeeks(value) {
    return (value === 'odd' || value === 'even') ? value : 'all';
  }

  function defaultConfiguration() {
    return {
      name: '',
      description: '',
      cycle: {
        work_count: 5,
        rest_count: 2,
        spans: [
          { activity: 'work', count: 5 },
          { activity: 'rest', count: 2 }
        ]
      }
    };
  }

  function normalizeCycle(cycle) {
    var c = isObject(cycle) ? cycle : {};
    var work = parseInt(c.work_count, 10);
    var rest = parseInt(c.rest_count, 10);
    if (isNaN(work) || work < 2) work = 5;
    if (isNaN(rest) || rest < 2) rest = 2;
    var spans = Array.isArray(c.spans) ? c.spans.map(function (s) {
      var so = isObject(s) ? s : {};
      var count = parseInt(so.count, 10);
      return {
        activity: so.activity === 'rest' ? 'rest' : 'work',
        count: (isNaN(count) || count < 1) ? 1 : count
      };
    }) : [];
    if (!spans.length) {
      spans = [{ activity: 'work', count: work }, { activity: 'rest', count: rest }];
    }
    var out = { work_count: work, rest_count: rest, spans: spans };
    // 保留未知字段
    if (isObject(c)) {
      Object.keys(c).forEach(function (k) {
        if (!(k in out)) out[k] = c[k];
      });
    }
    return out;
  }

  function normalizeConfiguration(cfg) {
    var base = defaultConfiguration();
    var c = isObject(cfg) ? cfg : {};
    var out = {
      name: typeof c.name === 'string' ? c.name : base.name,
      description: typeof c.description === 'string' ? c.description : base.description,
      cycle: normalizeCycle(c.cycle)
    };
    Object.keys(c).forEach(function (k) {
      if (!(k in out)) out[k] = c[k];
    });
    return out;
  }

  /** spans 中 work/rest 计数是否与 cycle 声明一致 */
  function cycleSpanMismatch(cycle) {
    var c = normalizeCycle(cycle);
    var work = 0, rest = 0;
    c.spans.forEach(function (s) {
      if (s.activity === 'rest') rest += s.count; else work += s.count;
    });
    return (work !== c.work_count || rest !== c.rest_count)
      ? { work: work, rest: rest, work_count: c.work_count, rest_count: c.rest_count }
      : null;
  }

  function normalizeClass(cls) {
    var o = {};
    copyOwn(o, cls);
    o.subject = (o.subject === undefined || o.subject === null) ? '' : String(o.subject);
    o.start_time = normalizeTime(o.start_time);
    o.end_time = normalizeTime(o.end_time);
    return o;
  }

  function normalizeTimetable(t) {
    var o = {};
    copyOwn(o, t);
    o.name = o.name || o.key || '';
    var times = Array.isArray(o.times) ? o.times : [];
    o.times = times.map(function (item) {
      if (Array.isArray(item)) return [normalizeTime(item[0]), normalizeTime(item[1])];
      var io = isObject(item) ? item : {};
      return { starttime: normalizeTime(io.starttime), endtime: normalizeTime(io.endtime) };
    });
    return o;
  }

  /**
   * 判断一个解析后的对象是否可能是 CSES 文档。
   * 有 version 1/2，或者至少含有 subjects / schedules 数组。
   */
  function looksLikeCses(doc) {
    if (!isObject(doc)) return false;
    var v = parseInt(doc.version, 10);
    if (v === 1 || v === 2) return true;
    return Array.isArray(doc.subjects) || Array.isArray(doc.schedules);
  }

  /**
   * 识别 CSES 文档版本：2 / 1；无法识别为 CSES 时返回 null。
   * 这是「导入时自动选择版本」的依据。
   */
  function detectVersion(doc) {
    if (!isObject(doc)) return null;
    var v = parseInt(doc.version, 10);
    if (v === 2) return 2;
    if (v === 1) return 1;
    return looksLikeCses(doc) ? 1 : null;
  }

  /**
   * 任意 CSES 文档 / 历史本地数据 -> 编辑器内部结构
   * 兼容 v1（enable_day 整数、room、weeks）与 v2（enable_day 数组、location、configuration）。
   */
  function toInternal(doc) {
    var src = isObject(doc) ? doc : {};
    var version = parseInt(src.version, 10) === 2 ? 2 : 1;
    var internal = {};
    copyOwn(internal, src);
    internal.version = version;

    if (version === 2 || isObject(src.configuration)) {
      internal.configuration = normalizeConfiguration(src.configuration);
    } else {
      internal.configuration = defaultConfiguration();
    }

    internal.subjects = (Array.isArray(src.subjects) ? src.subjects : []).map(function (s) {
      var o = {};
      copyOwn(o, s);
      if (o.location !== undefined && o.location !== null && o.location !== '') o.room = o.location;
      if (o.room === undefined || o.room === null) o.room = '';
      delete o.location;
      return o;
    });

    internal.schedules = (Array.isArray(src.schedules) ? src.schedules : []).map(function (s) {
      var o = {};
      copyOwn(o, s);
      var days = normalizeEnableDay(o.enable_day);
      if (!days.length) days = [1];
      o.enable_day = days;
      o.weeks = normalizeWeeks(o.weeks);
      o.classes = (Array.isArray(o.classes) ? o.classes : []).map(normalizeClass);
      if (typeof o.name !== 'string' || !o.name) o.name = '未命名课表';
      return o;
    });

    internal.timetables = Array.isArray(src.timetables) ? src.timetables.map(normalizeTimetable) : [];
    return internal;
  }

  /**
   * 编辑器内部结构 -> CSES 文档
   * version=1：enable_day 整数、weeks、room；version=2：enable_day 数组、location、configuration。
   */
  function fromInternal(data, version) {
    var src = isObject(data) ? data : {};
    var v = parseInt(version, 10) === 2 ? 2 : (parseInt(version, 10) === 1 ? 1 : (parseInt(src.version, 10) === 2 ? 2 : 1));

    var doc = { version: v };

    if (v === 2) doc.configuration = normalizeConfiguration(src.configuration);

    doc.subjects = (Array.isArray(src.subjects) ? src.subjects : []).map(function (s) {
      var o = {};
      copyOwn(o, s);
      var place = (o.location !== undefined && o.location !== null && o.location !== '')
        ? o.location
        : o.room;
      delete o.room;
      delete o.location;
      if (place !== undefined && place !== null && String(place) !== '') {
        o[v === 2 ? 'location' : 'room'] = place;
      }
      return o;
    });

    doc.schedules = (Array.isArray(src.schedules) ? src.schedules : []).map(function (s) {
      var o = {};
      copyOwn(o, s);
      var days = normalizeEnableDay(o.enable_day);
      if (!days.length) days = [1];
      o.enable_day = (v === 2) ? days : days[0];
      if (v === 1) o.weeks = normalizeWeeks(o.weeks);
      else delete o.weeks;
      o.classes = (Array.isArray(o.classes) ? o.classes : []).map(normalizeClass);
      return o;
    });

    // 其余顶层字段（timetables、extraKey、examName、message、room 等）保持原样
    Object.keys(src).forEach(function (k) {
      if (k === 'version' || k === 'configuration' || k === 'subjects' || k === 'schedules') return;
      if (src[k] === undefined) return;
      doc[k] = src[k];
    });

    return doc;
  }

  /** 依据实际 targets 生成 CSES 文档（不做任何格式转换，供校验使用）。 */
  function validate(doc) {
    var errors = [];
    var warnings = [];
    var issues = [];
    var d = isObject(doc) ? doc : {};

    function add(level, message, extra) {
      var issue = { level: level, message: message, path: (extra && extra.path) || '' };
      if (extra) {
        Object.keys(extra).forEach(function (k) { issue[k] = extra[k]; });
      }
      issues.push(issue);
      if (level === 'error') errors.push(message);
      else warnings.push(message);
      return issue;
    }
    function err(message, extra) { return add('error', message, extra); }
    function warn(message, extra) { return add('warning', message, extra); }

    var v = parseInt(d.version, 10);
    if (SUPPORTED_VERSIONS.indexOf(v) === -1) {
      err('version 必须为 1 或 2，当前为 ' + (d.version === undefined ? '(缺失)' : d.version), { path: 'version', field: 'version' });
      v = 1;
    }

    if (v === 2) {
      if (!isObject(d.configuration)) {
        err('CSES v2 缺少 configuration 对象', { path: 'configuration', field: 'configuration' });
      } else {
        var cfg = d.configuration;
        if (typeof cfg.name !== 'string') err('configuration.name 必须为字符串', { path: 'configuration.name', field: 'name' });
        else if (!cfg.name.trim()) warn('configuration.name 为空，建议填写一个有意义的名称', { path: 'configuration.name', field: 'name' });
        if (typeof cfg.description !== 'string') err('configuration.description 必须为字符串', { path: 'configuration.description', field: 'description' });
        if (!isObject(cfg.cycle)) {
          err('configuration.cycle 必须是对象', { path: 'configuration.cycle', field: 'cycle' });
        } else {
          var cyc = cfg.cycle;
          if (!(parseInt(cyc.work_count, 10) >= 2)) err('configuration.cycle.work_count 必须是不小于 2 的整数', { path: 'configuration.cycle.work_count', field: 'work_count' });
          if (!(parseInt(cyc.rest_count, 10) >= 2)) err('configuration.cycle.rest_count 必须是不小于 2 的整数', { path: 'configuration.cycle.rest_count', field: 'rest_count' });
          if (!Array.isArray(cyc.spans) || cyc.spans.length === 0) {
            err('configuration.cycle.spans 必须是非空数组', { path: 'configuration.cycle.spans', field: 'spans' });
          } else {
            cyc.spans.forEach(function (s, i) {
              if (!isObject(s)) { err('spans[' + i + '] 必须是对象', { path: 'configuration.cycle.spans[' + i + ']', field: 'spans' }); return; }
              if (s.activity !== 'work' && s.activity !== 'rest') err('spans[' + i + '].activity 只能为 work 或 rest', { path: 'configuration.cycle.spans[' + i + '].activity', field: 'spans' });
              if (!(parseInt(s.count, 10) >= 1)) err('spans[' + i + '].count 必须是不小于 1 的整数', { path: 'configuration.cycle.spans[' + i + '].count', field: 'spans' });
            });
            var mismatch = cycleSpanMismatch(cyc);
            if (mismatch) {
              warn('spans 中 work=' + mismatch.work + ' / rest=' + mismatch.rest +
                '，与 work_count=' + mismatch.work_count + ' / rest_count=' + mismatch.rest_count + ' 不一致',
                { path: 'configuration.cycle.spans', field: 'spans' });
            }
          }
        }
      }
    }

    var subjectNames = [];
    if (!Array.isArray(d.subjects)) {
      err('subjects 必须是数组', { path: 'subjects', field: 'subjects' });
    } else {
      d.subjects.forEach(function (s, i) {
        var sp = 'subjects[' + i + ']';
        if (!isObject(s)) { err(sp + ' 必须是对象', { path: sp, subjectIndex: i }); return; }
        if (typeof s.name !== 'string' || !s.name) err(sp + '.name 不能为空', { path: sp + '.name', subjectIndex: i, field: 'name' });
        else subjectNames.push(s.name);
        var placeKey = v === 2 ? 'location' : 'room';
        var wrongKey = v === 2 ? 'room' : 'location';
        if (s[wrongKey] !== undefined && s[placeKey] === undefined) {
          err(sp + ' 在 CSES v' + v + ' 中应使用 ' + placeKey + ' 而不是 ' + wrongKey,
            { path: sp + '.' + placeKey, subjectIndex: i, field: placeKey });
        }
      });
    }

    if (!Array.isArray(d.schedules)) {
      err('schedules 必须是数组', { path: 'schedules', field: 'schedules' });
    } else {
      d.schedules.forEach(function (s, i) {
        var label = 'schedules[' + i + ']';
        var where = { path: label, scheduleIndex: i };
        if (!isObject(s)) { err(label + ' 必须是对象', where); return; }
        if (typeof s.name !== 'string' || !s.name) err(label + '.name 不能为空', { path: label + '.name', scheduleIndex: i, field: 'name' });

        if (v === 1) {
          var day = parseInt(s.enable_day, 10);
          if (!(day >= 1 && day <= 7)) err(label + '.enable_day 必须是 1-7 的整数（CSES v1）', { path: label + '.enable_day', scheduleIndex: i, field: 'enable_day' });
          if (['all', 'odd', 'even'].indexOf(s.weeks) === -1) err(label + '.weeks 必须是 all/odd/even', { path: label + '.weeks', scheduleIndex: i, field: 'weeks' });
        } else {
          if (!Array.isArray(s.enable_day) || s.enable_day.length === 0) {
            err(label + '.enable_day 必须是非空整数数组（CSES v2）', { path: label + '.enable_day', scheduleIndex: i, field: 'enable_day' });
          } else {
            s.enable_day.forEach(function (x, j) {
              if (!(parseInt(x, 10) >= 1)) err(label + '.enable_day[' + j + '] 必须是不小于 1 的整数', { path: label + '.enable_day[' + j + ']', scheduleIndex: i, field: 'enable_day' });
            });
          }
          if (s.weeks !== undefined) err(label + ' 在 CSES v2 中不应包含 weeks 字段', { path: label + '.weeks', scheduleIndex: i, field: 'weeks' });
        }

        if (!Array.isArray(s.classes)) {
          err(label + '.classes 必须是数组', { path: label + '.classes', scheduleIndex: i, field: 'classes' });
          return;
        }
        s.classes.forEach(function (c, j) {
          var cl = label + '.classes[' + j + ']';
          var at = { scheduleIndex: i, classIndex: j };
          if (!isObject(c)) { err(cl + ' 必须是对象', { path: cl, scheduleIndex: i, classIndex: j }); return; }
          if (typeof c.subject !== 'string' || c.subject === '') err(cl + '.subject 不能为空', { path: cl + '.subject', scheduleIndex: i, classIndex: j, field: 'subject' });
          else if (subjectNames.length && subjectNames.indexOf(c.subject) === -1) {
            warn(cl + '.subject "' + c.subject + '" 未在 subjects 中定义', { path: cl + '.subject', scheduleIndex: i, classIndex: j, field: 'subject' });
          }
          if (!isValidTime(c.start_time)) err(cl + '.start_time 必须是 HH:MM:SS 格式，当前为 ' + JSON.stringify(c.start_time), { path: cl + '.start_time', scheduleIndex: i, classIndex: j, field: 'start_time' });
          if (!isValidTime(c.end_time)) err(cl + '.end_time 必须是 HH:MM:SS 格式，当前为 ' + JSON.stringify(c.end_time), { path: cl + '.end_time', scheduleIndex: i, classIndex: j, field: 'end_time' });
          var a = timeToMinutes(c.start_time);
          var b = timeToMinutes(c.end_time);
          if (a !== null && b !== null && b < a) warn(cl + ' 的结束时间早于开始时间', { path: cl, scheduleIndex: i, classIndex: j, field: 'end_time' });
          void at;
        });
      });
    }

    return { ok: errors.length === 0, version: v, errors: errors, warnings: warnings, issues: issues };
  }

  /** 文本形式的校验结果，便于直接展示。 */
  function describeIssues(result) {
    if (!result) return '';
    var lines = [];
    (result.errors || []).forEach(function (e) { lines.push('错误：' + e); });
    (result.warnings || []).forEach(function (w) { lines.push('警告：' + w); });
    return lines.join('\n');
  }

  var api = {
    TIME_PATTERN: TIME_PATTERN,
    TIME_RE: TIME_RE,
    SUPPORTED_VERSIONS: SUPPORTED_VERSIONS,
    pad2: pad2,
    clone: clone,
    isObject: isObject,
    normalizeTime: normalizeTime,
    isValidTime: isValidTime,
    timeToMinutes: timeToMinutes,
    minutesToTime: minutesToTime,
    addMinutes: addMinutes,
    normalizeEnableDay: normalizeEnableDay,
    normalizeWeeks: normalizeWeeks,
    normalizeClass: normalizeClass,
    normalizeTimetable: normalizeTimetable,
    defaultConfiguration: defaultConfiguration,
    normalizeConfiguration: normalizeConfiguration,
    normalizeCycle: normalizeCycle,
    cycleSpanMismatch: cycleSpanMismatch,
    looksLikeCses: looksLikeCses,
    detectVersion: detectVersion,
    toInternal: toInternal,
    fromInternal: fromInternal,
    validate: validate,
    describeIssues: describeIssues
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.cses = api;
})(typeof window !== 'undefined' ? window : null);
