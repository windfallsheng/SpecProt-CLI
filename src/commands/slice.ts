/**
 * 端内功能切分命令 — slice（v0.2.0）
 *
 * 一次素材常含多个功能：端级 REQUIREMENT.md 是总纲，切分后每个功能单元
 * 独立成文（features/{单元}/REQUIREMENT.md），后续检查、原型、评审均按单元操作。
 *
 * CLI 管确定性：预建 features/INDEX.md 骨架、组装切分 prompt（含素材溯源要求）。
 * AI 管语义：识别功能单元、按模板写单元文档、填充索引。
 */

import { readFile, pathExists, ensureDir, writeFile } from 'fs-extra';
import { join } from 'path';
import {
  getWorkspaceDir,
  getPlatformDir,
  getPlatformFeaturesDir,
  collectMaterials,
  resolvePlatformTemplate,
  Platform,
} from '../core/workspace-manager';

export interface SliceOptions {
  iteration: string;
  platform: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  web: 'Web 端',
  h5: 'H5 端',
  miniapp: '小程序端',
  backend: '后端',
};

export async function sliceCommand(options: SliceOptions): Promise<void> {
  if (!options.iteration || !options.platform) {
    console.error('❌ 任务名与端名是必需的。');
    console.error('   示例: specprot slice -n "会议室预订优化" -p web');
    return;
  }

  const platform = options.platform as Platform;
  const label = PLATFORM_LABELS[platform] || platform;
  const taskDir = getWorkspaceDir(options.iteration);

  if (!(await pathExists(taskDir))) {
    console.error(`❌ 期次不存在: ${options.iteration}`);
    return;
  }

  const reqPath = join(getPlatformDir(options.iteration, platform), 'REQUIREMENT.md');
  if (!(await pathExists(reqPath))) {
    console.error(`❌ 端级需求不存在: ${join(options.iteration, platform, 'REQUIREMENT.md')}`);
    console.error(`   请先运行端级分析: specprot analyze -i "${options.iteration}" -p ${platform}`);
    return;
  }

  const reqContent = await readFile(reqPath, 'utf-8');
  // 端级需求仍是空骨架（analyze 接力未完成）时禁止切分
  if (reqContent.includes('_待批量生成_')) {
    console.error(`❌ 端级需求仍是空骨架（含「待批量生成」占位符）。`);
    console.error(`   请先完成端级分析（宿主 AI 接力填充）再切分。`);
    return;
  }

  console.log(`🔪 端内切分: ${options.iteration} / ${label}\n`);

  // 1. 预建 features/ 目录与索引骨架（幂等）
  const featuresDir = getPlatformFeaturesDir(options.iteration, platform);
  await ensureDir(featuresDir);
  const indexPath = join(featuresDir, 'INDEX.md');
  if (!(await pathExists(indexPath))) {
    await writeFile(indexPath, indexSkeleton(options.iteration, label));
  }

  // 2. 素材清单（供单元文档溯源）
  const context = await collectMaterials(options.iteration, platform);
  const materialFiles = context.sources
    .filter((s) => s.platform === platform || s.platform === 'shared')
    .map((s) => s.file);

  // 3. 产品模板解析（单元文档模板优先，系统默认兜底）
  const unitTemplate = await resolvePlatformTemplate(options.iteration, platform, 'UNIT_REQUIREMENT.md');

  // 4. 组装切分 prompt
  const prompt = buildSlicePrompt({
    iterationName: options.iteration,
    platform,
    label,
    reqContent,
    featuresDir,
    indexPath,
    materialFiles,
    unitTemplate,
  });

  console.log('[SPECPROT_PROMPT]');
  console.log(prompt);
  console.log('[SPECPROT_PROMPT_END]');
  console.log('');
  console.log('📌 宿主 AI 指令：');
  console.log(`   1. 识别端级需求中的功能单元，每个单元写入 ${join(options.iteration, platform, 'features', '{单元名}', 'REQUIREMENT.md')}`);
  console.log(`   2. 填充功能单元索引 ${join(options.iteration, platform, 'features', 'INDEX.md')}`);
  console.log(`   3. 每个单元文档必须含「素材溯源」段（端级需求 + 原始素材文件名）`);
  console.log('');
  console.log('[SPECPROT_STEP_DONE]');
  console.log(`[SPECPROT_NEXT_STEP] 宿主 AI 按 prompt 切分功能单元并填充 INDEX.md 后: specprot run --resume -i "${options.iteration}"`);
}

