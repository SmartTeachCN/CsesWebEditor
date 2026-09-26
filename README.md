# CSES课程表编辑器

![image](https://github.com/user-attachments/assets/3a6e75e9-c2c6-488b-bb8b-8a17317b61d4)

一个基于Web的课程表编辑器，支持CSES（Course Schedule Exchange Schema）格式的课程表创建、管理和导出。

## 功能特性

- 📅 可视化课程表编辑
- 📚 科目信息管理（名称/简称/教师/教室）
- 🔄 拖拽排序课程时段
- 📥 导入/导出YAML格式配置文件
- 🗓️ 支持单双周不同安排
- 🖥️ 浅色主题界面
- 📋 快捷键操作支持

## 快速开始

1. 直接使用浏览器打开`csesEditor.html`
2. 通过左侧导航切换功能：
   - **课程计划**：管理每周课程安排
   - **科目管理**：维护科目详细信息
   - **源码编辑**：直接编辑YAML配置

3. 常用操作：
   - 点击"+添加课程"创建新计划
   - 拖拽课程卡调整顺序
   - 右键点击项目可删除

## 技术栈

- [Sortable.js](https://sortablejs.github.io/Sortable/) - 拖拽排序功能
- [js-yaml](https://github.com/nodeca/js-yaml) - YAML解析/序列化
- [Bootstrap Icons](https://icons.getbootstrap.com/) - 界面图标
- [FluentUI](https://learn.microsoft.com/en-us/fluent-ui/web-components/) - FluentUI版本界面
- 原生JavaScript实现核心逻辑

## 数据格式说明

课程表数据使用 CSES（Course Schedule Exchange Schema）格式，支持 **v1** 与 **v2** 两个版本。
导出格式（实例类型）只有四个选项，CSES 的 JSON / YAML 已合并为两个版本，**本地导出与导入统一使用 YAML**：

| 导出格式 | 本地文件 | 说明 |
|---|---|---|
| `CSES v1` | `cses-v1.yaml` | v1 文档（`enable_day` 整数、`weeks`、`room`） |
| `CSES v2` | `cses-v2.yaml` | v2 文档（`enable_day` 数组、`location`、`configuration`） |
| `ClassIsland课表档案` | `classisland.json` | ClassIsland Profile JSON |
| `ExamSchedule` | `exam_config.json` | ExamSchedule 配置 JSON |

导入时会自动识别文件类型与版本：ClassIsland 档案 → ClassIsland 格式，含 `examInfos`/`examName` → ExamSchedule，
其余能识别为 CSES 的文件（JSON 或 YAML）会读取其 `version` 字段并**自动把导出格式切到对应的 CSES v1 / v2**；
历史遗留的 `标准YAML` / `cj`（隐藏的 CSES JSON）取值会自动迁移到 `CSES v1` / `CSES v2`。

时间字段统一为 `HH:MM:SS`（符合 CSES 规范 `([01]\d|2[0-3]):([0-5]\d):([0-5]\d)`）：
编辑器内部、导入解析、导出、时间表模板都会自动补齐秒位（`8:00` → `08:00:00`）。

### CSES v1 示例

```yaml
version: 1
subjects:
  - name: 数学
    simplified_name: 数
    teacher: 张老师
    room: "101"
schedules:
  - name: Odd_Monday
    enable_day: 1
    weeks: odd
    classes:
      - subject: 数学
        start_time: "08:00:00"
        end_time: "08:45:00"
```

### CSES v2 示例

```yaml
version: 2
configuration:
  name: 2026年下学期
  description: 2026年下学期的课程表
  cycle:
    work_count: 5
    rest_count: 2
    spans:
      - activity: work
        count: 5
      - activity: rest
        count: 2
subjects:
  - name: 数学
    simplified_name: 数
    teacher: 李梅
    location: A101
schedules:
  - name: 周一课表
    enable_day: [1, 7]
    classes:
      - subject: 数学
        start_time: "08:00:00"
        end_time: "08:40:00"
```

v1 与 v2 的主要差异（编辑器会自动换算）：

| 项目 | CSES v1 | CSES v2 |
|------|---------|---------|
| 课程地点 | `subjects[].room` | `subjects[].location` |
| 启用日 | `schedules[].enable_day`（1-7 整数） | `schedules[].enable_day`（整数数组，可多日） |
| 单双周 | `schedules[].weeks`（all/odd/even） | 不支持 |
| 文档配置 | 无 | `configuration`（名称/描述/周期 cycle） |

切换 v2 后，原先为单双周的课表仍然可以在编辑器中保留设置，但导出 v2 时该字段会被忽略，格式检查会给出提示。

## CSES v2 配置（「配置」页面）

CSES v2 的 `configuration`（名称 / 描述 / 周期 cycle / spans）直接在左侧功能栏的 **「配置」页面**里编辑，
不需要单独的页面：

- 配置项由 [control/settings-cy.json](control/settings-cy.json) 描述，`CSES v1` / `CSES v2` 都读取它；
  标了 `requiresVersion: 2` 的项只在 CSES v2 下显示，切到 v1 会自动隐藏；
- 卡片里的「导出格式 / CSES 版本」选择器可直接切换 `CSES v1（YAML）` / `CSES v2（YAML）` /
  `ClassIsland课表档案` / `ExamSchedule`，切换后页面即时重绘；
- 周期支持增删「时间跨度」（`work` / `rest` + 数量），也可以一键「按总数生成一段工作+一段休息」；
  只改工作日 / 休息日数而 spans 为空时会自动补全，保证导出的 `configuration.cycle` 合法；
- 「配置」页面在本地（未登录）模式下同样可用，因此离线编辑 CSES 文档时也能改 v2 配置；
- 所有改动都会立即写回浏览器本地存储，并由顶部「保存到云 / 导出文件」带走。

## 格式检查器

导出格式为 CSES v1 / v2 时，右侧编辑区底部会出现「格式检查」下栏（`档案管理 / 文件预览 / 实例管理 / 子用户面板`）；
切到 ClassIsland 或 ExamSchedule 格式时该下栏自动隐藏（这两种格式有自己的结构）。

- 状态一目了然：绿色对勾＝无问题，黄色三角＝有警告，红色图标＝有错误；出现错误时自动展开；
- 问题按条目列出错误 / 警告，点击右侧按钮可直接跳到出问题的**课表**、**科目**或**CSES 配置**（即「配置」页面）；
- 以浏览器本地存储的最新内容为准，导入 / 编辑 / 切换实例后自动刷新，也可手动重新检查。

## 开发与构建

```bash
npm install          # 安装构建与测试依赖
npm run build        # dev/** 下的 HTML/PHP 合并打包到根目录
npm test             # CSES 转换 / 导入导出 / 官方 Schema / DOM / 格式检查器 / 配置页 测试
npm run dev          # 本地开发服务器（含热重载）
```

## 快捷键列表

| 快捷键            | 功能说明               |
|-------------------|----------------------|
| Ctrl + ↑/↓        | 切换资源管理器项目     |
| Alt + ↑/↓         | 切换功能模块          |
| Alt + N           | 新建项目              |
| Delete            | 删除选中项目          |

## 子用户（实例组级）

实例组主人可以在「实例管理 → 实例信息 → 子用户」里创建子用户，把实例的编辑权限下放给其他人。

- **归属**：子用户属于**实例组**（而不是单个实例），数据保存在 `user/<实例组标识>/_subusers.json`。
- **认证**：子用户使用「实例组标识 + 子用户名 + 密钥」，密钥经 `password_hash` 存储；同一实例组内用户名唯一。
- **授权**：每个子用户有独立的「可管理实例」范围（`allowed`，`*` 表示组内全部实例）。主人可在管理对话框里逐实例勾选。
- **面板**：子用户在 `/subuser.php?dir=<实例组标识>` 登录后，会列出**可管理的实例**（无需再次输入实例ID），
  选中实例即可使用与主面板相同的 **配置 / 档案 / 文件** 区块，保存时直接写回该实例。
- **安全**：认证参数一律 POST 提交，不进 URL；子用户凭据只保存在该标签页的 `sessionStorage`；
  针对暴力枚举有失败次数锁定（10 分钟内 8 次失败后锁定 10 分钟）。

接口一览（`function.php`，实现见 `function/subuser.php`）：

| 接口 | 方法 | 说明 |
|------|------|------|
| `addSubUser` / `delSubUser` / `setSubAllowed` / `getSubUsers` / `getSubSecret` | POST/GET | 主人侧，需要登录态 |
| `subList` | POST | 子用户认证，返回可管理实例列表 |
| `subLoad` | POST | 读取某个实例的配置（纯文本） |
| `subSave` | POST | 写回某个实例的配置 |

升级说明：旧的按实例子用户文件 `<实例ID>_subusers.json` 会在首次读取时自动合并进
`_subusers.json`（`allowed` 取并集）并删除，无需手工迁移。

## 许可证

MIT License © 2025 CSES-org

## 注意事项

- 所有数据自动保存至浏览器本地存储
- 导出文件建议使用.yaml扩展名
- 推荐使用Chrome/Firefox等现代浏览器

欢迎提交Issue或PR！🚀
