/**
 * 方案分叉命令 — schemes（v0.3.1）
 *
 * 一个功能单元可出多案：开发工时 / 交互方式 / 视觉风格不同，全部保留，
 * 产品圈选「推荐」，其余进备选库——冻结时推荐方案进交付快照正文，
 * 其余方案进「备选方案附录」，SpecCore 技术阶段可再选。
 *
 * CLI 管确定性（骨架预建、对比矩阵校验），AI 管语义（写方案段与对比矩阵）。
 */

import { readFile, writeFile, pathExists, ensureDir } from 'fs-extra';
import { join } from 'path';
import {
  getWorkspaceDir,
  getPlatformFeaturesDir,
  Platform,
  PLATFORM_LABELS,
} from '../core/workspace-manager';

export interface SchemesOptions {
  iteration: string;
  platform: string;
  feature: string;
  yes?: boolean;
}

export async function schemesCommand(options: SchemesOptions): Promise<void> {
  if (!options.iteration || !options.platform || !options.feature) {
    console.error('❌ 期次名、端名、单元名是必需的。');
    console.error('   示例: specprot schemes -i 期次-XXX -p web -f 预订功能');
    return;
  }

  const platform = options.platform as Platform;
  const label = PLATFORM_LABELS[platform] || platform;
  const unitDir = join(getPlatformFeaturesDir(options.iteration, platform), options.feature);

  if (!(await pathExists(join(unitDir, 'REQUIREMENT.md')))) {
    console.error(`❌ 单元不存在: ${platform}/features/${options.feature}`);
    return;
  }

  const outlinePath = join(unitDir, 'OUTLINE.md');
  const outline = (await pathExists(outlinePath)) ? await readFile(outlinePath, 'utf-8') : '（无结构契约，分叉点请按需求自行判断）';
  const req = await readFile(join(unitDir, 'REQUIREMENT.md'), 'utf-8');
  const schemesPath = join(unitDir, 'SCHEMES.md');

  if (!(await pathExists(schemesPath))) {
    await ensureDir(unitDir);
    await writeFile(schemesPath, schemesSkeleton(options.feature), 'utf-8');
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  let p = `# ${options.iteration} — ${label}/${options.feature} 方案分叉生成\n\n`;
  p += `> 时间: ${now}\n`;
  p += `> 目标位置: ${schemesPath}（覆盖写入，保留模板表头）\n\n`;
  p += `## 方案要求\n\n`;
  p += `1. 按结构契约「分叉预判」逐点出案。无分叉预判但需求存在明显取舍点（工时差异大/交互惯例分歧/风格选择）时主动提案\n`;
  p += `2. 每个方案一段（S1/S2/S3…）: 定位一句话 + 差异点 + 工时估算（人日）+ 适用场景 + 优劣\n`;
  p += `3. 对比矩阵: 行 = 方案，列 = 工时/交互方式/视觉风格/风险/适用场景\n`;
  p += `4. 推荐标记: 矩阵后写「推荐: Sx + 理由一句话」。推荐是产品决策，你只给候选建议，产品可改\n`;
  p += `5. 方案间必须实质不同（不能是措辞差异）；各方案都保留，不删任何一段\n\n`;
  p += `## 结构契约（分叉预判）\n\n\`\`\`markdown\n${outline}\n\`\`\`\n\n`;
  p += `## 单元需求\n\n\`\`\`markdown\n${req}\n\`\`\`\n`;

  console.log(`🔀 方案分叉: ${options.iteration} / ${label} / ${options.feature}`);
  console.log('[SPECPROT_PROMPT]');
  console.log(p);
  console.log('[SPECPROT_PROMPT_END]');
  console.log(`📌 宿主 AI 指令: 按 prompt 覆盖写入 ${join(options.iteration, platform, 'features', options.feature, 'SCHEMES.md')}`);
  console.log('');
  console.log('💡 产品圈选: 在 SCHEMES.md 修改「推荐: Sx」，冻结时推荐方案进快照正文，其余进备选附录。');
  console.log('[SPECPROT_STEP_DONE]');
  console.log(`[SPECPROT_NEXT_STEP] 方案落盘后产品圈选推荐 → 冻结: specprot iteration freeze -n "${options.iteration}"`);
}

/** 解析 SCHEMES.md：提取方案段 + 推荐标记（供 freeze 集成消费，多消费点共用） */
export function parseSchemes(content: string): { schemes: Array<{ id: string; title: string }>; recommended: string[] } {
  const schemeIds = Array.from(content.matchAll(/^## (S\d+)\s*[:：]?\s*(.*)$/gm)).map((m) => ({
    id: m[1].trim(),
    title: m[2].trim(),
  }));
  const recMatch = content.match(/推荐[:：]\s*(S\d+[^\\n]*)/);
  const recommended = recMatch ? recMatch[1].split(/[,，、]/).map((s) => s.trim()).filter(Boolean) : [];
  return { schemes: schemeIds, recommended };
}

/** 判断对比矩阵是否齐全（矩阵列头五列） */
export function checkSchemeMatrix(content: string): boolean {
  const matrixHeader = content.match(/\|\s*方案\s*\|[^\\n]*工时[^\\n]*交互[^\\n]*风格[^\\n]*/);
  return !!matrixHeader;
}

function schemesSkeleton(feature: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `# ${feature} — 方案分叉

> 创建时间: ${today}
> 说明: 每个方案一段（S1/S2…），全部保留；产品圈选「推荐」，其余进备选库。

## S1: _待填充_

- 定位: 一句话
- 差异点: 
- 工时估算: X 人日
- 适用场景: 
- 优劣: 

## 方案对比矩阵

| 方案 | 工时 | 交互方式 | 视觉风格 | 风险 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| S1 | - | - | - | - | - |

## 推荐

推荐: S1
理由: 待产品确认
`;
}
