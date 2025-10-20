function guid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ClassIsland格式转CSES
function CiToCsesFromat(target) {
  try {
    const extraKey = target.extraKey ?? {};
    const outputJson = {
      subjects: [],
      schedules: [],
      extraKey
    };

    // Subjects转换，添加uuid字段
    const subjectMap = {};
    for (const subjectId in target.Subjects) {
      const subject = target.Subjects[subjectId];
      subjectMap[subjectId] = subject.Name;
      outputJson.subjects.push({
        uuid: subjectId, // 添加uuid字段
        name: subject.Name,
        simplified_name: subject.Initial,
        teacher: subject.TeacherName,
      });
    }

    // 转换ClassPlans和TimeLayouts，添加uuid相关字段
    for (const classPlanId in target.ClassPlans) {
      const classPlan = target.ClassPlans[classPlanId];
      const timeLayout = target.TimeLayouts[classPlan.TimeLayoutId];

      const schedule = {
        uuid: classPlanId, // 添加ClassPlan的uuid
        time_layout_uuid: classPlan.TimeLayoutId, // 添加TimeLayout的uuid
        name: timeLayout.Name,
        enable_day: classPlan.TimeRule.WeekDay == 0 ? 7 : classPlan.TimeRule.WeekDay,
        weeks: classPlan.TimeRule.WeekCountDiv === 2 ? "even" :
          classPlan.TimeRule.WeekCountDiv === 1 ? "odd" : "all",
        classes: [],
      };

      // 处理课程时间布局
      timeLayout.Layouts.forEach((layout) => {
        const subjectName = subjectMap[layout.DefaultClassId];
        if (subjectName && layout.TimeType === 0) {
          // 处理时间格式并转换
          const defaultTime = new Date('2025-01-01T00:00:00');
          let startTime = new Date(layout.StartSecond || defaultTime);
          let endTime = new Date(layout.EndSecond || defaultTime);
          if (startTime == "Invalid Date") startTime = defaultTime;
          if (endTime == "Invalid Date") endTime = defaultTime;
          startTime.setHours(startTime.getHours() + 8);
          endTime.setHours(endTime.getHours() + 8);

          schedule.classes.push({
            subject: subjectName,
            start_time: startTime.toISOString().split("T")[1].split(".")[0],
            end_time: endTime.toISOString().split("T")[1].split(".")[0],
          });
        }
      });
      outputJson.schedules.push(schedule);
    }
    return outputJson;
  } catch (error) {
    console.error('Error in CiToCsesFromat:', error);
    alert(`Error: ${error.message}\nLocation: ${error.stack}`);
  }
}

