# 架构设计

## 分层架构

SpecProt 分三层,各司其职:

```
┌─────────────────────────────────────────┐
│ 命令层   ask / run / 六段命令 / 管理命令    │  ← 入口与编排
├─────────────────────────────────────────┤
│ 核心层   global-layer(全局需求层)          │  ← 单一事实源
│          workspace-manager(期次车间)      │
│          intent-recognition(意图识别)     │
├─────────────────────────────────────────┤
│ 引擎层   素材转换 / 原型渲染 / 图资产        │  ← 确定性产出
└─────────────────────────────────────────┘
```

- **命令层**:薄壳,解析参数后调用核心层;AI 接力段的 prompt 组装在此完成
- **核心层**:全局需求层(所有需求的单一事实源)+ 期次车间(素材/需求/单元/交付)
- **引擎层**:纯函数式确定性产出,不碰语义

## 数据流

```
素材(00-素材/{端})
   │ convert        ← CLI 确定性
   ▼
转换产物(converted/{端}/)
   │ analyze        ← AI 接力 [SPECPROT_PROMPT]
   ▼
端级需求({端}/REQUIREMENT.md 七段)
   │ slice          ← AI 接力
   ▼
功能单元(features/{单元}/REQUIREMENT.md)
   │ deepen         ← AI 接力(OUTLINE + 评审包)
   ▼
深化单元(OUTLINE.md / RISK.md / CLARIFY.md)
   │ req adopt      ← CLI 确定性(血缘建立)
   ▼
全局正典需求(GLOBAL/{项目}/REQ-NNN.md)
   │ iteration freeze ← CLI 确定性(门禁 + 版本演进)
   ▼
交付镜像(04-交付/ → SpecCore 010-requirements/)
```

## 流水线状态机

`run` 维护六段状态,每段三种状态:待跑 / 完成 / 失败:

```
convert ──► analyze ──► slice ──► deepen ──► adopt ──► freeze
   │           │          │         │         │        │
   └── 六闸口:范围 / 素材空 / 空骨架 / 待确认 / 风险 / 收养确认
```

- 每段完成即落盘状态,`--resume` 从第一个未完成段继续
- 闸口判定是幂等的:重复跑不重复问
- 六闸口无论 auto/interactive 都会停;interactive 额外每段停下

## AI 接力协议

CLI 管确定性,AI 管语义,衔接靠四个标记:

| 标记 | 方向 | 含义 |
| :--- | :--- | :--- |
| `[SPECPROT_PROMPT]` | CLI → AI | 接力提示块,内含指引与落盘路径 |
| `[SPECPROT_STEP_DONE]` | CLI → 人 | 步骤完成,新会话继续 |
| `[SPECPROT_NEXT_STEP]` | CLI → 人 | 下一步指令与续跑命令 |
| `[SPECPROT_NEEDS_INFO]` | CLI → 人 | 参数缺失,点名缺什么 |

AI 成文后写回约定路径,CLI 校验结构(占位符消失 + 长度达标)后放行下一段。

## 目录结构

```
项目根/
├── .speccore/GLOBAL/            ← 全局需求层(单一事实源)
│   ├── INDEX.md                 ← 全量需求索引表
│   ├── RISK_LENSES/             ← 风险透镜库(七种子)
│   └── {项目}/REQ-NNN.md        ← 正典需求(带版本号)
│
└── 期次-XXX/                    ← 期次车间
    ├── 00-素材/{端}/            ← 投料区
    │   ├── converted/{端}/      ← [自动] 转换产物
    │   └── _templates/          ← [可选] 产品模板
    ├── {端}/
    │   ├── REQUIREMENT.md       ← 端级需求(七段)
    │   └── features/{单元}/     ← 功能单元
    │       ├── REQUIREMENT.md
    │       └── assets/          ← 图源/原型/ASSETS.yaml
    ├── _shared/                 ← 跨端共享契约
    └── 04-交付/                 ← 冻结产出(镜像)
```

## 与 SpecCore / SpecTest 的咬合

SpecProt 不是孤岛,是三道闸的第一道:

| 环节 | 数据边界 | 交接动作 |
| :--- | :--- | :--- |
| SpecProt | 需求层(010-requirements 前身) | `freeze` 产出 04-交付/ 镜像 |
| SpecCore | 规格层(020-specs)+ 任务层 | `unitize` 消费镜像 sources/ |
| SpecTest | 测试层(.spectest) | `gate` 验证;规格缺陷流回 SpecProt |

咬合原则:**派生关系,不是平行账本**。SpecProt 的产出是 SpecCore 的输入,不是两份各写各的数据。交付镜像与 SpecCore 的 010-requirements/ 同构,正是为了"复制即交接"。

## 风险透镜库

`check` 初筛与 `deepen` 裁决共用七个业内标准透镜,落盘 `.speccore/GLOBAL/RISK_LENSES/`:

| 透镜 | 依据 | 关注点 |
| :--- | :--- | :--- |
| 资金业务 | 央行支付条例 / PCI-DSS | 支付、金额、退款、对账 |
| 金融合规 | FATF 反洗钱 | 牌照、监管、审计 |
| 隐私合规 | PIPL / GDPR | 个人信息、授权、跨境 |
| 无障碍 | WCAG 2.1 AA | 读屏、对比度、键盘可达 |
| 内容合规 | 网信办 UGC 规范 | 审核、举报、下架 |
| 并发防护 | Stripe 幂等实践 | 幂等、超卖、重试 |
| 状态机完备 | 状态机最佳实践 | 非法流转、孤儿状态 |
