/**
 * 风险透镜规则库 — risk-lenses（v0.3.1）
 *
 * 风险分析不靠 AI 临场发挥，而靠「透镜规则库」：按业内标准固化检查项，
 * deepen 时按关键词匹配注入 prompt，产品逐条裁决。
 *
 * 三层透镜：
 *   - compliance-*  合规/政策（金融监管、隐私、无障碍、内容安全）
 *   - business-*    业务实现（资金安全、状态机、并发时序）
 *   - technical-*   技术实现（预留，交 SpecCore 阶段）
 *
 * 规则库位于 .speccore/GLOBAL/RISK_LENSES/*.md，首次使用时自动落盘种子模板，
 * 产品可自行扩充（新增 .md 文件即生效，无需改代码）。
 *
 * 规则项格式：
 *   ## {规则项标题}
 *   - 关键词: 支付, 代收, 扣款   （逗号分隔，单元内容命中任一即触发）
 *   - 检查: 是否接入持牌机构？
 *   - 处置: 资金不经平台账户
 */

import { pathExists, ensureDir, writeFile, readFile, readdir } from 'fs-extra';
import { join } from 'path';
import { getSpeccoreDir } from './workspace-manager';

export interface RiskItem {
  title: string;
  keywords: string[];
  check: string;
  action: string;
}

export interface RiskLens {
  id: string; // 文件名（去 .md）
  name: string; // 透镜名（文件首个 # 标题）
  items: RiskItem[];
}

