# 命令参考 · 需求定稿工坊

本页收录 SpecProt 全部 22 个命令。约定:`-i` 期次名即目录名本身(建期次时传什么,之后就用什么)。

## 1. 智能入口

### ask

自然语言执行引擎——识别意图直接执行,与 SpecCore ask 对齐。

```bash
specprot ask [话...]
```

行为分层:置信度 ≥70 直接执行;45~69 列候选并点名缺什么;更低则给出最接近的命令。参数缺失输出 `[SPECPROT_NEEDS_INFO]`。

```bash
specprot ask "创建期次 Q3"
specprot ask "新建需求 会议室预订"
specprot ask "把 REQ-001 标记为 评审通过"
```

## 2. 流水线

### run(别名 r)

六段流水线编排器。参数齐全:

| 参数 | 说明 | 默认 |
| :--- | :--- | :--- |
| `-i, --iteration` | 期次名称(必填) | — |
| `-p, --platforms` | 端列表,逗号分隔;留空 = 期次配置的平台 | — |
| `--from` | 起始阶段: convert/analyze/slice/deepen/adopt/freeze | convert |
| `--to` | 结束阶段(同上枚举) | freeze |
| `-m, --mode` | auto(节点间不等,闸口停)/ interactive(每段停) | interactive |
| `-y, --yes` | interactive 模式下一键放行 | false |
| `--resume` | 断点续跑 | false |

```bash
specprot run -i 期次-2026-Q3 -m auto
specprot run -i 期次-2026-Q3 --resume
specprot run -i 期次-2026-Q3 --from analyze --to slice
```

## 3. 流水线六段

### convert(别名 cv)

素材转换:docx/pdf/xlsx → md,录音提示转写,图片建索引。

| 参数 | 说明 |
| :--- | :--- |
| `-i, --iteration` | 期次名称(必填) |
| `-p, --platform` | 只转换指定端;留空 = 全部端 + shared |

### analyze(别名 az)

端级分析:从端素材提炼七段完整需求文档(AI 接力)。产出 `{端}/REQUIREMENT.md`。

| 参数 | 说明 |
| :--- | :--- |
| `-i, --iteration` | 期次名称(必填) |
| `-p, --platform` | 目标端(端名产品自定,英文为佳;`web=网页端` 可带中文标签)(必填) |

### slice(别名 sl)

端内功能切分:端级需求切为可独立交付的功能单元(AI 接力 + 素材溯源)。产出 `{端}/features/{单元}/`。

| 参数 | 说明 |
| :--- | :--- |
| `-i, --iteration` | 期次名称(必填) |
| `-p, --platform` | 目标端(必填) |

### deepen

单元深度完善:OUTLINE 结构契约 → 评审包(RISK 裁决 / CLARIFY / REBOUND 回流)。

| 参数 | 说明 | 默认 |
| :--- | :--- | :--- |
| `-i, --iteration` | 期次名称(必填) | — |
| `-p, --platform` | 端名(必填) | — |
| `-f, --feature` | 功能单元名;缺省 = 该端全部单元 | — |
| `--phase` | outline / review / all | all |

### assets

资产生成:Mermaid 图 + 原型 HTML + ASSETS.yaml 资产注册表。

| 参数 | 说明 | 默认 |
| :--- | :--- | :--- |
| `-i, --iteration` | 期次名称(必填) | — |
| `-p, --platform` | 端名(必填) | — |
| `-f, --feature` | 功能单元名(必填) | — |
| `-k, --kind` | diagrams / prototype / all | all |

### schemes

方案分叉:多案对比 + 推荐圈选;冻结时推荐案进快照正文,其余进备选附录。

| 参数 | 说明 |
| :--- | :--- |
| `-i, --iteration` | 期次名称(必填) |
| `-p, --platform` | 端名(必填) |
| `-f, --feature` | 功能单元名(必填) |

## 4. 期次管理(iteration / iter)

### iteration create(别名 cr)

创建期次 = 建加工车间(素材区 + 各端需求骨架 + 单元目录 + 模板区 + 交付区)。

