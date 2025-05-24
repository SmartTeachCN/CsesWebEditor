function es_procees(config) {
    let examInfos2 = [];

    config.schedules.forEach(element => {
        const day = element.date || new Date().toISOString().slice(0, 10);
        if (element.classes && Array.isArray(element.classes)) {
            element.classes.forEach(c => {
                let lesson = {
                    name: c.subject,
                    start: day + "T" + c.start_time,
                    end: day + "T" + c.end_time
                };
                examInfos2.push(lesson);
            });
        }
    });

    return {
        subjects: [...config.subjects],
        schedules: [...config.schedules],
        examInfos: examInfos2,
        examName: config.examName,
        message: config.message,
        room: config.room,
    };
}