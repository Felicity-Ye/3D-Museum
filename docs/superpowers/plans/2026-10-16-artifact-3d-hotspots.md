# 文物 3D 热点讲解实施计划

> **执行前提：**用户先评审并确认本计划，再选择 Native 或 Subagent-driven 执行方式。实现按 TDD：每个新 helper/行为先写失败测试，再实现。

**Goal:** 为文物 3D Viewer 增加由独立 JSON 驱动的局部坐标热点、讲解和相机观察，同时保留现有页面和模型交互。

**Architecture:** 新增按 artifact ID 索引的 JSON 和轻量数据 helper。热点渲染在 `GeneratedGlbModel` 的外层变换链中，并共享 GLB 居中偏移。点击将热点局部位置及相机偏移通过模型 world matrix 转成世界坐标，交给现有唯一的 `OrbitControls` 和 `CameraTransition`。讲解 UI 叠加在现有展示区域，不改变布局。

**Tech:** React 19、Vite、React Three Fiber、Drei `Html`/`OrbitControls`、Three.js、Node `node:test`；不增加依赖。

**Spec:** `docs/superpowers/specs/2026-10-16-artifact-hotspot-viewing-design.md`

## 全局约束

- 不改三栏布局和现有 artifact list、GLB load、drag/zoom、switch、details 功能。
- 不触碰 `CellViewer`；热点只用于 `MuseumViewer`。
- 热点坐标始终为 GLB 原始局部坐标；`-center`、auto-fit scale、artifact scale、rotation 和 model position 全部必须作用于模型和热点。
- JSON 中每条讲解均须有三星堆博物馆官方来源，并设置 `verified: true`；禁止由 AI 补写历史解释。
- 无热点数据时返回空列表，原 viewer 正常工作。
- 只有一套 OrbitControls；观察相机复用现有过渡与默认视角重置流程。

## Review Focus

- 热点位置的 center correction 与现有 cloned GLB center 完全相同，且仅应用一次。
- `modelRotation`、fit scale、`modelScale`、`modelPosition` 后，锚点 world position 与模型局部点重合。
- 相机聚焦期间不发生 autoRotate 与相机插值互相争夺；退出返回默认 camera position/target。
- 选择/退出 hotspot 不吞掉或更改原有模型拖动、缩放及 artifact 切换行为。
- missing/malformed/unverified热点数据不造成空配置文物异常，也不呈现未核实文本。

---

### Task 1: 数据配置、校验与坐标变换 helper

**Files:**
- Create: `references/src/data/artifact-hotspots.json`
- Create: `references/src/data/artifactHotspots.js`
- Create: `references/test/artifactHotspots.test.mjs`

**Interfaces:**
- `getArtifactHotspots(artifactId, config)` 返回该文物已验证热点数组；没有 ID 时返回 `[]`。
- `validateArtifactHotspots(config)` 返回可读的验证错误；检查 ID、name、description、有限 Vector3、HTTP(S) source URL、`verified === true`、每件文物内 hotspot ID 唯一。
- `getHotspotWorldPose(modelRoot, center, hotspot)` 返回热点 world `target` 和相机 world `position`。输入点及 cameraOffset 是原始 GLB 局部坐标；通过同一 model root matrix 和 center correction 转换。

- [x] 先写失败测试：ID 查找、缺失 ID、重复 hotspot ID、错误向量/来源/verified、center correction 和组合平移/旋转/缩放后的世界坐标。
- [x] 运行 `node test/artifactHotspots.test.mjs`，确认失败是因为 helper 尚不存在。
- [x] 实现 helper，JSON 初始只包含 `local-qingtongshenshu` 的 3 个热点；来源文字限于官方藏品页明确描述的底座、三层枝/神鸟和树侧铜龙。
- [x] 基于实际 GLB 浏览视图确定并记录三个热点的原始局部坐标和相机偏移，不使用屏幕百分比推断坐标。
- [x] 重跑该测试，确认数据校验、空配置和世界坐标断言通过。

### Task 2: 在模型变换链中渲染热点并聚焦相机

**Files:**
- Create: `references/src/viewer/ArtifactHotspotMarkers.jsx`
- Modify: `references/src/viewer/GlbArtifactModel.jsx`
- Modify: `references/src/viewer/MuseumViewer.jsx`
- Modify: `references/test/artifactHotspots.test.mjs`（如需补充变换边界测试）

- [x] 在 `GlbArtifactModel` 的模型 group 中渲染 marker sibling，marker parent 平移 `-center`，各 marker 使用 JSON 原始 GLB 坐标；按钮悬停/聚焦显示热点名，点击阻止 R3F 事件冒泡。
- [x] 点击时通过 `getHotspotWorldPose` 取得 world-space target/camera position，回传选中热点和观察目标。
- [x] 扩展 `CameraTransition` 支持 focus target/camera destination；使用现有指数插值与 OrbitControls target；聚焦期间暂停 autoRotate 并避免 OrbitControls 输入争夺过渡。
- [x] 热点退出、文物切换、现有 resetVersion 变化时清除 focus，平滑返回默认 cameraPosition 和原点 target。
- [x] 测试 helper 中 Vector3 + Object3D 的 combined transform cases；运行热点 helper 测试与 `npm test`。

### Task 3: 展示讲解卡片与深色 UI 样式

**Files:**
- Modify: `references/src/viewer/MuseumViewer.jsx`
- Create: `references/src/components/ArtifactHotspotCard.jsx`（可访问的标题、说明、来源链接、退出按钮）
- Modify: `references/src/App.css`
- Create or modify: `references/test/visual/artifact-hotspots.spec.js`（若当前 Playwright/WebGL 可运行；否则记录手动浏览器验收）

- [x] 在现有 viewer-stage 内叠加暗色讲解卡片，避免改变三栏 grid；卡片展示热点名、说明、来源链接及“退出”。
- [x] 键盘可聚焦 marker、Enter/Space 可选择，Esc/退出按钮可关闭并恢复视角。
- [x] 空热点数组时不渲染 marker 或卡片；无效热点不阻断模型显示并在开发/数据校验时给出诊断。
- [x] 验证响应式展示区内卡片不会遮挡必要的模型切换/重置控制；沿用当前深色背景、细边框与金色强调。

### Task 4: 运行并检查集成结果

**Files:**
- Verify: `references/src/data/artifact-hotspots.json`
- Verify: `references/src/viewer/MuseumViewer.jsx`
- Verify: `references/src/viewer/GlbArtifactModel.jsx`
- Verify: `references/src/App.css`

- [x] 浏览器确认 3 个标记、讲解卡片/来源、退出聚焦与无热点文物切换正常；通过 Object3D 坐标测试覆盖 GLB 中心校正、模型旋转、缩放及位置变换后的锚点坐标。
- [x] 悬停显示名称、点击出现正确讲解与来源、相机平滑移动到结构视角；手动旋转后退出热点能平滑回默认视角。
- [x] 切换到无热点文物并确认原列表/GLB/旋转/缩放/详情仍正常、无空状态或控制器报错。
- [x] 在 `references` 下运行 `npm test`、`npm run lint`、`npm run build`；保留准确结果。
- [x] 自检最终 diff 和三个 hotspot 的来源，不修改无关业务代码。

## Coverage Check

- JSON ID 关联/空数据/字段及来源核验：Task 1。
- GLB center、scale、rotation、position 坐标一致性：Tasks 1–2。
- hover/click/详情/相机平滑聚焦/退出/文物切换：Tasks 2–3。
- 深色 UI/布局保护/空热点 fallback：Task 3。
- 实际模型旋转、相机动画、现有功能及全项目验证：Task 4。
