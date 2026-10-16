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
npm --prefix references run dev
```

构建与数据清单会自动读取项目根目录 `public/models/` 下实际存在的 `.glb` 文件：

```sh
npm --prefix references run build
npm --prefix references test
npm --prefix references run artifacts:validate
```

文物元数据和介绍统一保存在 `references/src/data/artifacts/<id>.md`，每件文物一个文件。文件以 YAML Front Matter 保存结构化字段，以 Markdown 正文记录介绍。该目录是唯一维护中的文物数据源；运行时直接读取 Markdown，不再维护 `artifacts.json` 或分离的 `data/content/<id>.md`。模型路径、缩略图路径、朝向、位置、比例及相机初始位置沿用文物现有配置。

未知资料应保持空白，并列入 `pendingVerification`；未核实来源时保持 `sourceVerified: false`。`npm --prefix references run artifacts:validate` 会检查 YAML、字段类型、ID、模型清单及图片和模型文件路径。开发启动和生产构建前也会自动校验。缺少资源或字段错误会导致校验失败；待核实来源会作为提示列出。


## 新增文物

每件文物的元数据和详细介绍统一保存在 `references/src/data/artifacts/<id>.md`：YAML Front Matter 保存结构化字段，后续 Markdown 正文保存介绍。新增文物时通常不需要修改页面组件，按下面步骤导入：

1. 把模型放入 `public/models/`，缩略图放入 `public/images/artifacts/`。建议图片与模型使用相同的文件主名，例如 `new-artifact.glb` 和 `new-artifact.png`。
2. 复制 `references/data/artifact-import-template.csv`，例如命名为 `references/data/my-artifacts.csv`。每件文物占一行，填写 `modelFile`、`name`、`sourceUrl`、`category` 和 `thumbnailFile`；其他资料暂时未知时留空。模型名和图片名必须与本地文件名完全一致。CSV 列名不要改动。
3. 在项目根目录运行导入和校验：

   ```bash
   npm --prefix references run artifacts:import -- --input data/my-artifacts.csv
   npm --prefix references run artifacts:validate
   ```

4. 检查 `references/src/data/artifacts/<id>.md`。CSV 导入只创建元数据和空白待补充正文；只填写能从三星堆博物馆官网等可靠来源核实的内容，未核实的史实、尺寸和来源保持空白，并保持 `sourceVerified: false`。

导入脚本不会访问来源网页或编写历史资料。它会按 GLB 文件名生成稳定 ID、关联本地模型和缩略图，并为每件文物创建或更新一个 Markdown 文件；更新时保留已有正文。模板只是批量导入的起始 CSV，正式资料以 Markdown 为准。手动新增时，复制现有文物文件并以新稳定 ID 命名，再填写 Front Matter 和正文。正文补齐后可移除 `contentStatus: pending`。每次新增或修改后都运行校验命令，确认缺失资源和待核实信息符合预期。只有仍保留旧 JSON/分离正文文件的旧版检出才需要运行 `artifacts:migrate`：先预览，再传入 `--write` 写入；目标文件已存在时会跳过，不覆盖人工修改。


参考来源：

- [3DCellForge](https://github.com/huangserva/3DCellForge)，MIT License；复用其 GLB 加载、包围盒适配、轨道控制和演示渲染基础。
- [三星堆博物馆官网](https://www.sxd.cn/)，文物资料以馆方公开页面为准。
