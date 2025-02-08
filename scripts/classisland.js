function guid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isCiFormat(obj) {
  try {
    // 检查是否是对象
    if (typeof obj !== "object" || obj === null) false;
    // 检查 TimeLayouts
    if (typeof obj.TimeLayouts !== "object" || obj.TimeLayouts === null)
      return false;

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
      if (typeof classPlan.TimeRule.WeekDay !== "number") return false;
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

// ClassIsland格式转CSES
function CiToCsesFromat(target) {
  try {
    const outputJson = {
      subjects: [],
      schedules: [],
    };

    console.log(target);

    // Subjects
    const subjectMap = {};
    for (const subjectId in target.Subjects) {
      const subject = target.Subjects[subjectId];
      subjectMap[subjectId] = subject.Name;
      outputJson.subjects.push({
        name: subject.Name,
        simplified_name: subject.Initial,
        teacher: subject.TeacherName,
      });
    }

    // TimeLayouts + ClassPlans
    for (const classPlanId in target.ClassPlans) {
      const classPlan = target.ClassPlans[classPlanId];
      const timeLayout = target.TimeLayouts[classPlan.TimeLayoutId];

      const schedule = {
        name: timeLayout.Name,
        enable_day:
          classPlan.TimeRule.WeekDay == 0 ? 7 : classPlan.TimeRule.WeekDay,
        weeks:
          classPlan.TimeRule.WeekCountDiv === 2
            ? "even"
            : classPlan.TimeRule.WeekCountDiv === 1
            ? "odd"
            : "all",
        classes: [],
      };

      timeLayout.Layouts.forEach((layout) => {
        const subjectName = subjectMap[layout.DefaultClassId];
        if (subjectName && layout.TimeType === 0) {
          // 仅导入上课
          const startTime = new Date(layout.StartSecond);
          const endTime = new Date(layout.EndSecond);
          if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            console.warn(`Invalid time format for layout:`, layout);
            return;
          }

          startTime.setHours(startTime.getHours() + 8);
          endTime.setHours(endTime.getHours() + 8);

          console.log(startTime.toISOString() + "-" + endTime.toISOString());

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
    alert(error);
  }
}

// CESE格式转ClassIsland
function CsestoCiFromat(target) {
  try {
    const outputJson = {
      Name: "",
      TimeLayouts: {},
      ClassPlans: {},
      Subjects: {},
      TempClassPlanSetupTime: new Date().toISOString(),
    };

    // Subjects
    const subjectMap = {};
    target.subjects.forEach((subject) => {
      const subjectId = guid();
      subjectMap[subject.name] = subjectId; // 因为课程和科目绑定,所以这里需要做索引
      outputJson.Subjects[subjectId] = {
        Name: subject.name || "",
        Initial: subject.simplified_name || "",
        TeacherName: subject.teacher || "",
        IsOutDoor: false, // 室内课程
      };
    });

    // TimeLayouts + ClassPlans
    target.schedules.forEach((schedule) => {
      const timeLayoutId = guid();
      const classPlanId = guid();

      const timeLayout = {
        Name: schedule.name,
        Layouts: [],
      };

      const classPlan = {
        TimeLayoutId: timeLayoutId,
        TimeRule: {
          WeekDay: schedule.enable_day == 7 ? 0 : schedule.enable_day,
          WeekCountDiv:
            schedule.weeks === "even" ? 2 : schedule.weeks === "odd" ? 1 : 0,
          WeekCountDivTotal:
            schedule.weeks === "even" || schedule.weeks === "odd" ? 2 : 0,
          IsActive: false,
        },
        Classes: [],
        Name: schedule.name,
        IsOverlay: false,
        OverlaySourceId: null,
        OverlaySetupTime: new Date().toISOString(),
        IsEnabled: true,
      };

      let LastStartSecond = "";
      let LastEndSecond = "";
      schedule.classes.forEach((cls) => {
        const subjectId = subjectMap[cls.subject] || guid(); // 如果没有对应的科目，则生成一个新的 UUID
        if (LastStartSecond) {
          timeLayout.Layouts.push({
            StartSecond: LastEndSecond,
            EndSecond: `2025-01-01T${cls.start_time}`,
            TimeType: 1, // 课间模式
            DefaultClassId: subjectId,
          });
        }
        LastStartSecond = `2025-01-01T${cls.start_time}`;
        LastEndSecond = `2025-01-01T${cls.end_time}`;
        timeLayout.Layouts.push({
          StartSecond: LastStartSecond,
          EndSecond: LastEndSecond,
          TimeType: 0, // 上课模式
          DefaultClassId: subjectId,
        });
        classPlan.Classes.push({
          SubjectId: subjectId,
        });
      });

      outputJson.TimeLayouts[timeLayoutId] = timeLayout;
      outputJson.ClassPlans[classPlanId] = classPlan;
    });
    return outputJson;
  } catch (error) {
    alert(error);
  }
}
