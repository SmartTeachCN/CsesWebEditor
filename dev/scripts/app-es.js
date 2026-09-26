function es_norm_time(value) {
    try { if (window.cses) return window.cses.normalizeTime(value); } catch {}
    return (value === undefined || value === null) ? '' : String(value);
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