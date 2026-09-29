/**
 * 单元深度完善命令 — deepen（v0.3.1）
 *
 * 功能单元从「粗胚」（slice 产出）到「定稿」的加工主战场，两阶段：
 *   阶段 1 outline — 结构契约（章节树/图清单/风险检查点/分叉预判），必停确认
 *   阶段 2 review  — 评审包（深化 REQUIREMENT + RISK 裁决表 + CLARIFY 增量 + REBOUND 回流）
 *
 * 圈改循环：产品在文档里用两种标注反馈，重跑 review 时 AI 只动被标注处，
 * 未标注章节原样保留（已确认内容永不被重写）：
 *   ~~旧内容~~              → 删除/替换
 *   （圈改：新要求说明）     → 按新要求修改该处
 *
 * REBOUND 回流：确认的新术语/跨单元规则，追加到 _shared/GLOSSARY.md / RULES.md。
 *
 * CLI 管确定性（骨架预建、风险命中匹配、结构校验），AI 管语义（填充文档）。
 */

import { readFile, writeFile, pathExists, ensureDir, readdir } from 'fs-extra';
import { join } from 'path';
import {
  getWorkspaceDir,
  getPlatformFeaturesDir,
  getSharedDir,
  Platform,
  PLATFORM_LABELS,
} from '../core/workspace-manager';
import { matchRisks } from '../core/risk-lenses';

export interface DeepenOptions {
  iteration: string;
  platform: string;
  feature?: string; // 单元名；缺省 = 该端全部单元
  phase?: string; // outline | review | all（默认 all）
  yes?: boolean;
}

export async function deepenCommand(options: DeepenOptions): Promise<void> {
  if (!options.iteration || !options.platform) {
    console.error('❌ 期次名与端名是必需的。');
    console.error('   示例: specprot deepen -i 期次-XXX -p web -f 预订功能');
    return;
  }

  const platform = options.platform as Platform;
  const label = PLATFORM_LABELS[platform] || platform;
  const iterDir = getWorkspaceDir(options.iteration);

  if (!(await pathExists(iterDir))) {
    console.error(`❌ 期次不存在: ${options.iteration}`);
    return;
  }

  const featuresDir = getPlatformFeaturesDir(options.iteration, platform);

  // 确定目标单元清单
  let features: string[] = [];
  if (options.feature) {
    features = [options.feature];
  } else if (await pathExists(featuresDir)) {
    features = (await readdir(featuresDir))
      .filter((f) => f !== 'INDEX.md' && !f.startsWith('.'))
      .sort();
  }
  if (features.length === 0) {
    console.error(`❌ 未找到功能单元。请先切分: specprot slice -i "${options.iteration}" -p ${platform}`);
    return;
  }

  console.log(`🔬 单元深度完善: ${options.iteration} / ${label} / ${features.join(', ')}\n`);

  for (const feature of features) {
    await deepenOne(options.iteration, platform, label, feature, options.phase || 'all');
  }
}

