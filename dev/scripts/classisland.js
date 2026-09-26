function guid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 时间统一为 HH:MM:SS
function ciNormTime(value) {
  try { if (window.cses) return window.cses.normalizeTime(value); } catch {}
  return (value === undefined || value === null) ? '' : String(value);
}
// 启用日统一为整数数组
function ciNormDays(value) {
  try { if (window.cses) return window.cses.normalizeEnableDay(value); } catch {}
  const arr = Array.isArray(value) ? value : (value === undefined || value === null || value === '' ? [] : [value]);
  return arr.map(function (x) { return parseInt(x, 10); }).filter(function (n) { return n >= 1 && n <= 7; });
}

// 时间统一为 HH:MM:SS（补零），ClassIsland 2.0 的时间点为 TimeSpan，必须是这个格式
function ciSpanTime(value) {
  const t = ciNormTime(value);
  const m = typeof t === 'string' ? t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/) : null;
  if (!m) return '';
  return String(m[1]).padStart(2, '0') + ':' + m[2] + ':' + (m[3] || '00');
}

// 时间点字段。ClassIsland 2.0 使用 TimeSpan（StartTime/EndTime），
// 同时输出旧版的 StartSecond/EndSecond（ISO 日期时间），以兼容 2.0 之前的客户端。
function ciTimePointFields(start, end) {
  return {
    StartTime: start,
    EndTime: end,
    StartSecond: `2025-01-01T${start}`,
    EndSecond: `2025-01-01T${end}`,
  };
}

// 从 ClassIsland 时间点中取出 HH:MM:SS，兼容 2.0（TimeSpan）与旧版（ISO 日期时间）
function ciTimeOfTimePoint(item, field) {
  if (!item || typeof item !== 'object') return '';
  const span = field === 'start' ? item.StartTime : item.EndTime;
  const spanTime = ciSpanTime(span);
  if (spanTime) return spanTime;
  const legacy = field === 'start' ? item.StartSecond : item.EndSecond;
  const m = typeof legacy === 'string' ? legacy.match(/T?(\d{2}):(\d{2})(?::(\d{2}))?/) : null;
  if (!m) return '';
  return m[1] + ':' + m[2] + ':' + (m[3] || '00');
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
      if (!timeLayout) continue;

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
      (timeLayout.Layouts || []).forEach((layout) => {
        const subjectName = subjectMap[layout.DefaultClassId];
        if (subjectName && layout.TimeType === 0) {
          const startTime = ciTimeOfTimePoint(layout, 'start');
          const endTime = ciTimeOfTimePoint(layout, 'end');
          if (!startTime || !endTime) return;
          schedule.classes.push({
            subject: subjectName,
            start_time: ciNormTime(startTime),
            end_time: ciNormTime(endTime),
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
    (target.subjects || []).forEach((subject) => {
      const subjectId = subject.uuid || guid(); // 复用现有uuid
      subjectMap[subject.name] = subjectId;
      outputJson.Subjects[subjectId] = {
        Name: subject.name || "",
        Initial: subject.simplified_name || "",
        TeacherName: subject.teacher || "",
        IsOutDoor: false,
      };
    });

    outputJson.extraKey = outputJson.extraKey || {};
    outputJson.extraKey.TimetableMap = outputJson.extraKey.TimetableMap || {};

    // 处理Schedules，复用ClassPlan和TimeLayout的uuid
    (target.schedules || []).forEach((schedule) => {
      const timeLayoutId = schedule.time_layout_uuid || guid(); // 复用TimeLayout uuid
      const days = ciNormDays(schedule.enable_day);
      const dayList = days.length ? days : [1];

      // 创建时间布局
      const timeLayout = {
        Name: schedule.name,
        Layouts: [],
      };
      // 将所选时间表名称写入时间布局的额外键
      if (schedule.timetable_name) {
        timeLayout.TimetableName = schedule.timetable_name;
      }

      // 处理课程时间段（时间统一 HH:MM:SS）
      let lastEnd = "";
      const classOrder = [];
      (schedule.classes || []).forEach((cls) => {
        const start = ciSpanTime(cls.start_time);
        const end = ciSpanTime(cls.end_time);
        if (!start || !end) return;
        const subjectId = subjectMap[cls.subject] || guid();
        if (lastEnd) {
          timeLayout.Layouts.push(Object.assign(ciTimePointFields(lastEnd, start), {
            TimeType: 1,
            DefaultClassId: subjectId,
          }));
        }
        lastEnd = end;
        timeLayout.Layouts.push(Object.assign(ciTimePointFields(start, end), {
          TimeType: 0,
          DefaultClassId: subjectId,
        }));
        classOrder.push(subjectId);
      });

      // 将生成的布局添加到输出
      outputJson.TimeLayouts[timeLayoutId] = timeLayout;

      // CSES v2 中一张课表可对应多个启用日，为每个启用日生成一个课程计划
      dayList.forEach((day, dayIndex) => {
        const classPlanId = (dayIndex === 0 && schedule.uuid) ? schedule.uuid : guid();
        const classPlan = {
          TimeLayoutId: timeLayoutId,
          TimeRule: {
            WeekDay: day == 7 ? 0 : day,
            WeekCountDiv: schedule.weeks === "even" ? 2 :
              schedule.weeks === "odd" ? 1 : 0,
            WeekCountDivTotal: (schedule.weeks === "even" || schedule.weeks === "odd") ? 2 : 0,
            IsActive: false,
          },
          Classes: classOrder.map((subjectId) => ({ SubjectId: subjectId })),
          Name: dayList.length > 1 ? `${schedule.name} (${day})` : schedule.name,
          IsOverlay: false,
          IsEnabled: true,
        };
        // 将所选时间表名称写入课程计划的额外键
        if (schedule.timetable_name) {
          classPlan.TimetableName = schedule.timetable_name;
        }
        outputJson.ClassPlans[classPlanId] = classPlan;
        // 在 extraKey 中维护时间表名称映射（ClassPlanId -> TimetableName）
        outputJson.extraKey.TimetableMap[classPlanId] = schedule.timetable_name || null;
      });
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
        // 2.0 使用 TimeSpan（StartTime/EndTime），之前的版本使用 ISO 日期时间（StartSecond/EndSecond）
        const hasTimeSpan = typeof layout.StartTime === "string" && typeof layout.EndTime === "string";
        const hasLegacyTime = typeof layout.StartSecond === "string" && typeof layout.EndSecond === "string";
        if (!hasTimeSpan && !hasLegacyTime) return false;
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