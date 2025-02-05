# CSES课程表编辑器
FluentUI版本:
![image](https://github.com/user-attachments/assets/1cb389a6-4004-4c04-9dbf-0c9aafc888a3)

经典版本:
![image](https://github.com/user-attachments/assets/e836c27b-3243-4bb7-bc10-dbfea6285fe8)

一个基于Web的课程表编辑器，支持CSES（Course Schedule Exchange Schema）格式的课程表创建、管理和导出。

## 功能特性

- 📅 可视化课程表编辑
- 📚 科目信息管理（名称/简称/教师/教室）
- 🔄 拖拽排序课程时段
- 📥 导入/导出YAML格式配置文件
- 🗓️ 支持单双周不同安排
- 🖥️ 暗色主题界面
- 📋 快捷键操作支持

## 快速开始

1. 直接使用浏览器打开`index.html`
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
- 原生JavaScript实现核心逻辑

## 数据格式说明

课程表数据使用YAML格式存储，示例结构：

```yaml
version: 1
subjects:
  - name: 数学
    simple: 数
    teacher: 张老师
    room: 101
schedules:
  - name: odd_mon
    classes:
      - subject: 数学
        start_time: "08:00"
        end_time: "08:45"
```

## 快捷键列表

| 快捷键            | 功能说明               |
|-------------------|----------------------|
| Ctrl + ↑/↓        | 切换资源管理器项目     |
| Alt + ↑/↓         | 切换功能模块          |
| Alt + N           | 新建项目              |
| Delete            | 删除选中项目          |

## 许可证

MIT License © 2024 CSES-org

## 注意事项

- 所有数据自动保存至浏览器本地存储
- 导出文件建议使用.yaml扩展名
- 推荐使用Chrome/Firefox等现代浏览器

欢迎提交Issue或PR！🚀
