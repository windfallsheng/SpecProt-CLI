/**
 * 端级分析命令 — analyze（v0.2.0）
 *
 * 从端素材（含 shared/ 跨端通用 + converted/ 转换产物）生成端需求文档。
 * CLI 组装 prompt（素材注入 + 写作要求 + 待确认出口），宿主 AI 接力填充骨架。
 */

import { readFile, pathExists } from 'fs-extra';
import { join } from 'path';
import {
  collectMaterials,
  getWorkspaceDir,
  getPlatformDir,
  resolvePlatformTemplate,
  platformLabel,
  Platform,
} from '../core/workspace-manager';
import { buildReferenceContext, formatReferenceSection, ReferenceContext } from '../core/reference-context';

export interface AnalyzeOptions {
  iteration: string;
  platform: string;
  apply?: string;   // --apply: JSON {文件路径: 内容} 回写校验（预留）
}


export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  if (!options.iteration || !options.platform) {
    console.error('❌ 任务名与端名是必需的。');
    console.error('   示例: specprot analyze -n "会议室预订优化" -p web');
    return;
  }

  const platform = options.platform as Platform;
  const label = platformLabel(platform);
  const taskDir = getWorkspaceDir(options.iteration);
  if (!(await pathExists(taskDir))) {
    console.error(`❌ 期次不存在: ${options.iteration}`);
    return;
  }

  console.log(`🔍 端级分析: ${options.iteration} / ${label}\n`);

  // 1. 收集端素材（本端素材 + 本端转换产物 + shared 跨端通用）
  const context = await collectMaterials(options.iteration, platform);
  const platformSources = context.sources.filter((s) => s.platform === platform);
  const sharedSources = context.sources.filter((s) => s.platform === 'shared');

  if (context.sources.length === 0) {
    console.error(`❌ 素材区没有可读素材。`);
    console.error(`   请把材料放进 ${options.iteration}/00-素材/${platform}/（跨端通用放 shared/），`);
    console.error(`   然后先转换: specprot convert -i "${options.iteration}"`);
    return;
  }

  console.log(`   素材: ${platformSources.length} 份端素材(含本端转换产物) + ${sharedSources.length} 份跨端通用`);

  // 2. 目标文件
  const reqPath = join(getPlatformDir(options.iteration, platform), 'REQUIREMENT.md');
  const clarifyPath = join(getPlatformDir(options.iteration, platform), 'CLARIFY.md');

  // 3. 产品模板解析（模板优先，系统默认兜底）
  const reqTemplate = await resolvePlatformTemplate(options.iteration, platform, 'REQUIREMENT.md');
  const clarifyTemplate = await resolvePlatformTemplate(options.iteration, platform, 'CLARIFY.md');

  // 4. 参考上下文（正典同端历史需求摘要 + 术语表/规则 + 设计系统 + 端名映射桥）
  const reference = await buildReferenceContext(options.iteration, platform);

  // 5. 组装 prompt
  const prompt = buildPlatformPrompt({
    iterationName: options.iteration,
    platform,
    label,
    reqPath,
    clarifyPath,
    reqTemplate,
    clarifyTemplate,
    platformSources,
    sharedSources,
    reference,
  });

  // 5. 输出接力标记
  console.log('[SPECPROT_PROMPT]');
  console.log(prompt);
  console.log('[SPECPROT_PROMPT_END]');
  console.log('');
  console.log('📌 宿主 AI 指令：');
  console.log(`   1. 按 prompt 要求覆盖写入 ${join(options.iteration, platform, 'REQUIREMENT.md')}`);
  console.log(`   2. 待确认清单写入 ${join(options.iteration, platform, 'CLARIFY.md')}`);
  console.log('');
  console.log('[SPECPROT_STEP_DONE]');
  console.log(`[SPECPROT_NEXT_STEP] 宿主 AI 接力填充 ${platform}/REQUIREMENT.md 与 CLARIFY.md 后: specprot run --resume -i "${options.iteration}"`);
}