function indexSkeleton(iterationName: string, label: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `# ${iterationName} — ${label}功能单元索引

> 本索引由切分生成，按功能单元组织。
> 每个单元独立成文，可独立评审、独立排期。

## 功能单元清单

| 单元名 | 目录 | 功能概述 | 溯源素材 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| _待切分_ | - | - | - | - |

## 切分记录

| 日期 | 操作 | 说明 |
| :--- | :--- | :--- |
| ${today} | 切分 | 从端级需求切分功能单元 |
`;
}

function buildSlicePrompt(ctx: {
  iterationName: string;
  platform: string;
  label: string;
  reqContent: string;
  featuresDir: string;
  indexPath: string;
  materialFiles: string[];
  unitTemplate: { path: string; content: string } | null;
}): string {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  let p = `# 期次: ${ctx.iterationName} — ${ctx.label}功能切分\n\n`;
  p += `> 切分时间: ${now}\n`;
  p += `> 目标: 把端级需求切分为功能单元，每个单元独立成文\n\n`;

  p += `## 目标位置\n\n`;
  p += `- 功能单元目录: \`${ctx.featuresDir}/{单元名}/\`\n`;
  p += `- 单元索引（填充）: \`${ctx.indexPath}\`\n\n`;

  p += `## 切分原则（必须遵守）\n\n`;
  p += `1. **单元 = 可独立交付的完整功能**。判断标准：有清晰的用户价值、有独立的验收标准、可单独排期开发\n`;
  p += `2. **单元粒度适中**：通常 3~8 个。过粗（整个端一个单元）等于没切，过细（一个按钮一个单元）失去意义\n`;
  p += `3. **单元名使用业务语言**（如「会议室预订」「预订取消」），不用技术术语，目录名与单元名一致\n`;
  p += `4. **每个单元写独立 REQUIREMENT.md**，按下方模板。端级 REQUIREMENT.md 保持原样不动（它是总纲）\n`;
  p += `5. **素材溯源必填**：单元文档的溯源段列出该单元涉及的原始素材文件，端级素材清单见下\n`;
  p += `6. **跨端内容标引用**：涉及 _shared/ 的业务规则、数据模型，只写引用不复制内容\n`;
  p += `7. **不编造**：端级需求中没有的功能点不新增；端级需求疑似缺漏处，在单元文档「待确认」段列出\n`;
  p += `8. **索引同步**：切分完成后填充 INDEX.md 清单表，每行记录单元名、概述、溯源素材\n\n`;

  p += `## 单元文档模板\n\n`;
  if (ctx.unitTemplate) {
    p += `按产品模板撰写（${ctx.unitTemplate.path}），素材溯源与待确认段仍必须保留：\n\n`;
    p += `\`\`\`markdown\n${ctx.unitTemplate.content}\n\`\`\`\n\n`;
  } else {
    p += `\`\`\`markdown\n# {单元名}\n\n> 素材溯源\n> | 项 | 值 |\n> | :--- | :--- |\n> | 所属端 | ${ctx.label} |\n> | 端级需求 | ${ctx.platform}/REQUIREMENT.md |\n> | 原始素材 | {素材文件名，逗号分隔} |\n> | 切分时间 | ${now} |\n\n## 1. 功能概述\n\n## 2. 用户场景\n\n## 3. 功能点\n\n## 4. 页面/接口\n\n## 5. 数据字段\n\n## 6. 业务规则\n\n## 7. 验收标准\n\n## 8. 待确认\n\`\`\`\n\n`;
  }

  if (ctx.materialFiles.length > 0) {
    p += `## 素材清单（溯源引用用这些文件名）\n\n`;
    for (const f of ctx.materialFiles) {
      p += `- ${f}\n`;
    }
    p += `\n`;
  }

  p += `## 端级需求全文\n\n`;
  p += `\`\`\`markdown\n${ctx.reqContent}\n\`\`\`\n`;

  return p;
}
