# 三星堆数字博物馆

个人学习性质的非官方数字展示项目。页面读取 `public/models/` 中的本地 GLB；文物史料仅在可由三星堆博物馆官网核实后填写。AI 辅助三维重建模型仅供数字展示。

## 项目截图

下图展示文物头像和青铜神树在 3D 浏览页面中的运行效果。

<p align="center">
  <img src="public/images/shots/01.png" alt="商戴金面罩青铜人头像 3D 展示界面" width="49%" />
  <img src="public/images/shots/02.png" alt="商青铜神树 3D 展示界面" width="49%" />
</p>

## 启动

```sh
npm install --prefix references
npm run dev
```

构建与数据清单会自动读取项目根目录 `public/models/` 下实际存在的 `.glb` 文件：

```sh
npm run build
npm test
```

文物元数据在 `references/src/data/artifacts.json` 中按稳定 ID 配置，并关联本地 GLB 和缩略图；未知资料留空，界面显示“资料待补充”。模型路径、朝向、位置、比例及相机初始位置可单独设置。


## 新增文物

文物基本信息由 `references/src/data/artifacts.json` 管理，详细介绍按稳定 ID 存在 `references/src/data/content/<id>.md`。新增文物时通常不需要修改页面组件，按下面步骤导入：

1. 把模型放入 `public/models/`，缩略图放入 `public/images/artifacts/`。建议图片与模型使用相同的文件主名，例如 `new-artifact.glb` 和 `new-artifact.png`。
2. 复制 `references/data/artifact-import-template.csv`，例如命名为 `references/data/my-artifacts.csv`。每件文物占一行，填写 `modelFile`、`name`、`sourceUrl`、`category` 和 `thumbnailFile`；其他资料暂时未知时留空。模型名和图片名必须与本地文件名完全一致。CSV 列名不要改动。
3. 在项目根目录运行导入和校验：

   ```bash
   npm --prefix references run artifacts:import -- --input data/my-artifacts.csv
   npm --prefix references run artifacts:validate
   ```

4. 检查 `references/src/data/artifacts.json` 中的新记录，以及导入脚本生成的 `references/src/data/content/<id>.md`。只填写能从三星堆博物馆官网等可靠来源核实的内容；未核实的事实保持空白或“资料待补充”。

导入脚本不会访问来源网页或编写历史资料。它会按 GLB 文件名生成稳定 ID、关联本地模型和缩略图，并为缺少的 Markdown 创建空白模板；重复导入会保留已有的非空资料。模板只是批量导入的起始 CSV，正式资料以 JSON 和 Markdown 为准。每次新增或修改后都运行校验命令，确认缺失资源和资料提醒符合预期。


# 参考来源：

- [3DCellForge](https://github.com/huangserva/3DCellForge)，MIT License；复用其 GLB 加载、包围盒适配、轨道控制和演示渲染基础。
- [三星堆博物馆官网](https://www.sxd.cn/)，文物资料以馆方公开页面为准。