function buildPlatformPrompt(ctx: {
  iterationName: string;
  platform: string;
  label: string;
  reqPath: string;
  clarifyPath: string;
  reqTemplate: { path: string; content: string } | null;
  clarifyTemplate: { path: string; content: string } | null;
  platformSources: { file: string; content: string }[];
  sharedSources: { file: string; content: string }[];
  reference: ReferenceContext;
}): string {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  let p = `# 期次: ${ctx.iterationName} — ${ctx.label}需求分析\n\n`;
  p += `> 分析时间: ${now}\n`;
  p += `> 目标: 从素材提炼出**该端**的完整需求文档\n\n`;

  p += `## 目标文件\n\n`;
  p += `- 需求文档（覆盖填充骨架）: \`${ctx.reqPath}\`\n`;
  p += `- 待确认清单（新建）: \`${ctx.clarifyPath}\`\n\n`;

  p += `## 写作要求（必须遵守）\n\n`;
  p += `1. **只写 ${ctx.label} 的内容**。素材中疑似其他端的内容，不写进本文档，记入待确认清单\n`;
  p += ctx.reqTemplate
    ? `2. 按产品模板的章节结构撰写（模板全文见下方「产品模板」节），逐节填充，不改变章节顺序\n`
    : `2. 覆盖 REQUIREMENT.md 的七个段落骨架：需求背景 / 用户场景 / 功能描述 / 页面接口 / 数据字段 / 业务规则 / 验收标准\n`;
  p += `3. 跨端通用的内容（业务规则、数据模型、通用流程）**引用 _shared/ 目录，不复制内容**\n`;
  p += `4. **素材中没有的信息不编造**——空缺处保持「待确认」，记入待确认清单\n`;
  p += `5. 验收标准必须可测试，格式: \`AC-NN: [前置条件] → [操作] → [预期结果]\`\n`;
  p += `6. 页面/接口清单要完整：每个页面列出字段、操作按钮、业务规则\n`;
  p += `7. **参考上下文**（下方「参考上下文」节）：与同端历史需求保持术语与风格一致，同名概念不得另造术语；与既有需求重复/冲突处必须记入待确认清单\n\n`;

  // 参考上下文（既有沉淀:历史需求 / 术语表 / 共享规则 / 设计系统 / 端名映射桥）
  p += formatReferenceSection(ctx.reference, ctx.label);

  p += `## 待确认清单格式（CLARIFY.md）\n\n`;
  if (ctx.clarifyTemplate) {
    p += `按产品模板撰写（${ctx.clarifyTemplate.path}）：\n\n`;
    p += `\`\`\`markdown\n${ctx.clarifyTemplate.content}\n\`\`\`\n\n`;
  } else {
    p += `\`\`\`markdown\n# ${ctx.label} — 待确认清单\n\n| # | 待确认事项 | 依据 |\n| :--- | :--- | :--- |\n| 1 | 素材未说明的事项 | 来源文件 |\n\`\`\`\n\n`;
  }

  if (ctx.reqTemplate) {
    p += `## 产品模板（${ctx.reqTemplate.path}）\n\n`;
    p += `> 以下为产品自定的章节结构，需求文档按此结构逐节填充：\n\n`;
    p += `\`\`\`markdown\n${ctx.reqTemplate.content}\n\`\`\`\n\n`;
  }

  if (ctx.platformSources.length > 0) {
    p += `## 端素材（${ctx.label}）\n\n`;
    for (const s of ctx.platformSources) {
      p += `### ${s.file}\n\n\`\`\`\n${s.content}\n\`\`\`\n\n`;
    }
  } else {
    p += `## 端素材（${ctx.label}）\n\n（该端素材目录为空，仅基于跨端通用素材分析）\n\n`;
  }

  if (ctx.sharedSources.length > 0) {
    p += `## 跨端通用素材（shared/ + converted/shared/）\n\n`;
    for (const s of ctx.sharedSources) {
      p += `### ${s.file}\n\n\`\`\`\n${s.content}\n\`\`\`\n\n`;
    }
  }

  return p;
}