// CSES格式转ClassIsland
function CsestoCiFromat(target) {
  try {
    const extraKey = target.extraKey ?? {};
    const outputJson = {
      TimeLayouts: {},
      ClassPlans: {},
      Subjects: {},
      extraKey
    };

    // 处理Subjects，优先使用现有的uuid
    const subjectMap = {};
    target.subjects.forEach((subject) => {
      const subjectId = subject.uuid || guid(); // 复用现有uuid
      subjectMap[subject.name] = subjectId;
      outputJson.Subjects[subjectId] = {
        Name: subject.name || "",
        Initial: subject.simplified_name || "",
        TeacherName: subject.teacher || "",
        IsOutDoor: false,
      };
    });

    // 处理Schedules，复用ClassPlan和TimeLayout的uuid
    target.schedules.forEach((schedule) => {
      const timeLayoutId = schedule.time_layout_uuid || guid(); // 复用TimeLayout uuid
      const classPlanId = schedule.uuid || guid(); // 复用ClassPlan uuid

      // 创建时间布局
      const timeLayout = {
        Name: schedule.name,
        Layouts: [],
      };
      // 将所选时间表名称写入时间布局的额外键
      if (schedule.timetable_name) {
        timeLayout.TimetableName = schedule.timetable_name;
      }

      // 创建课程计划
      const classPlan = {
        TimeLayoutId: timeLayoutId,
        TimeRule: {
          WeekDay: schedule.enable_day == 7 ? 0 : schedule.enable_day,
          WeekCountDiv: schedule.weeks === "even" ? 2 :
            schedule.weeks === "odd" ? 1 : 0,
          WeekCountDivTotal: (schedule.weeks === "even" || schedule.weeks === "odd") ? 2 : 0,
          IsActive: false,
        },
        Classes: [],
        Name: schedule.name,
        IsOverlay: false,
        IsEnabled: true,
      };
      // 将所选时间表名称写入课程计划的额外键
      if (schedule.timetable_name) {
        classPlan.TimetableName = schedule.timetable_name;
      }

      // 处理课程时间段
      let lastEnd = "";
      schedule.classes.forEach((cls) => {
        const subjectId = subjectMap[cls.subject] || guid();
        if (lastEnd) {
          timeLayout.Layouts.push({
            StartSecond: lastEnd,
            EndSecond: `2025-01-01T${cls.start_time}`,
            TimeType: 1,
            DefaultClassId: subjectId,
          });
        }
        lastEnd = `2025-01-01T${cls.end_time}`;
        timeLayout.Layouts.push({
          StartSecond: `2025-01-01T${cls.start_time}`,
          EndSecond: lastEnd,
          TimeType: 0,
          DefaultClassId: subjectId,
        });
        classPlan.Classes.push({ SubjectId: subjectId });
      });

      // 将生成的布局和计划添加到输出
      outputJson.TimeLayouts[timeLayoutId] = timeLayout;
      outputJson.ClassPlans[classPlanId] = classPlan;
      // 在 extraKey 中维护时间表名称映射（ClassPlanId -> TimetableName）
      outputJson.extraKey = outputJson.extraKey || {};
      outputJson.extraKey.TimetableMap = outputJson.extraKey.TimetableMap || {};
      outputJson.extraKey.TimetableMap[classPlanId] = schedule.timetable_name || null;
    });

    return outputJson;
  } catch (error) {
    alert(error);
  }
}

function isCiFormat(obj) {
  try {
    // 检查是否是对象
    if (typeof obj !== "object" || obj === null) false;
    // 检查 TimeLayouts
    if (typeof obj.TimeLayouts !== "object" || obj.TimeLayouts === null) {
      return false;
    }

    for (const timeLayoutId in obj.TimeLayouts) {
      const timeLayout = obj.TimeLayouts[timeLayoutId];
      if (typeof timeLayout !== "object" || timeLayout === null) return false;
      if (typeof timeLayout.Name !== "string") return false;
      if (!Array.isArray(timeLayout.Layouts)) return false;
      for (const layout of timeLayout.Layouts) {
        if (typeof layout !== "object" || layout === null) return false;
        if (typeof layout.StartSecond !== "string") return false;
        if (typeof layout.EndSecond !== "string") return false;
        if (typeof layout.TimeType !== "number") return false;
      }
    }

    // ClassPlans
    if (typeof obj.ClassPlans !== "object" || obj.ClassPlans === null)
      return false;
    for (const classPlanId in obj.ClassPlans) {
      const classPlan = obj.ClassPlans[classPlanId];
      if (typeof classPlan !== "object" || classPlan === null) return false;
      if (typeof classPlan.TimeLayoutId !== "string") return false;
      if (typeof classPlan.TimeRule !== "object" || classPlan.TimeRule === null)
        return false;
      // if (typeof classPlan.TimeRule.WeekDay !== "number") return false;
      if (typeof classPlan.TimeRule.WeekCountDiv !== "number") return false;
      if (!Array.isArray(classPlan.Classes)) return false;
      for (const cls of classPlan.Classes) {
        if (typeof cls !== "object" || cls === null) return false;
        if (typeof cls.SubjectId !== "string") return false;
      }
      if (typeof classPlan.Name !== "string") return false;
    }
    // Subjects
    if (typeof obj.Subjects !== "object" || obj.Subjects === null) return false;
    for (const subjectId in obj.Subjects) {
      const subject = obj.Subjects[subjectId];
      if (typeof subject !== "object" || subject === null) return false;
      if (typeof subject.Name !== "string") return false;
    }
    return true;
  } catch {
    return false;
  }
}