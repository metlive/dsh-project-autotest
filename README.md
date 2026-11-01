# dsh-project-autotest

DSH 插件：左侧栏「自动化测试」**工作台**。按工作区切换被测项目，用自动化测试的七步流程沉淀测试项目，并把用例导出成 XMind 思维导图 / TestLink XML / CSV / Markdown。

## 功能

| 能力 | 说明 |
|---|---|
| 切换项目 | 侧栏每个会话行悬停出现「测试」按钮（`sidebar.workspaces.session.row.action`），点击即切到工作台并定位该项目；工作台头部还有工作区下拉，随时换项目 |
| 四阶段流程 | **① 产品文档 / 技术方案 → ② 设计测试用例 → ③ 编写并执行脚本（模型自动） → ④ 跟踪测试 Bug**。每个阶段都标了谁来做：`👤 人工` / `🤖 模型自动` / `🤖 → 👤 模型执行 · 人工评审`；人工阶段列出「这里需要你做什么」的逐条清单，模型阶段明确「你不需要写脚本」，只列出模型会做的五件事 |
| 需求文档输入 | 第 ① 阶段可直接拖入 / 选择产品需求文档与技术方案（.md/.txt/.json/.yaml/.csv/.html），存在工作区 `docs/autotest/inputs/` 下随项目进版本库；可列出、可删除，文件名会清洗成单段路径，无法越出工作区 |
| 用例设计 | 正向 / 反向两个分桶（正向优先实现，反向靠分析筛选）；每条用例含设计方法、前置条件、多步骤、预期结果、执行结论、备注 |
| 缺陷跟踪 | 缺陷状态机：待处理 → 处理中 → 已解决 → 回归中 → 已关闭，可关联到具体用例 |
| 导入 | **XMind 思维导图**（本插件导出的图，或手画的 `阶段 → 用例 → 前置/步骤/预期` 图，含 DEFLATE 压缩的真实 `.xmind`）、**Markdown** 评审页、**CSV** 表格、裸 `content.json`。先由 Host 解析出**预览**（源码格式、条数、正反向、每条的步骤数、被丢弃/降级的提示），再由人选择「追加」或「替换」，确认前不写任何文件 |
| 导出 | **XMind**（真实 `.xmind`：ZIP + `content.json`，层级为 七步 → 正/反向 → 用例 → 前置/步骤/预期/方法/结论）、**TestLink XML**（导入格式，带 stage/case_kind 自定义字段）、**CSV**（带 BOM，Excel 直接打开）、**Markdown**（评审页） |
| 自诊断 | Host 启动时打印 `[dsh-project-autotest] LOADED (build …)` 横幅、路由就绪打印 `READY`；页面挂载时用 `version`/`ping` 路由比对前后端构建号，**页面比 Host 新**或 **Host 未加载插件**都会在页头直接提示「请彻底退出并重开」——不再表现为一句看不出原因的空 400 |
| 持久化 | 存在**工作区自己目录下**的 `docs/autotest/`：`project.json`（机器文档）+ `report.md`（结论报告，每次保存自动重生成）。跟代码一起进版本库、可在 PR 里评审，重装 Harness 也不丢；写入走临时文件 + rename 原子替换；未编辑前不写任何文件 |
| 安全 | Host 路由只接受本地页面（loopback Host / 同源 Origin），跨站请求一律 403；页面提交的文档在 Host 侧重新校验，非法字段回落默认值 |

## 结构