**端名规范**:端名产品自控,英文为佳(如 `web` / `admin-web` / `booking-service`,可与 SpecCore 工程标识一致,也可不同);中文标签用 `=` 附带(`web=网页端`)。与 SpecCore 工程标识不一致时用 `-m` 建映射桥,freeze 时随交付镜像输出 `PLATFORM_MAP.yaml`。

| 参数 | 说明 | 默认 |
| :--- | :--- | :--- |
| `-n, --name` | 期次名称,如`期次-2026-Q3`(必填) | — |
| `-p, --platforms` | 涉及端,逗号分隔(端名自定,`web=网页端` 可带中文标签) | web |
| `-m, --platform-map` | 端名 → SpecCore 工程标识映射(`web=admin-web,booking-service=booking-service`),冻结时随交付镜像走 | — |
| `-g, --goal` | 本期目标 | — |
| `-f, --from` | 开始日期 | — |
| `-t, --to` | 结束日期 | — |

### iteration list(别名 ls)

列出所有期次与关联需求。

### iteration freeze(别名 fz)

冻结期次,禁止修改需求。风险未裁决 / 待确认未决时拦闸。生成 `04-交付/` 交接快照；`-p` 指定时只冻结部分端（快照 / 资产 / 端名映射桥 / 变更回流同步按端过滤，未选中端的变更保持「变更中」不动）。

| 参数 | 说明 | 默认 |
| :--- | :--- | :--- |
| `-n, --name` | 期次名称(必填) | — |
| `-p, --platforms` | 只冻结这些端（逗号分隔，端名产品自定），留空 = 全部端 | — |
| `--force` | 跳过冻结门禁 | false |

## 5. 需求管理(req)

全局需求层 = 所有需求的单一事实源。每个需求有 REQ-NNN 编号、版本号 vX.Y、状态。

### req new(别名 add)

| 参数 | 说明 | 默认 |
| :--- | :--- | :--- |
| `-n, --name` | 需求名称(必填) | — |
| `-d, --desc` | 需求描述 | — |
| `-p, --project` | 所属项目 | default |
| `-i, --iteration` | 关联期次 | — |
| `--platform` | 所属端名(产品自定,如 web;按端导出与转换时归组用) | — |

### req adopt

收养功能单元进正典(迭代层 → 全局层建立血缘)。

| 参数 | 说明 |
| :--- | :--- |
| `-i, --iteration` | 期次名称(必填) |
| `-p, --platform` | 单元所在端(必填) |
| `-f, --feature` | 功能单元目录名(必填) |
| `-pj, --project` | 所属项目,默认 default |

### req change

标记正典需求变更;冻结时自动回流版本演进 vX.Y → vX.(Y+1)。

| 参数 | 说明 |
| :--- | :--- |
| `-r, --req` | 需求 ID,如 REQ-001(必填) |
| `-i, --iteration` | 实施变更的期次(必填) |
| `-d, --desc` | 变更说明 |

### req list(别名 ls)

列出需求,`-i` 按期次筛选。

### req show

查看需求详情。`-r, --req` 需求 ID(必填);`-p, --project` 所属项目(默认 default)。

### req link

关联需求到期次。`-r, --req`(必填)+ `-i, --iteration`(必填)。

### req status

更新需求状态。`-r, --req`(必填)+ `-s, --status`(必填)。

状态枚举:草稿 / 评审中 / 已通过 / 已冻结 / 开发中 / 已交付 / 已废弃 / 暂缓。

## 6. 产品辅助

### check(别名 ck)

需求五维体检(骨架 / 质量 / 图建议 / 风险初筛 / 增量对照),五级入口:

| 参数 | 说明 |
| :--- | :--- |
| `-s, --snippet` | 直接贴需求片段 |
| `-f, --file` | 读取需求文件 |
| `-i, --iteration` | 期次名 |
| `-p, --platform` | 端名(配合 -i;有 -u 定位单元,无 -u 即端级整篇) |
| `-u, --unit` | 功能单元目录名(配合 -i -p) |

