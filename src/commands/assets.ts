/**
 * 资产生成命令 — assets（v0.3.1）
 *
 * 图与原型是第一公民资产：文档引用资产 ID，不引用文件路径，
 * 改图/改原型后文档引用自动同步（单一事实源）。
 *
 * 两类资产：
 *   diagrams   — 图（Mermaid 文本源 .mmd，确定性；聚合预览 HTML）
 *   prototype  — 原型（纯静态 HTML 页面，无依赖，产品浏览器里可点、可圈改）
 *
 * 端画像注入 prompt，保证不同端的图与原型有针对性。
 *
 * CLI 管确定性（目录预建、ASSETS.yaml 注册表、聚合预览页、原型导航页），
 * AI 管语义（写 .mmd 源与 .html 页面）。重跑 = 增量修订（圈改标注同样适用）。
 */

import { readFile, writeFile, pathExists, ensureDir, readdir } from 'fs-extra';
import { join } from 'path';
import {
  getWorkspaceDir,
  getPlatformFeaturesDir,
  Platform,
  PLATFORM_LABELS,
} from '../core/workspace-manager';

export interface AssetsOptions {
  iteration: string;
  platform: string;
  feature?: string; // 缺省 = 该端全部单元
  kind?: string; // diagrams | prototype | all（默认 all）
  yes?: boolean;
}

/** 端画像要点（注入 prompt，保证资产有端特点） */
const PLATFORM_PROFILE: Record<Platform, string> = {
  web: '桌面 Web：信息密度可高、表格与权限矩阵常见、键鼠操作、状态反馈齐全',
  h5: '移动 H5：触控为主（点击区 ≥44px）、弱网降级、多机型适配、分享裂变场景',
  miniapp: '小程序：受平台 API 边界约束、分包策略、审核合规（诱导分享/虚拟支付限制）',
  backend: '后端：无页面原型，资产以数据流图/状态机图/接口时序图为主',
};

export async function assetsCommand(options: AssetsOptions): Promise<void> {
  if (!options.iteration || !options.platform) {
    console.error('❌ 期次名、端名是必需的。');
    console.error('   示例: specprot assets -i 期次-XXX -p web -f 预订功能');
    return;
  }

  const platform = options.platform as Platform;
  const kind = options.kind || 'all';
  const featuresDir = getPlatformFeaturesDir(options.iteration, platform);
  const units = options.feature
    ? [options.feature]
    : (await pathExists(featuresDir))
      ? (await readdir(featuresDir)).filter((f) => !f.startsWith('.') && f !== 'INDEX.md').sort()
      : [];

  if (units.length === 0) {
    console.error(`❌ ${options.iteration} 的 ${platform} 端还没有功能单元（先 slice 切分）。`);
    return;
  }

  let done = 0;
  for (const feature of units) {
    const unitDir = join(featuresDir, feature);
    if (!(await pathExists(join(unitDir, 'REQUIREMENT.md')))) {
      if (options.feature) console.error(`❌ 单元不存在: ${platform}/features/${feature}`);
      continue;
    }
    await generateForUnit(options.iteration, feature, unitDir, platform, kind);
    done++;
  }
  console.log('');
  console.log(`✅ 资产清单已刷新: ${done} 个单元 → ${join(options.iteration, platform, 'assets')}`);
}

/** 单单元资产生成（-f 指定单单元 / 批量遍历共用） */
async function generateForUnit(
  iterationName: string,
  feature: string,
  unitDir: string,
  platform: Platform,
  kind: string
): Promise<void> {
  const label = PLATFORM_LABELS[platform] || platform;
  const assetsDir = join(getWorkspaceDir(iterationName), platform, 'assets', feature);
  await ensureDir(assetsDir);

  console.log(`🎨 资产生成: ${iterationName} / ${label} / ${feature}\n`);

  if (kind === 'diagrams' || kind === 'all') {
    await runDiagrams(iterationName, platform, label, feature, unitDir, assetsDir);
  }
  if (kind === 'prototype' || kind === 'all') {
    await runPrototype(iterationName, platform, label, feature, unitDir, assetsDir);
  }

  // 确定性收尾：资产注册表 + 预览聚合页（每次重跑都刷新，与源文件保持同步）
  await writeAssetsRegistry(assetsDir);
  await writeDiagramsPreview(assetsDir, feature);
  await writePrototypeIndex(assetsDir, feature);
}