```
dsh-project-autotest/
├── package.json            # dsh.bundle.patch + dsh.client（platform: web）
├── cordis.patch.yml        # 插入一条插件行
├── icon.svg                # 插件图标（原创）
├── locale/{zh,en}.json     # 插件管理页标题/描述
├── src/
│   ├── wire.ts             # 数据模型、校验、路由前缀（Host/Client 共用）
│   ├── zip.ts              # 无依赖 ZIP 写入（STORED + CRC32）+ base64
│   ├── unzip.ts            # 无依赖 ZIP 读取（STORED + DEFLATE，浏览器可用）
│   ├── importers.ts        # XMind / Markdown / CSV / content.json → 用例（Host 与页面共用）
│   ├── export.ts           # XMind / TestLink / CSV / Markdown 渲染
│   ├── index.ts            # Host 半端：workspaces / project / save / export 路由 + 工作区内存档
│   ├── report.ts           # 结论报告 report.md 的生成器（中英双语）
│   └── client/
│       ├── index.tsx       # 注册：侧栏行、主面板、会话行按钮 + 命令总线
│       ├── Workbench.tsx   # 工作台（工作区选择、七步、用例编辑、缺陷、导出菜单）
│       ├── StepRail.tsx    # 七步导航轨
│       ├── ImportPanel.tsx # 导入面板：选文件 / 拖放 → 预览 → 追加或替换
│       ├── api.ts          # Client→Host 的 RPC 与下载
│       ├── content.ts      # 七步流程说明文案（zh / en）
│       ├── figures.tsx     # 七张内联 SVG 图解 + 流水线
│       ├── FlowIcon.tsx    # 图标
│       ├── locales.ts      # 界面文案字典
│       └── styles.ts       # 样式（只用 --dsw-alias-* 令牌，全部带兜底值，dpat- 前缀）
├── scripts/build.mjs       # 构建 lib/index.js 与 lib/client.js
└── test/
    ├── host.test.mjs       # Host 路由 / 存储 / 报告 / 导出（含 unzip 校验 XMind）
    ├── render.test.mjs     # 真实 React + 真实 SlotCore 渲染
    └── dom.test.mjs        # jsdom 里真实点击：切工作区、编辑用例、保存、导出
```

## 开发

```bash
npm run build        # 生成 lib/index.js 与 lib/client.js
npm run check        # node --check 两个产物
npm run test         # 三套测试：host → render → dom
npm run verify       # build → check → test
```

测试依赖 `react@18`、`react-dom@18`、`@deepseek-ai/dsh-client-ui-slots`、`jsdom`，通过 `DSH_TEST_DEPS`（默认指向同级 checkout）解析——插件本身零依赖。

## 测试覆盖（117 项）

- **Host（28）**：落在 `<工作区>/docs/autotest/`、报告随保存重生成且中英双语、未知工作区被拒（路径即存储位置，不再接受任意 id）、请求体读取不依赖 `for await`（Node 已移除 `IncomingMessage` 的异步迭代，依赖它会让 webserver 兜底成空 400）、派发规则与前后端前缀一致、跨站/非本机 403、工作区列表、未保存项目只读、按工作区隔离、文档归一化（脏数据回落）、路径注入、CSV/TestLink/Markdown/XMind 内容与中英标签、`.xmind` 用 `unzip -t` 全量 CRC 校验；以及 **Cordis 上下文兼容（本次线上空 400 的回归守卫）**：`trustedHosts` 缺失时围栏退化为仅本机而不再抛出、路由整体兜底为 JSON 信封、`dispose(reload)` 参数转发后路由真正从 webserver 注销；以及 **导入**：本插件导出的 XMind 原样导回（正反向、步骤、前置、预期不串位，执行结论不会被当成步骤）、Markdown/CSV 解析、手画并 DEFLATE 压缩的 XMind、坏文件给 400 而不是 500；以及 **旧数据迁移**（七阶段文档折叠为四阶段、状态取最靠前、备注合并、用例不丢）与 **需求文档**（路径穿越被清洗、落在工作区 inputs/、可列可删）
- **渲染（9）**：两个座位 + 会话行按钮进真实 SlotCore、服务端渲染不抛错（回归守卫）、中英字典键/占位符对齐、主题令牌兜底、样式前缀
- **DOM（80）**：真实点击——阶段状态与备注落盘、增删改用例、改步骤/结论落盘、缺陷状态流转、切换工作区换项目、导出菜单请求正确的格式、会话行按钮定位工作区；以及新增的 **覆盖率目标编辑与钳制、自动化粒度选择、脚本自检双勾选、"产品缺陷→一键转 Bug"、失败归因持久化、回归结果与需求偏离标记**；以及 **导入全流程**：打开面板、选文件、预览条数与提示、追加/替换两种落盘结果、识别格式与 base64 传输、被拒绝的文件只报错不改数据、取消关闭；以及 **四阶段与新标记**：第①阶段文档区上传/列表/删除、三个阶段的「人工/模型自动/模型执行·人工评审」标识、模型阶段不要求人工动作、缺陷阶段为评审型
