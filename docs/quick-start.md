# 快速开始 · 需求定稿工坊

## 1. 安装

```bash
npm install       # 安装依赖
npm run build     # 编译到 dist/
node dist/cli.js --help   # 确认可用
```

## 2. 初始化项目(仅首次)

```bash
specprot init
```

初始化两件事:项目内 `.speccore/GLOBAL/` 全局需求层(所有需求的单一事实源),以及向宿主 AI 注入 Slash Commands。

## 3. 创建期次

```bash
specprot iteration create -n 期次-2026-Q3 -p "web=网页端,backend=后端服务" -m "web=admin-web,backend=booking-service" -g "上线会议室预订"
```

一条命令建出**加工车间**:素材区(按端归类 + shared + converted)、各端需求文档骨架、功能单元目录、产品模板区、交付区。

> **端名自定**:端名英文为佳,`=` 后附中文标签即可;与 SpecCore 工程标识不一致时用 `-m` 建映射,freeze 时随交付镜像输出 `PLATFORM_MAP.yaml`,SpecCore 拿到的永远是工程标识。

## 4. 投料

把素材扔进 `期次-2026-Q3/00-素材/{端}/`:

- `web/` ← 前端相关的讨论记录、截图、参考文档
- `backend/` ← 后端相关的材料
- `shared/` ← 跨端通用的(业务规则、全局字段、数据模型)

支持 `.md` `.docx` `.pdf` `.xlsx`、截图、录音。转换由流水线代劳,扔进去就行。

## 5. 跑流水线

```bash
# 人机交互模式(推荐首次使用)
specprot run -i 期次-2026-Q3 -m interactive

# 全自动模式(关键闸口仍停)
specprot run -i 期次-2026-Q3 -m auto

# 断点续跑(中断后)
specprot run -i 期次-2026-Q3 --resume

# 只跑某一段
specprot run -i 期次-2026-Q3 --from analyze --to slice
```

## 6. 随时体检

写完一段、一个单元,或整期次,按下体检仪:

```bash
specprot check -s "用户支付订单,金额从余额扣除"     # 片段
specprot check -i 期次-2026-Q3 -p web -u 预订       # 单元
specprot check -i 期次-2026-Q3 -p web               # 端级整篇
specprot check -i 期次-2026-Q3                      # 期次全量
```

## 7. 冻结交接

流水线跑完六段自动冻结,`04-交付/` 成形:

```bash
# 或手动冻结(风险未裁决时会拦闸)
specprot iteration freeze -n 期次-2026-Q3
```

把 `04-交付/` **整目录复制**到 SpecCore 迭代目录的 `010-requirements/`,产品侧从此无事:

```
04-交付/
├── sources/        → 需求快照(SpecCore unitize 的输入)
├── converted/      → 转换产物(doc2spec 可跳过)
└── assets/         → 原型 HTML + 图源 + 截图
```

## 8. 自然语言快捷方式

不想记命令?直接说:

```bash
specprot ask "创建期次 Q3,目标上线会议室预订"
specprot ask "把 REQ-001 标记为 已通过"
specprot ask "列出所有期次"
```

听懂就办;参数缺失时点名追问(`[SPECPROT_NEEDS_INFO]`)。

## 下一步

- 命令细节 → [命令参考](command-reference.md)
- 典型场景 → [使用场景](scenarios.md)
- 架构 → [架构设计](architecture.md)