/** 图资产：OUTLINE 图清单 → .mmd 源 */
async function runDiagrams(
  iterationName: string,
  platform: Platform,
  label: string,
  feature: string,
  unitDir: string,
  assetsDir: string
): Promise<void> {
  const diagramsDir = join(assetsDir, 'diagrams');
  await ensureDir(diagramsDir);

  const outlinePath = join(unitDir, 'OUTLINE.md');
  const outline = (await pathExists(outlinePath)) ? await readFile(outlinePath, 'utf-8') : '（无结构契约，请先 deepen）';
  const req = await readFile(join(unitDir, 'REQUIREMENT.md'), 'utf-8');

  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  let p = `# ${iterationName} — ${label}/${feature} 图资产生成\n\n`;
  p += `> 时间: ${now}\n`;
  p += `> 目标位置: ${diagramsDir}/（每张图一个 .mmd 文件）\n\n`;
  p += `## 端画像\n\n${PLATFORM_PROFILE[platform]}\n\n`;
  p += `## 图资产要求\n\n`;
  p += `1. 按结构契约「图清单」逐张生成 Mermaid 源文件，文件名 = 图 ID（如 fig-01.mmd）\n`;
  p += `2. 图类型对照: 业务流程图 → flowchart TD；状态机图 → stateDiagram-v2；数据流图 → flowchart LR；页面线框 → 用 flowchart 描述页面元素层级\n`;
  p += `3. 节点文案用业务语言（中文），不用技术术语；每个图必须有明确的起点与终点\n`;
  p += `4. 只写图本身，不写图外解释（图说明由结构契约承载）\n`;
  p += `5. 已有 .mmd 文件按圈改标注增量修订（~~删除~~ / （圈改：要求）），无标注的图原样保留\n\n`;
  p += `## 结构契约（图清单）\n\n\`\`\`markdown\n${outline}\n\`\`\`\n\n`;
  p += `## 单元需求\n\n\`\`\`markdown\n${req}\n\`\`\`\n`;

  console.log('  ▶ diagrams');
  console.log('[SPECPROT_PROMPT]');
  console.log(p);
  console.log('[SPECPROT_PROMPT_END]');
  console.log(`📌 宿主 AI 指令: 按图清单在 ${join(iterationName, platform, 'assets', feature, 'diagrams')}/ 写入 .mmd 文件`);
  console.log('[SPECPROT_STEP_DONE]');
  console.log(`[SPECPROT_NEXT_STEP] 图源落盘后重跑: specprot assets -i "${iterationName}" -p ${platform} -f ${feature} --kind diagrams（刷新注册表与预览页）`);
}

/** 原型资产：REQUIREMENT 页面清单 → 纯静态 HTML */
async function runPrototype(
  iterationName: string,
  platform: Platform,
  label: string,
  feature: string,
  unitDir: string,
  assetsDir: string
): Promise<void> {
  if (platform === 'backend') {
    console.log('  ⏭️ prototype（后端无页面原型，跳过）');
    return;
  }
  const protoDir = join(assetsDir, 'prototype');
  await ensureDir(protoDir);

  const req = await readFile(join(unitDir, 'REQUIREMENT.md'), 'utf-8');

  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  let p = `# ${iterationName} — ${label}/${feature} 原型生成\n\n`;
  p += `> 时间: ${now}\n`;
  p += `> 目标位置: ${protoDir}/（每个页面一个 .html）\n\n`;
  p += `## 端画像\n\n${PLATFORM_PROFILE[platform]}\n\n`;
  p += `## 原型要求\n\n`;
  p += `1. 按需求的页面/交互段拆页面，页面名用业务语言（如 booking-list.html）\n`;
  p += `2. 纯静态单文件: 内联 CSS，无外部依赖、无 JS 框架，可离线打开\n`;
  p += `3. 页头有「页面名 + 所属单元」横幅；交互按钮用占位提示（如 onclick 弹 alert 说明跳转目标）\n`;
  p += `4. 只画结构走查级线框（灰阶 + 品牌色点缀），不做视觉设计\n`;
  p += `5. 已有页面按圈改标注增量修订（~~删除~~ / （圈改：要求）），无标注的页面原样保留\n\n`;
  p += `## 单元需求\n\n\`\`\`markdown\n${req}\n\`\`\`\n`;

  console.log('  ▶ prototype');
  console.log('[SPECPROT_PROMPT]');
  console.log(p);
  console.log('[SPECPROT_PROMPT_END]');
  console.log(`📌 宿主 AI 指令: 按需求在 ${join(iterationName, platform, 'assets', feature, 'prototype')}/ 写入页面 .html`);
  console.log('[SPECPROT_STEP_DONE]');
  console.log(`[SPECPROT_NEXT_STEP] 页面落盘后重跑: specprot assets -i "${iterationName}" -p ${platform} -f ${feature} --kind prototype（刷新导航页）`);
}