/** 单单元两阶段 */
async function deepenOne(
  iterationName: string,
  platform: Platform,
  label: string,
  feature: string,
  phase: string
): Promise<void> {
  const unitDir = join(getPlatformFeaturesDir(iterationName, platform), feature);
  const reqPath = join(unitDir, 'REQUIREMENT.md');
  if (!(await pathExists(reqPath))) {
    console.error(`  ❌ 单元不存在: ${platform}/features/${feature}`);
    return;
  }
  const reqContent = await readFile(reqPath, 'utf-8');
  if (reqContent.includes('_待批量生成_')) {
    console.error(`  ❌ 单元需求仍是空骨架（含「待批量生成」占位符），先完成切分接力。`);
    return;
  }

  if (phase === 'outline' || phase === 'all') {
    await ensureDir(unitDir);
    const outlinePath = join(unitDir, 'OUTLINE.md');
    if (!(await pathExists(outlinePath))) {
      await writeFile(outlinePath, outlineSkeleton(feature, label), 'utf-8');
      const prompt = await buildOutlinePrompt(iterationName, platform, label, feature, reqContent, outlinePath);
      console.log(`  ▶ ${feature} — 阶段 1 结构契约`);
      console.log('[SPECPROT_PROMPT]');
      console.log(prompt);
      console.log('[SPECPROT_PROMPT_END]');
      console.log(`📌 宿主 AI 指令: 按 prompt 覆盖写入 ${join(iterationName, platform, 'features', feature, 'OUTLINE.md')}`);
      console.log('[SPECPROT_STEP_DONE]');
      console.log(`[SPECPROT_NEXT_STEP] 结构契约确认后: specprot deepen -i "${iterationName}" -p ${platform} -f ${feature} --phase review`);
      return;
    }
    // OUTLINE 已存在 → 校验四段齐全
    const outlineContent = await readFile(outlinePath, 'utf-8');
    const missing = checkOutlineSections(outlineContent);
    if (missing.length > 0) {
      console.error(`  ⚠️ ${feature}/OUTLINE.md 结构契约不完整，缺: ${missing.join(', ')}`);
      console.error(`     请补齐后重跑，或删除 OUTLINE.md 重新生成。`);
      return;
    }
    console.log(`  ✔ ${feature} — 结构契约已就绪`);
    if (phase === 'outline') return;
  }

  if (phase === 'review' || phase === 'all') {
    const outlinePath = join(unitDir, 'OUTLINE.md');
    const outlineContent = (await pathExists(outlinePath)) ? await readFile(outlinePath, 'utf-8') : '';
    const prompt = await buildReviewPrompt(iterationName, platform, label, feature, reqContent, outlineContent, unitDir);
    console.log(`  ▶ ${feature} — 阶段 2 评审包`);
    console.log('[SPECPROT_PROMPT]');
    console.log(prompt);
    console.log('[SPECPROT_PROMPT_END]');
    console.log(`📌 宿主 AI 指令:`);
    console.log(`   1. 按 prompt 深化 ${join(iterationName, platform, 'features', feature, 'REQUIREMENT.md')}（圈改标注处增量修订）`);
    console.log(`   2. 写风险裁决表 ${join(iterationName, platform, 'features', feature, 'RISK.md')}`);
    console.log(`   3. 追加待确认到 ${join(iterationName, platform, 'features', feature, 'CLARIFY.md')}（增量，勿删旧行）`);
    console.log(`   4. 若有分叉预判，写 ${join(iterationName, platform, 'features', feature, 'SCHEMES.md')}`);
    console.log(`   5. REBOUND: 新术语/跨单元规则追加到 ${join(iterationName, '_shared', 'GLOSSARY.md')} 与 RULES.md`);
    console.log('[SPECPROT_STEP_DONE]');
    console.log(`[SPECPROT_NEXT_STEP] 评审包落盘后: specprot check -i "${iterationName}" -p ${platform} -f ${feature}（或产品圈改后重跑本命令）`);
    return;
  }
}

/** OUTLINE 四段校验（结构契约完整才可进入 review） */
export function checkOutlineSections(content: string): string[] {
  const required = ['章节树', '图清单', '风险检查点', '分叉预判'];
  return required.filter((sec) => !content.includes(`## ${sec}`));
}

function outlineSkeleton(feature: string, label: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `# ${feature} — 结构契约

> 所属端: ${label}
> 创建时间: ${today}
> 状态: 📝 草稿
> 契约说明: 本文件是单元深化（deepen）的地基，四段齐全后方可进入评审包阶段。

## 章节树

| 章节 | 主旨（一句话） | 交付物 |
| :--- | :--- | :--- |
| _待填充_ | - | 文字 |

## 图清单

| 图 ID | 图名 | 类型 | 一句话说明 |
| :--- | :--- | :--- | :--- |
| fig-01 | _待填充_ | 流程图/状态机/线框 | - |

## 风险检查点

| 风险点 | 透镜 | 一句话说明 |
| :--- | :--- | :--- |
| _待填充_ | 合规/业务 | - |

## 分叉预判

| 分叉点 | 维度（工时/交互/风格） | 候选方向 |
| :--- | :--- | :--- |
| _无则写「无」_ | - | - |
`;
}

async function buildOutlinePrompt(
  iterationName: string,
  platform: Platform,
  label: string,
  feature: string,
  reqContent: string,
  outlinePath: string
): Promise<string> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const hits = await matchRisks(reqContent);

  let p = `# ${iterationName} — ${label}/${feature} 结构契约生成\n\n`;
  p += `> 时间: ${now}\n> 目标: 为功能单元生成深化地基（四段契约），供产品确认后再逐章成文\n\n`;

  p += `## 目标位置\n\n\`${outlinePath}\`（覆盖写入，保留模板表头）\n\n`;

  p += `## 四段契约要求\n\n`;
  p += `1. **章节树**: 按业务逻辑分章（概述/场景/功能点/规则/验收等），每章一句话主旨 + 交付物类型（文字/图/表/原型页）。章节树就是最终 REQUIREMENT.md 的目录。\n`;
  p += `2. **图清单**: 列出全部要画的图。类型: 业务流程图 / 状态机图 / 数据流图 / 页面线框。图 ID 用 fig-01 递增，每张图一句话说清画什么——图是最没有歧义的表达，宁可多列。\n`;
  p += `3. **风险检查点**: 结合下方「风险透镜命中项」+ 单元自身业务，列出要检查的风险点（政策合规/资金/状态机/并发等）。\n`;
  p += `4. **分叉预判**: 预判可能的多方案点，维度 = 开发工时 / 交互方式 / 视觉风格。没有就写「无」，不硬凑。\n\n`;

  if (hits.length > 0) {
    p += `## 风险透镜命中项（必须覆盖进「风险检查点」）\n\n`;
    for (const h of hits) {
      p += `- [${h.lens}] ${h.item.title}: ${h.item.check}\n`;
    }
    p += `\n`;
  } else {
    p += `## 风险透镜\n\n未命中规则库，结合业务自行判断风险点（如状态机/并发/边界）。\n\n`;
  }

  p += `## 单元需求全文\n\n\`\`\`markdown\n${reqContent}\n\`\`\`\n`;
  return p;
}

