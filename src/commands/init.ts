/**
 * init — 项目初始化：全局层 + Slash Commands 注入
 */

import { ensureDir, writeFile } from 'fs-extra';
import { join } from 'path';

export async function initCommand(): Promise<void> {
  // 1. 初始化全局层
  const { ensureGlobalLayer } = await import('../core/global-layer');
  await ensureGlobalLayer();
  console.log('✅ 全局需求层已初始化 (.speccore/GLOBAL/)');

  // 2. 确保 .speccore/ITERATIONS 目录
  await ensureDir(join(process.cwd(), '.speccore', 'ITERATIONS'));

  // 3. 注入 Slash Commands
  const tools = ['.codebuddy', '.qoder', '.cursor', '.trae'];

  const commands: [string, string, string][] = [
    ['ask', '自然语言执行入口（说人话就办）', 'specprot ask "${1:创建期次 Q3，涉及 web 和 backend}"'],
    ['run', '跑六段流水线（一条龙到冻结）', 'specprot run --iteration="${1:期次-XXX}" --mode="${2:interactive}"'],
    ['iteration-create', '创建新期次', 'specprot iteration create --name="${1:期次-2026-Q3}" --platforms="${2:web,backend}" --goal="${3:}"'],
    ['iteration-list', '列出所有期次', 'specprot iteration list'],
    ['iteration-freeze', '冻结期次', 'specprot iteration freeze --name="${1:期次-2026-Q3}"'],
    ['check', '需求五维体检（骨架/质量/图建议/风险初筛/增量对照）', 'specprot check --file="${1:REQUIREMENT.md}"'],
    ['prototype', '从需求文档生成 HTML 原型', 'specprot prototype --file="${1:REQUIREMENT.md}" --iteration="${2:}"'],
    ['req-new', '新建需求', 'specprot req new --name="${1:需求名称}" --desc="${2:}" --project="${3:default}"'],
    ['req-list', '列出需求', 'specprot req list'],
    ['req-link', '关联需求到期次', 'specprot req link --req="${1:REQ-001}" --iteration="${2:期次-2026-Q3}"'],
    ['req-status', '更新需求状态', 'specprot req status --req="${1:REQ-001}" --status="${2:评审中}"'],
  ];

  for (const dir of tools) {
    const cmdDir = join(process.cwd(), dir, 'commands');
    await ensureDir(cmdDir);

    for (const [name, desc, body] of commands) {
      await writeFile(join(cmdDir, `${name}.md`), `---
name: ${name}
description: ${desc}
---

\`\`\`bash
cd \"$(git rev-parse --show-toplevel 2>/dev/null || pwd)\" && ${body}
\`\`\`
`);
    }
  }

  console.log(`✅ ${commands.length} 个 Slash Commands 已注入到 ${tools.length} 个工具`);
  console.log('');
  console.log('📁 项目结构：');
  console.log('  .speccore/GLOBAL/     ← 全量需求索引');
  console.log('  期次-XXX/             ← 迭代工作区');
}