/** 资产注册表：扫描资产目录，登记状态（确定性） */
async function writeAssetsRegistry(assetsDir: string): Promise<void> {
  const lines: string[] = [
    '# 资产注册表 — 单一事实源',
    '# 文档引用资产 ID，不引用文件路径；状态: 草稿/已确认/待改',
    'assets:',
  ];
  const diagramsDir = join(assetsDir, 'diagrams');
  if (await pathExists(diagramsDir)) {
    for (const f of (await readdir(diagramsDir)).filter((x) => x.endsWith('.mmd')).sort()) {
      lines.push(`  - id: ${f.replace(/\\.mmd$/, '')}`);
      lines.push('    kind: diagram');
      lines.push(`    path: diagrams/${f}`);
      lines.push('    status: 草稿');
    }
  }
  const protoDir = join(assetsDir, 'prototype');
  if (await pathExists(protoDir)) {
    for (const f of (await readdir(protoDir)).filter((x) => x.endsWith('.html')).sort()) {
      lines.push(`  - id: ${f.replace(/\\.html$/, '')}`);
      lines.push('    kind: prototype');
      lines.push(`    path: prototype/${f}`);
      lines.push('    status: 草稿');
    }
  }
  await writeFile(join(assetsDir, 'ASSETS.yaml'), lines.join('\n') + '\n', 'utf-8');
}

/** 图聚合预览页（Mermaid CDN 渲染；离线时降级展示源码） */
async function writeDiagramsPreview(assetsDir: string, feature: string): Promise<void> {
  const diagramsDir = join(assetsDir, 'diagrams');
  if (!(await pathExists(diagramsDir))) return;
  const files = (await readdir(diagramsDir)).filter((f) => f.endsWith('.mmd')).sort();
  if (files.length === 0) return;

  let blocks = '';
  for (const f of files) {
    const src = await readFile(join(diagramsDir, f), 'utf-8');
    blocks += `<section class="diagram">\n<h2>${f.replace(/\\.mmd$/, '')}</h2>\n<div class="mermaid">\n${src}\n</div>\n</section>\n`;
  }
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${feature} — 图资产预览</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 960px; }
  h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  .diagram { margin: 24px 0; padding: 16px; border: 1px solid #e0e0e0; border-radius: 8px; }
  .diagram h2 { font-size: 15px; color: #555; margin: 0 0 12px; }
  .mermaid { text-align: center; }
  pre.source { white-space: pre-wrap; background: #f6f6f6; padding: 12px; border-radius: 6px; font-size: 12px; }
</style>
</head>
<body>
<h1>${feature} — 图资产预览</h1>
${blocks}
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: 'default' });
</script>
<noscript><p>⚠️ 离线模式：以下为 Mermaid 源码，联网后自动渲染。</p></noscript>
</body>
</html>
`;
  await writeFile(join(assetsDir, 'diagrams-preview.html'), html, 'utf-8');
}

/** 原型导航页（确定性聚合） */
async function writePrototypeIndex(assetsDir: string, feature: string): Promise<void> {
  const protoDir = join(assetsDir, 'prototype');
  if (!(await pathExists(protoDir))) return;
  const files = (await readdir(protoDir)).filter((f) => f.endsWith('.html')).sort();
  if (files.length === 0) return;

  const links = files.map((f) => `    <li><a href="prototype/${f}">${f.replace(/\\.html$/, '')}</a></li>`).join('\n');
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${feature} — 原型导航</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 640px; }
  h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  li { margin: 8px 0; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<h1>${feature} — 原型导航</h1>
<ul>
${links}
</ul>
</body>
</html>
`;
  await writeFile(join(assetsDir, 'prototype-index.html'), html, 'utf-8');
}