/** 种子模板：业内标准来源（央行条例 / FATF / PIPL / GDPR / WCAG / PCI-DSS / 幂等键实践等） */
const SEED_LENSES: Record<string, string> = {
  'compliance-finance.md': `# 金融政策合规

> 来源: 中国人民银行《非银行支付机构条例》、FATF 反洗钱 40 项建议、《数据出境安全评估办法》、央行金融营销行为规范

## 支付资质
- 关键词: 支付, 收款, 代收, 代付, 充值, 提现, 钱包, 结算
- 检查: 涉及资金收付是否具备《支付业务许可证》，或已接入持牌机构（银行/第三方支付）？
- 处置: 资金直接由持牌机构清算，平台不触碰资金流；无牌照不得自建资金池

## 反洗钱 AML
- 关键词: 支付, 提现, 转账, 充值, 交易, 账户
- 检查: 是否满足 KYC 实名核验、大额交易上报（单笔 5 万 / 当日 20 万）、可疑交易监测？
- 处置: 实名认证 + 限额管理 + 可疑交易风控模型，保留交易记录不少于 5 年

## 数据出境
- 关键词: 境外, 海外, 跨境, 国际, 出口, 离岸
- 检查: 个人信息/重要数据是否出境？是否完成安全评估或签署标准合同（SCC）？
- 处置: 数据本地化存储；确需出境的完成安全评估或标准合同备案

## 资金存管
- 关键词: 押金, 保证金, 预付, 预付费, 储值, 会员卡
- 检查: 预收资金是否与自有资金隔离（存管银行）？预付卡是否合规备案？
- 处置: 接入银行存管账户，预收资金专户管理

## 金融营销
- 关键词: 收益, 利率, 理财, 投资, 保本, 回报
- 检查: 宣传是否承诺保本保收益？是否误导性描述风险？
- 处置: 禁止保本保收益承诺，显著提示风险，营销内容合规审查
`,
  'compliance-privacy.md': `# 隐私合规

> 来源: 《个人信息保护法》（PIPL）、GDPR、CCPA

## 最小必要
- 关键词: 注册, 手机号, 身份证, 人脸, 实名, 收集, 授权
- 检查: 收集的个人信息是否满足最小必要原则？是否与功能无关的过度收集？
- 处置: 非必要不收集；逐项标注收集目的与法律依据

## 单独同意
- 关键词: 人脸, 指纹, 位置, 健康, 金融账户, 行踪, 生物识别
- 检查: 敏感个人信息（人脸/金融账户/行踪等）是否取得单独同意？
- 处置: 敏感信息单独弹窗同意，不得打包授权

## 告知义务
- 关键词: 隐私政策, 协议, 授权
- 检查: 是否在收集前告知处理目的、方式、范围？隐私政策是否可达且易懂？
- 处置: 首次启动显著展示隐私政策，重大变更重新征得同意

## 数据主体权利
- 关键词: 注销, 删除, 导出, 撤回
- 检查: 是否支持账户注销、个人信息删除、撤回授权、数据导出？
- 处置: 提供在线注销入口，注销后按法规期限删除数据

## 未成年人
- 关键词: 未成年人, 儿童, 青少年, 防沉迷
- 检查: 是否采集未成年人信息？是否获得监护人同意？是否落实防沉迷？
- 处置: 14 岁以下需监护人同意；实名认证区分未成年
`,
  'compliance-accessibility.md': `# 无障碍与适老化

> 来源: WCAG 2.1 AA、《互联网应用适老化及无障碍改造专项行动方案》

## 对比度与视觉
- 关键词: 颜色, 主题, 样式, 视觉
- 检查: 正文对比度是否 ≥ 4.5:1（大字 3:1）？是否不依赖颜色传递信息？
- 处置: 设计系统内置对比度校验，色弱模式可选

## 键盘可达
- 关键词: 表单, 弹窗, 列表, 操作
- 检查: 全部交互是否键盘可达（Tab 顺序合理、焦点可见）？
- 处置: 焦点管理纳入交互评审清单

## 读屏支持
- 关键词: 图片, 图标, 按钮
- 检查: 图标按钮/图片是否有替代文本？语义标签是否完整？
- 处置: 必填 alt/aria 标签，纳入前端规范
`,
  'compliance-content.md': `# 内容安全

> 来源: 《网络信息内容生态治理规定》、未成年人保护相关规定

## 内容审核
- 关键词: 评论, 发布, 上传, 内容, 社区, 动态, 聊天
- 检查: UGC 是否具备审核机制（先审后发或机器+人工）？是否支持举报处置？
- 处置: 敏感词过滤 + 人工复审队列 + 举报响应机制

## 实名与追溯
- 关键词: 发布, 评论, 上传
- 检查: 信息发布是否要求实名（前台自愿后台实名）？是否可追溯发布者？
- 处置: 后台实名，日志留存满足追溯要求
`,
  'business-money.md': `# 资金安全

> 来源: PCI-DSS、支付幂等键实践（Stripe Idempotency-Key）、银行对账惯例

## 金额精度
- 关键词: 金额, 价格, 费用, 折扣, 优惠, 结算, 退款
- 检查: 金额是否用整数分存储（禁止浮点）？币种是否遵循 ISO 4217？汇率精度是否约定？
- 处置: 金额一律整数分；多币种明确定价币种与汇率精度

## 幂等防重
- 关键词: 支付, 下单, 扣款, 退款, 提交
- 检查: 支付/下单/退款接口是否幂等（防重复扣款/重复退款）？
- 处置: 幂等键机制（同键同结果），重复请求返回首次结果

## 对账
- 关键词: 支付, 结算, 账, 流水, 对账
- 检查: 是否具备日切/T+1 对账机制？不平账是否告警？
- 处置: 与支付渠道定时对账，差异自动告警人工介入

## 退款安全
- 关键词: 退款, 退货, 退费
- 检查: 退款是否原路退回？部分退款如何控制？退款状态机是否闭合？
- 处置: 原路退回 + 退款金额不超过实付 + 状态机含终态
`,
  'business-state.md': `# 状态机完整性

> 来源: UML 状态机完整性检查清单

## 状态完备
- 关键词: 状态, 流转, 审核, 订单, 工单, 流程
- 检查: 是否枚举了全部业务状态？每个状态是否定义了合法迁移路径？是否有终态？
- 处置: 状态机图 + 迁移矩阵，终态不可再迁移，非法迁移拦截

## 异常路径
- 关键词: 取消, 超时, 失败, 异常, 过期
- 检查: 取消/超时/失败等异常路径是否纳入状态机？是否可恢复到合法状态？
- 处置: 异常路径显式建模，定时任务兜底（如超时自动取消）
`,
  'business-concurrency.md': `# 并发与时序

> 来源: 乐观锁/幂等消费实践、分布式一致性惯例

## 超卖防护
- 关键词: 库存, 秒杀, 抢购, 名额, 限量
- 检查: 扣减库存是否有并发保护（乐观锁/原子操作）？是否防超卖？
- 处置: 库存扣减用原子操作（DB 行锁/Redis 原子），超卖自动拦截

## 重复提交
- 关键词: 提交, 下单, 预约, 报名, 抢购
- 检查: 用户连点/网络重试是否产生重复数据？
- 处置: 前端防抖 + 后端幂等/唯一约束双保险

## 消息一致性
- 关键词: 消息, 通知, 回调, 异步, 同步
- 检查: 异步链路（消息/回调）是否幂等消费？失败是否可重试？
- 处置: 消费端幂等 + 重试队列 + 死信兜底，最终一致性取舍显式声明
`,
};

