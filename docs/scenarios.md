# 使用场景

## 场景一:全新期次,一条龙到冻结

最顺的路:建期次 → 投料 → 一条龙。

```bash
specprot iteration create -n 期次-2026-Q3 -p web,backend -g "上线会议室预订"
# 把讨论记录、截图、Word 扔进 期次-2026-Q3/00-素材/{端}/
specprot run -i 期次-2026-Q3 -m auto
```

AI 接力段(analyze/slice/deepen)会输出 `[SPECPROT_PROMPT]`,宿主 AI 按块内指引成文,写入后流水线继续。冻结后复制 `04-交付/` 进 SpecCore 的 `010-requirements/`,产品侧收工。

## 场景二:多端项目,各端结构不同

产品按端投模板,先建模板区,再跑流水线:

```
期次-2026-Q3/00-素材/_templates/
├── web/REQUIREMENT.md      ← web 端专属模板
└── backend/REQUIREMENT.md  ← backend 端专属模板
```

analyze 时 web 端按 web 模板成文,backend 按 backend 模板成文;没投模板的端自动用系统七段骨架。模板只需章节标题 + 一句话说明。

## 场景三:写完一段,随手体检

不跑流水线也能自查:

```bash
specprot check -s "用户预订会议室,大概每天几十次"
```

立刻看到:缺哪几段、口语化词、该配什么图、有没有踩风险透镜。改完再检,直到"🎉 通过"。

## 场景四:方案拿不准,先分叉对比

某单元有两条实现路径,先不拍板:

```bash
specprot schemes -i 期次-2026-Q3 -p web -f 预订
```

产出多案对比 + 推荐圈选。冻结时推荐案进快照正文,其余进备选附录——决策留痕,又不污染正文。

## 场景五:风险单元,深度裁决

check 命中「资金业务透镜」后,对该单元跑深度裁决:

```bash
specprot deepen -i 期次-2026-Q3 -p backend -f 支付 --phase review
```

RISK 三列裁决(风险/缓解/裁决)逐一落地。裁决未清时,冻结闸口会拦住——这是刻意设计,防止带病冻结。

## 场景六:需求变更,冻结时自动回流

期次内改了已冻结的正典需求,只需标记变更:

```bash
specprot req change -r REQ-001 -i 期次-2026-Q4 -d "预订增加改期功能"
```

冻结本期次时,REQ-001 自动版本演进 v1.0 → v1.1,状态锁定——历史版本不丢,演进留痕。

## 场景七:跑到一半断了

断点续跑,不从头再来:

```bash
specprot run -i 期次-2026-Q3 --resume
```

从上次未完成阶段继续;已完成阶段不重跑。

## 场景八:不想记命令,全程说人话

```bash
specprot ask "初始化项目"
specprot ask "创建期次 Q4,涉及 web 和 backend"
specprot ask "新建需求 会议室改期"
specprot ask "把 REQ-001 标记为 评审通过"
specprot ask "冻结期次 2026-Q3"
```

置信度不够时,它会列出候选并点名缺什么参数——照着补一句即可。
