# SpecProt — 需求定稿工坊

SpecProt 是 SpecCore 生态的**第一道闸**：把散乱的素材（讨论记录、截图、Word/PDF）锤炼成冻结定稿的需求文档，再以整目录镜像交接给 SpecCore 进入开发。

```
SpecProt(需求定稿) → SpecCore(规格开发) → SpecTest(测试验证)
     freeze              unitize              gate
```

产品在这里只做三件事：**建期次、投素材、跑流水线**。剩下的提炼、成文、切分、深化、图资产、风险裁决，交给流水线和 AI 接力完成。

> 📖 产品同学请看：[产品操作指南](docs/product-guide.md) — 零基础操作指南，每步都告诉你「怎么做、在哪做、会有什么结果」。

## 快速上手（产品三步走）

```bash
# 1. 建期次 — 加工车间就绪（素材区 + 各端需求骨架）
specprot iteration create -n 期次-2026-Q3 -p web,backend

# 2. 投料 — 把素材扔进 00-素材/{端}/（跨端通用放 shared/）
#    支持 .md / .docx / .pdf / .xlsx / 截图 / 录音

# 3. 一条龙 — 六段流水线跑到冻结（人机交互模式）
specprot run -i 期次-2026-Q3 -m interactive
```

或者连命令都懒得记——`specprot ask "创建期次 Q3，目标上线会议室预订"`，说人话就办。

## 六段流水线

`run` 编排六个阶段，每段产出沉淀，闸口停等确认：

| 段 | 命令 | 产出 | 执行者 |
| :--- | :--- | :--- | :--- |
| ① 转换 | `convert` | 素材 → md（图片建索引、录音提示转写） | CLI |
| ② 端级分析 | `analyze` | `{端}/REQUIREMENT.md` 完整需求文档 | AI 接力 |
| ③ 功能切分 | `slice` | `{端}/features/{单元}/` 功能单元 | AI 接力 |
| ④ 单元深化 | `deepen` | OUTLINE 结构契约 + 评审包（风险裁决/澄清） | AI 接力 |
| ⑤ 正典收养 | `req adopt` | 单元需求升格为全局正典需求 | CLI |
| ⑥ 冻结 | `iteration freeze` | `04-交付/` 交付镜像 + 正典版本演进 | CLI |

**双模式**：`-m auto` 节点间不等待（六闸口仍停）；`-m interactive` 每段停下确认。中断后 `--resume` 断点续跑，`--from`/`--to` 截取区间。

**六闸口**（无论哪种模式都会停）：范围确认、素材为空、空骨架拦截、待确认未清、风险未裁决、收养确认。

**参考上下文** — `analyze` / `slice` 成文时自动注入既有沉淀（存在才注入，摘要而非全文，同端优先）：

| 来源 | 内容 |
| :--- | :--- |
| 正典历史需求 | `.speccore/GLOBAL/{项目}/` 中同端既有 REQ 摘要（最多 5 条，不重复、不冲突） |
| 期次共享契约 | `_shared/GLOSSARY.md` 术语表 + `RULES.md` 跨单元规则 |
| 设计系统 | 期次根 `DESIGN_SYSTEM.yaml`（无则取全局层 `.speccore/GLOBAL/DESIGN_SYSTEM.yaml`） |

AI 写需求因此「有前例可循」：新单元与历史重复或冲突时标注「待确认」，不擅自合并。

## 命令总览

| 命令 | 职责 |
| :--- | :--- |
| `ask [话...]` | 自然语言入口 — 识别意图直接执行（与 SpecCore ask 对齐） |
| `run` | 产品流水线 — 六段一条龙编排 |
| `convert` | 素材转换 — docx/pdf/xlsx → md，图片建索引 |
| `analyze` | 端级分析 — 从端素材提炼完整需求文档 |
| `slice` | 功能切分 — 端级需求切为功能单元 |
| `deepen` | 单元深化 — 结构契约 + 评审包（风险裁决） |
| `assets` | 资产生成 — Mermaid 图 + 原型 HTML + 注册表 |
| `schemes` | 方案分叉 — 多案对比 + 推荐圈选 |
| `check` | 五维体检 — 骨架/质量/图建议/风险初筛/增量对照 |
| `iteration` | 期次管理 — create / list / freeze |
| `req` | 需求管理 — new / adopt / change / link / status |
| `prototype` | 从需求文档直出 HTML 原型 |
| `design` | 提取/配置设计系统（antd / element / tailwind…） |
| `init` | 初始化项目 — 全局层 + Slash Commands |

`ask` 是执行引擎而非指路牌：听懂就办。参数缺失时输出 `[SPECPROT_NEEDS_INFO]` 点名缺什么，宿主 AI 一见便知该追问。

## check — 随时按下的体检仪

写完一段、一个单元、甚至整个期次，随时体检，五维全面评估：

```
🩺 需求体检报告 — 期次-体检/web/features/预订/REQUIREMENT.md
① 骨架完整性   ⚠️ 缺少段落: 页面/接口、业务规则、验收标准
② 质量六维     ⚠️ 口语化"大概" / 无验收标准 / 无边界
③ 图资产建议   💡 建议生成: 业务流程图、页面线框图
④ 风险初筛     ⚠️ 命中「资金业务透镜」: 支付、金额 → 指向 deepen
⑤ 增量对照     ✅ 无冲突、无重复
📊 体检总结: 骨架 ⚠️ · 质量 ⚠️ · 图 2 张 · 风险 ⚠️
```

