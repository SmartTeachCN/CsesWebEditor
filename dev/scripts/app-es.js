function es_norm_time(value) {
    try { if (window.cses) return window.cses.normalizeTime(value); } catch {}
    return (value === undefined || value === null) ? '' : String(value);
}

/** 解析 ExamSchedule 的时间串："2025-05-12T07:20:00" / "2025-05-12 07:20" / "07:20" */
function es_parse_datetime(raw) {
    const s = (raw === undefined || raw === null) ? '' : String(raw).trim();
    const pad = (n) => String(n).padStart(2, '0');
    const full = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
    if (full) return { date: full[1], time: `${pad(full[2])}:${pad(full[3])}:${pad(full[4] || '00')}` };
    const timeOnly = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
    if (timeOnly) return { date: '', time: `${pad(timeOnly[1])}:${pad(timeOnly[2])}:${pad(timeOnly[3] || '00')}` };
    return { date: '', time: '' };
}

/** CSES 的星期编号：1=周一 … 7=周日 */
function es_weekday(dateStr) {
    try {
        const d = new Date(String(dateStr) + 'T00:00:00');
        if (isNaN(d.getTime())) return 1;
        const jsDay = d.getDay(); // 0 = 周日
        return jsDay === 0 ? 7 : jsDay;
    } catch (e) { return 1; }
}

/*
 * ExamSchedule 文档 -> 编辑器内部结构。
 *
 * ExamSchedule 文件只有 examName / message / room / examInfos（每场考试的
 * 名称 + 起止时间），没有 subjects / schedules；而档案页面是按「课表 + 课时」
 * 编辑的。所以这里按日期把 examInfos 归组成课表：
 *   一个日期 -> 一张课表（date = 该日期），一场考试 -> 一节课。
 * 导出时由 es_procees() 还原成 ExamSchedule，保证往返不丢数据。
 */
function es_to_internal(doc) {
    const src = (doc && typeof doc === 'object') ? doc : {};
    const infos = Array.isArray(src.examInfos) ? src.examInfos : [];
    const byDate = new Map();
    const subjectNames = [];
    infos.forEach((info) => {
        if (!info || typeof info !== 'object') return;
        const name = (info.name === undefined || info.name === null) ? '' : String(info.name);
        const start = es_parse_datetime(info.start);
        const end = es_parse_datetime(info.end);
        const date = start.date || end.date || '';
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date).push({
            subject: name || '-',
            start_time: start.time || end.time || '00:00:00',
            end_time: end.time || start.time || '00:00:00',
        });
        if (name && subjectNames.indexOf(name) === -1) subjectNames.push(name);
    });
    const schedules = [];
    Array.from(byDate.keys()).sort().forEach((date) => {
        const classes = byDate.get(date).slice()
            .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
        schedules.push({
            name: date || '未设定日期',
            date: date,
            enable_day: [es_weekday(date)],
            weeks: 'all',
            classes: classes,
        });
    });
    return {
        version: 1,
        subjects: subjectNames.map((n) => ({ name: n, simplified_name: '', teacher: '', room: '' })),
        schedules: schedules,
        timetables: [],
        // ExamSchedule 自己的顶层字段原样保留，导出时带回去
        examName: src.examName,
        message: src.message,
        room: src.room,
    };
}

function es_procees(config) {
    let examInfos2 = [];

    (config.schedules || []).forEach(element => {
        const day = element.date || new Date().toISOString().slice(0, 10);
        if (element.classes && Array.isArray(element.classes)) {
            element.classes.forEach(c => {
                // 时间统一 HH:MM:SS
                let lesson = {
                    name: c.subject,
                    start: day + "T" + es_norm_time(c.start_time),
                    end: day + "T" + es_norm_time(c.end_time)
                };
                examInfos2.push(lesson);
            });
        }
    });

    const timetableInfo = (config.schedules || []).map(s => ({
        scheduleName: s.name,
        timetableName: s.timetable_name || null,
    }));

    return {
        subjects: [...(config.subjects || [])],
        schedules: [...(config.schedules || [])],
        examInfos: examInfos2,
        examName: config.examName,
        message: config.message,
        room: config.room,
        timetableInfo
    };
}