async function buildReviewPrompt(
  iterationName: string,
  platform: Platform,
  label: string,
  feature: string,
  reqContent: string,
  outlineContent: string,
  unitDir: string
): Promise<string> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const hits = await matchRisks(reqContent + '\n' + outlineContent);
  const glossaryPath = join(getSharedDir(iterationName), 'GLOSSARY.md');
  const rulesPath = join(getSharedDir(iterationName), 'RULES.md');
  const glossary = (await pathExists(glossaryPath)) ? await readFile(glossaryPath, 'utf-8') : '（尚无，本次确认的新术语请创建）';
  const rules = (await pathExists(rulesPath)) ? await readFile(rulesPath, 'utf-8') : '（尚无，本次确认的跨单元规则请创建）';

  let p = `# ${iterationName} — ${label}/${feature} 评审包生成\n\n`;
  p += `> 时间: ${now}\n> 目标: 按结构契约逐章深化需求，产出可评审、可裁决、可交接的定稿\n\n`;

  p += `## 圈改循环规则（最重要）\n\n`;
  p += `1. 产品已确认的内容**不得重写**。只有两种标注触发修订:\n`;
  p += `   - \`~~旧内容~~\` 删除线 → 删除或替换该处\n`;
  p += `   - \`（圈改：新要求）\` → 按括号内要求修改该处\n`;
  p += `2. 无标注的章节原样保留，一字不改。\n`;
  p += `3. 深化 = 把粗胚扩充为定稿: 每个功能点补边界条件、异常路径、验收标准（格式 \`AC-NN: [前置] → [操作] → [预期]\`）。\n\n`;

  p += `## 交付物清单（全部写入 ${platform}/features/${feature}/）\n\n`;
  p += `1. \`REQUIREMENT.md\` — 按 OUTLINE 章节树逐章深化（覆盖写入）\n`;
  p += `2. \`RISK.md\` — 风险裁决表（三列: 风险描述/透镜/影响/建议处置/裁决），裁决一律初始化为「待裁决」。风险来源 = 下方命中项 + OUTLINE 风险检查点\n`;
  p += `3. \`CLARIFY.md\` — 待确认清单（增量: 保留旧行，新问题追加行，已决问题改状态为「已决」）\n`;
  p += `4. \`SCHEMES.md\` — 仅当 OUTLINE 分叉预判非「无」时创建（方案段 + 对比矩阵）\n\n`;

  p += `## REBOUND 回流\n\n`;
  p += `本次确认的**新术语**追加到 \`${glossaryPath}\`；**跨单元业务规则**追加到 \`${rulesPath}\`。只追加不覆盖，供其它单元引用。\n\n`;

  p += `## 风险透镜命中项（写入 RISK.md 裁决表）\n\n`;
  if (hits.length > 0) {
    for (const h of hits) {
      p += `- [${h.lens}] ${h.item.title}: ${h.item.check} → 建议处置: ${h.item.action}\n`;
    }
  } else {
    p += `- （未命中规则库，按 OUTLINE 风险检查点自行裁决）\n`;
  }
  p += `\n`;

  p += `## 共享语境\n\n`;
  p += `### 术语表（${glossaryPath}）\n\n\`\`\`markdown\n${glossary}\n\`\`\`\n\n`;
  p += `### 共享规则（${rulesPath}）\n\n\`\`\`markdown\n${rules}\n\`\`\`\n\n`;

  p += `## 结构契约\n\n\`\`\`markdown\n${outlineContent}\n\`\`\`\n\n`;

  p += `## 单元需求（粗胚）\n\n\`\`\`markdown\n${reqContent}\n\`\`\`\n`;
  return p;
}