五级入口，按需取用：

| 写法 | 体检对象 |
| :--- | :--- |
| `check -s "一段需求"` | 刚写的片段 |
| `check -f REQUIREMENT.md` | 任意完整文档 |
| `check -i 期次 -p web -u 预订` | 功能单元文档 |
| `check -i 期次 -p web` | 端级整篇 |
| `check -i 期次` | 期次全量（所有端 + 所有单元，汇总表） |

风险初筛内置七个业内标准透镜（资金业务/金融合规/隐私合规/无障碍/内容合规/并发防护/状态机完备），命中即指向 `deepen` 深度裁决。

## 产品模板 — 模板优先，系统兜底

产品可以按端给需求文档模板，有模板用模板，没有同名模板用系统默认：

```
{期次}/00-素材/_templates/
├── web/REQUIREMENT.md          ← 仅 web 端生效（端专属）
├── web/UNIT_REQUIREMENT.md     ← web 端功能单元模板
├── web/CLARIFY.md              ← web 端待确认清单模板
└── REQUIREMENT.md              ← 所有端共用（根级兜底）
```

匹配优先级：**端专属 > 根级共用 > 系统默认**。模板只需给出章节结构（标题 + 一句话说明），AI 按结构成文。系统强制结构（OUTLINE 四段契约、RISK 三列裁决）不开放覆盖，防止破坏深化门禁。

## 期次目录结构

```
期次-XXX/
├── 00-素材/{端}/               ← 投料区（讨论记录、截图、参考文档）
│   ├── converted/{端}/         ← [自动] docx/pdf 转换产物
│   └── _templates/             ← [可选] 产品自定模板
├── {端}/
│   ├── REQUIREMENT.md          ← 端级需求文档（analyze 成文）
│   └── features/{单元}/        ← 功能单元（slice 切分）
│       ├── REQUIREMENT.md
│       └── assets/             ← 图源 .mmd + 原型 HTML + ASSETS.yaml
├── _shared/                    ← 跨端共享契约
│   └── PLATFORM_MAP.yaml      ← [可选] 端名 → SpecCore 工程标识映射
└── 04-交付/                    ← 冻结产出（整目录复制即交接）
```

**端名规范** — 端名产品自控，英文为佳（如 `web` / `admin-web` / `booking-service`，可与 SpecCore 工程标识一致，也可不同）；中文标签用 `=` 附带：

```bash
specprot iteration create -n 期次-2026-Q4 -p "web=网页端,h5-mobile=移动端,booking-service" \
  -m "web=admin-web,booking-service=booking-service"
```

`-m` 建映射桥，freeze 时随交付镜像输出 `PLATFORM_MAP.yaml`——SpecCore 拿到的永远是工程标识。

## 交付与交接 — 冻结即镜像

`freeze` 时流水线自动收尾三件事：

1. **变更回流** — 有变更的需求正典版本自动演进 vX.Y → vX.(Y+1)，状态锁定 🔒
2. **交付镜像** — `04-交付/` 成形，与 SpecCore 的 `010-requirements/` 同构：
   - `sources/` → 需求快照（SpecCore unitize 的输入）
   - `converted/` → 转换产物（doc2spec 可跳过）
   - `assets/{prototypes,designs,screenshots}/` → 原型 HTML、图源、截图
3. **交接动作** — 把 `04-交付/` 整目录复制进 SpecCore 迭代的 `010-requirements/`，外链不丢，产品侧从此无事

三道闸的完整链：

```
SpecProt  freeze ──► SpecCore  unitize ──► SpecTest  gate
需求定稿 ─────────► 规格生成 ──────────► 测试验证
```

## AI 接力协议

CLI 管确定性（骨架预建、结构校验、闸口判定），AI 管语义（成文、切分、深化）。关键标记：

| 标记 | 含义 |
| :--- | :--- |
| `[SPECPROT_PROMPT]` | AI 接力提示块 — 宿主 AI 按块内指引成文 |
| `[SPECPROT_STEP_DONE]` | 当前步骤完成，新会话继续 |
| `[SPECPROT_NEXT_STEP]` | 下一步指令与续跑命令 |
| `[SPECPROT_NEEDS_INFO]` | 参数缺失，点名缺什么、给补全示例 |

## 安装

```bash
npm install          # 安装依赖
npm run build        # 编译到 dist/
node dist/cli.js --help   # 查看命令
```

## 文档导航

| 文档 | 内容 |
| :--- | :--- |
| [产品操作指南](docs/product-guide.md) | **产品同学从这里开始** — 零基础操作指南（怎么做/在哪做/会有什么结果） |
| [快速开始](docs/quick-start.md) | 安装与第一个期次全流程 |
| [命令参考](docs/command-reference.md) | 22 个命令的完整参考 |
| [使用场景](docs/scenarios.md) | 典型使用场景 |
| [架构设计](docs/architecture.md) | 分层架构与数据流 |
| [速查手册](docs/quick-reference.md) | 命令参数矩阵 · 枚举 · 标记速查 |

> 英文版见 [英文版 README](README.en.md) 与 docs/*.en.md —— 中英分离，与 SpecCore 文档体系一致。

## 参与贡献

1. Fork 本仓库
2. 新建 Feat_xxx 分支
3. 提交代码
4. 新建 Pull Request