```bash
specprot check -s "用户支付订单,金额从余额扣除"
specprot check -i 期次-2026-Q3 -p web -u 预订
specprot check -i 期次-2026-Q3          # 全量汇总
```

### prototype(别名 pt)

从需求文档直出 HTML 原型。两条入口分工：**期次内**用 `-i 期次 -p 端`（读端级 REQUIREMENT.md，产物进 `{端}/assets/prototypes/` 随冻结交付走）；**随手单文档**用 `-f 文档路径`（产物进默认 `prototypes/`）。与 `design` 分工：本命令生成页面，`design` 沉淀风格（原型自动套用 DESIGN_SYSTEM.yaml）。

| 参数 | 说明 |
| :--- | :--- |
| `-i, --iteration` | 期次名;留空 = 全局层 |
| `-f, --file` | 需求文档路径(覆盖默认) |
| `-o, --output` | 输出目录(覆盖默认) |

### design(别名 ds)

提取/配置设计系统,产出 DESIGN_SYSTEM.yaml。与 `prototype` 分工：本命令沉淀**风格**（色彩/字体/组件），`prototype` 生成**页面**（自动套用本命令的产物）。

| 参数 | 说明 |
| :--- | :--- |
| `-s, --scan` | 扫描本地代码工程 |
| `-u, --url` | 线上页面 URL |
| `-c, --cookie` | 浏览器 Cookie |
| `-H, --header` | 额外请求头 |
| `-f, --file` | 本地 HTML/CSS 文件 |
| `-p, --preset` | antd / element / tailwind / material / minimal |
| `--update [file]` | 从 DESIGN_SYSTEM.yaml 重新生成样式指南 |
| `-o, --output` | 输出文件(默认 DESIGN_SYSTEM.yaml) |

### export(别名 exp)

把已导出的需求文档转换为 Word / HTML / PDF。数据源为 `04-交付/sources/` 交 付快照（先 `iteration freeze` 导出，再转格式，两个独立步骤）；`-p` 只转换指定端 （端归属优先取「来源功能单元」，其次「所属端」）。转换引擎为 pandoc；PDF 另需 LibreOffice。

| 参数 | 说明 | 默认 |
| :--- | :--- | :--- |
| `-i, --iteration` | 期次名称（必填） | — |
| `-p, --platforms` | 只转换这些端（逗号分隔），留空 = 已导出的全部端 | — |
| `-f, --format` | 目标格式，逗号分隔： docx / html / pdf | docx |
| `-o, --output` | 输出目录 | `{期次}/exports/` |

输出结构：`exports/{格式}/{端}/{需求}.{ext}`；无端归属的需求归入 `未归属端/`。

### resolve

裁决单元内 RISK.md 的「待裁决」与 CLARIFY.md 的「未决」，清零冻结门禁。不带 `--item` 只列清单；裁决后编号自动重排并即时打印，按新编号连续裁决即可。

| 参数 | 说明 |
| :--- | :--- |
| `-i, --iteration` | 期次名称(必填) |
| `-p, --platform` | 端名(必填) |
| `-f, --feature` | 功能单元名(必填) |
| `--item <n>` | 待裁决项序号(缺省 = 仅列出清单) |
| `--decision <d>` | 裁决: accept / reject |
| `--note <text>` | 裁决理由(写入裁决列) |

### init

初始化项目:全局需求层 + Slash Commands 注入。

## 参数语义速查（同名参数在不同命令下含义不同）

| 参数 | 各命令下的含义 |
| :--- | :--- |
| `-p` | `req new` = 所属项目；`convert / analyze / slice / deepen / assets / schemes / check / prototype` = 单个端名；`run / freeze / export / iteration create` = 端列表；`design` = 预设风格 |
| `-f` | `deepen / assets / schemes` = 功能单元；`prototype / check / design` = 文件路径；`iteration create` = 开始日期；`export` = 目标格式 |

> 按产品自用习惯记忆即可：**-p 多半是「端」**（req new 的 project 与 design 的 preset 是历史例外），**-f 在「围绕单元干活」的命令里是单元名，其余按提示阅读**。
