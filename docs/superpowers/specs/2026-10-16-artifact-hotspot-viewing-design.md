# 文物 3D 热点讲解设计

**状态：待用户评审**

## 目标

在现有三星堆数字博物馆中，为文物模型提供可点击的结构热点。热点跟随 GLB 的模型旋转和缩放；悬停时显示名称，点击后显示有来源依据的讲解并平滑观察对应位置；退出观察时回到默认视角。

## 约束

- 保持当前三栏页面布局及文物列表、模型加载、旋转/缩放、切换和右侧详情功能。
- 只扩展现有的文物 `MuseumViewer`，不触碰另一个用于细胞/通用模型工作台的 `CellViewer`。
- 不给没有热点配置的文物显示热点或报错。
- 热点资料必须有已核实的来源；不为不可见结构推测坐标或历史解释。
- 热点层沿用当前深色 UI 的金色强调色和边框样式。

## 当前架构发现

- `references/src/viewer/MuseumViewer.jsx` 为文物创建一个 R3F `Canvas`，场景中只有一套 Drei `OrbitControls`，并由现有 `CameraTransition` 在相机位置和控制器 target 之间做指数平滑插值。
- `references/src/viewer/GlbArtifactModel.jsx` 克隆 GLB 场景，计算包围盒中心和最长边，将模型移到中心并以 `3.25 / longestAxis` 适配显示；外层 group 应用文物 `modelRotation` 和 `modelScale`。
- 页面展示容器为 `viewer-stage`，已有 CSS overlay 和底部控制。新的讲解卡片放在这个容器内，不改变网格布局。
- 现有依赖已包括 React Three Fiber、Drei、Three.js；无需添加依赖。

## 数据格式

新增单一热点 JSON：`references/src/data/artifact-hotspots.json`。最外层以现有稳定文物 ID 为键，每个 ID 对应一个热点数组。热点字段：

- `id`: 文物内稳定热点 ID。
- `name`: 简短热点标题。
- `description`: 只陈述来源明确支持的可见结构/事实。
- `position`: 三个有限数值，单位为导入 GLB 的原始局部坐标。
- `cameraOffset`: 三个有限数值，表示从热点锚点出发的局部相机偏移。
- `sourceUrl`: 支持该条讲解的权威来源。
- `verified`: 必须为 `true` 才可呈现。

初始示例选择 `local-qingtongshenshu`，配置 3 个位置：底座、三层枝与神鸟、树侧铜龙。讲解限定为三星堆博物馆公开藏品资料中的结构描述；不呈现对“建木”“若木”等学术观点的定论。来源：[三星堆博物馆藏品页面](https://www.sxd.cn/relics/)。

热点 JSON 是独立的展示配置，前端按当前 `artifact.id` 取记录。缺少键时返回空数组。无效记录不能破坏模型正常显示；在开发或测试校验中应报告无效热点数据。

## 坐标与渲染

`position` 和 `cameraOffset` 使用 GLB 原始局部坐标。`GeneratedGlbModel` 已把克隆模型平移 `-center`；热点锚点容器也平移 `-center`，热点本身仍用原始局部坐标。这样锚点和模型共用同一层 `fitScale × modelScale × modelRotation`，并继承外层的 `modelPosition`。不在 JSON 内存储屏幕坐标或因模型旋转而变化的坐标。

热点由 Drei `Html` 绑定在实际三维位置。每个可交互锚点使用按钮语义，鼠标悬停/键盘聚焦可见标题，点击停止事件冒泡并选择热点。热点位置与讲解内容分别测试；首件文物的坐标必须结合实际模型视图校准。

## 相机与交互

- 继续复用唯一的 `OrbitControls` 和 `CameraTransition`；不创建第二个控制器。
- 点击热点时，通过锚点的 world matrix 获取焦点 world position；将配置中的局部 `cameraOffset` 同样通过模型变换转换为相机 world position。
- 使用现有指数插值动画同时过渡相机位置和 OrbitControls target。过渡期间暂停自动旋转，避免它与目标动画竞争；过渡结束后可继续手动旋转/缩放。
- 选择状态在展示容器上显示暗色讲解卡片，含热点名称、来源链接和退出按钮。关闭卡片或点击“退出”会平滑回到文物默认 `cameraPosition` 和原点 target，并清除选择状态。
- 切换文物或触发原有重置视角时，清除热点选择并回到默认视角。
- 无热点文物不出现空卡片、空标记或控制状态变化。

## 校验与验收

- 单元测试覆盖热点 JSON 按 ID 读取、空配置、字段/坐标/source/verified 校验，以及坐标在模型中心偏移、旋转和缩放后的世界位置。
- 组件或交互测试覆盖悬停标题、点击显示讲解、camera target 切换、退出回默认视角、切换文物清空选择、无热点时原有 Viewer 仍渲染。
- 以商青铜神树配置 3 个来源可核实的热点，并在浏览器中检查热点附着模型旋转、相机动画起止和退出恢复。
- 运行项目测试、lint 和生产构建；不改变现有文物和模型配置。

## 范围外

- 不改三栏布局，不重做右侧文物详情。
- 不添加热点编辑器、管理后台或其他文物的讲解数据。
- 不自动生成事实、热点坐标或新模型资源。