export function getRiskLensesDir(): string {
  return join(getSpeccoreDir(), 'GLOBAL', 'RISK_LENSES');
}

/** 首次使用时落盘种子模板（幂等：已有文件不覆盖，产品可自行修改） */
export async function ensureSeedLenses(): Promise<void> {
  const dir = getRiskLensesDir();
  await ensureDir(dir);
  for (const [file, content] of Object.entries(SEED_LENSES)) {
    const p = join(dir, file);
    if (!(await pathExists(p))) {
      await writeFile(p, content, 'utf-8');
    }
  }
}

/** 解析透镜文件：## 标题分段，提取 关键词/检查/处置 */
export function parseLens(content: string): RiskItem[] {
  const items: RiskItem[] = [];
  const sections = content.split(/^## /m).slice(1);
  for (const sec of sections) {
    const lines = sec.split('\n');
    const title = (lines[0] || '').trim();
    const item: RiskItem = { title, keywords: [], check: '', action: '' };
    for (const line of lines) {
      const kw = line.match(/^- 关键词:\s*(.+)$/);
      const ck = line.match(/^- 检查:\s*(.+)$/);
      const ac = line.match(/^- 处置:\s*(.+)$/);
      if (kw) item.keywords = kw[1].split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      if (ck) item.check = ck[1].trim();
      if (ac) item.action = ac[1].trim();
    }
    if (item.title && item.check) items.push(item);
  }
  return items;
}

/** 加载全部透镜 */
export async function loadRiskLenses(): Promise<RiskLens[]> {
  await ensureSeedLenses();
  const dir = getRiskLensesDir();
  const lenses: RiskLens[] = [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
  for (const f of files) {
    const content = await readFile(join(dir, f), 'utf-8');
    const nameMatch = content.match(/^# (.+)$/m);
    lenses.push({
      id: f.replace(/\.md$/, ''),
      name: nameMatch ? nameMatch[1].trim() : f,
      items: parseLens(content),
    });
  }
  return lenses;
}

/** 按关键词匹配：单元内容命中透镜规则项关键词即返回命中清单 */
export async function matchRisks(unitContent: string): Promise<Array<{ lens: string; item: RiskItem }>> {
  const lenses = await loadRiskLenses();
  const hits: Array<{ lens: string; item: RiskItem }> = [];
  for (const lens of lenses) {
    for (const item of lens.items) {
      if (item.keywords.some((kw) => unitContent.includes(kw))) {
        hits.push({ lens: lens.name, item });
      }
    }
  }
  return hits;
}
