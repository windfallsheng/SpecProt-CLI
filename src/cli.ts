#!/usr/bin/env node
import { program } from 'commander';
// @ts-ignore — pkg may not be resolved at build time
const pkg = { version: '0.1.0' };

program
  .name('specprot')
  .description('产品底座 — 从需求文档生成原型和图表')
  .version(pkg.version);

// ===== 🧠 智能入口：自然语言意图识别 =====

program
  .command('spec [input...]')
  .description('自然语言智能入口 — 说人话就行')
  .action(async (input: string[]) => {
    const { specCommand } = await import('./commands/spec');
    await specCommand(input?.join(' ') || '');
  });

// ===== 🏗️ 全局层 & 期次管理 =====

const iterationCmd = program
  .command('iteration')
  .alias('iter')
  .description('期次管理');

iterationCmd
  .command('create')
  .alias('cr')
  .description('创建新期次')
  .requiredOption('-n, --name <name>', '期次名称，如: 期次-2026-Q3')
  .option('-g, --goal <goal>', '本期目标')
  .option('-f, --from <date>', '开始日期')
  .option('-t, --to <date>', '结束日期')
  .action(async (options) => {
    const { iterationCreateCommand } = await import('./commands/iteration');
    await iterationCreateCommand(options);
  });

iterationCmd
  .command('list')
  .alias('ls')
  .description('列出所有期次')
  .action(async () => {
    const { iterationListCommand } = await import('./commands/iteration');
    await iterationListCommand();
  });

iterationCmd
  .command('freeze')
  .alias('fz')
  .description('冻结期次，禁止修改需求')
  .requiredOption('-n, --name <name>', '期次名称')
  .action(async (options) => {
    const { iterationFreezeCommand } = await import('./commands/iteration');
    await iterationFreezeCommand(options);
  });

// ===== 📝 需求管理 =====

const reqCmd = program
  .command('req')
  .description('需求管理');

reqCmd
  .command('new')
  .alias('add')
  .description('新建需求')
  .requiredOption('-n, --name <name>', '需求名称')
  .option('-d, --desc <desc>', '需求描述')
  .option('-p, --project <project>', '所属项目', 'default')
  .option('-i, --iteration <name>', '关联期次')
  .action(async (options) => {
    const { reqNewCommand } = await import('./commands/requirement');
    await reqNewCommand(options);
  });

reqCmd
  .command('list')
  .alias('ls')
  .description('列出需求')
  .option('-i, --iteration <name>', '按期次筛选')
  .action(async (options) => {
    const { reqListCommand } = await import('./commands/requirement');
    await reqListCommand(options.iteration);
  });

reqCmd
  .command('show')
  .description('查看需求详情')
  .requiredOption('-r, --req <id>', '需求 ID，如 REQ-001')
  .option('-p, --project <project>', '所属项目', 'default')
  .action(async (options) => {
    const { reqShowCommand } = await import('./commands/requirement');
    await reqShowCommand(options.req, options.project);
  });

reqCmd
  .command('link')
  .description('关联需求到期次')
  .requiredOption('-r, --req <id>', '需求 ID')
  .requiredOption('-i, --iteration <name>', '期次名称')
  .action(async (options) => {
    const { reqLinkCommand } = await import('./commands/requirement');
    await reqLinkCommand(options);
  });

reqCmd
  .command('status')
  .description('更新需求状态')
  .requiredOption('-r, --req <id>', '需求 ID')
  .requiredOption('-s, --status <status>', '状态: 草稿/评审中/已通过/已冻结/开发中/已交付/已废弃/暂缓')
  .action(async (options) => {
    const { reqStatusCommand } = await import('./commands/requirement');
    await reqStatusCommand(options);
  });

// ===== 产品侧命令 =====

program
  .command('prototype')
  .alias('pt')
  .description('从需求文档生成 HTML 原型')
  .option('-i, --iteration <name>', '指定期次（Q1/Q2...），留空为全局层')
  .option('-f, --file <path>', '需求文档路径（覆盖默认路径）')
  .option('-o, --output <dir>', '输出目录（覆盖默认目录）')
  .action(async (options) => {
    const { prototypeCommand } = await import('./commands/prototype');
    await prototypeCommand(options);
  });

program
  .command('check')
  .alias('ck')
  .description('增量检查 — 对照已有需求和代码分析新需求')
  .option('-i, --iteration <name>', '指定期次')
  .option('-s, --snippet <text>', '直接传入需求片段')
  .option('-f, --file <path>', '读取需求文件')
  .action(async (options) => {
    const { checkCommand } = await import('./commands/check');
    await checkCommand(options);
  });

program
  .command('review')
  .alias('rv')
  .description('生成需求评审报告 (REVIEW.md)')
  .option('-i, --iteration <name>', '指定期次')
  .option('-f, --file <path>', '需求文件路径')
  .action(async (options) => {
    const { reviewCommand } = await import('./commands/review');
    await reviewCommand(options);
  });

program
  .command('design')
  .alias('ds')
  .description('提取/配置设计系统')
  .option('-s, --scan <dir>', '扫描本地代码工程目录')
  .option('-u, --url <url>', '线上页面 URL')
  .option('-c, --cookie <cookie>', '浏览器 Cookie')
  .option('-H, --header <headers>', '额外请求头')
  .option('-f, --file <path>', '本地 HTML/CSS 文件')
  .option('-p, --preset <name>', '预设: antd/element/tailwind/material/minimal')
  .option('--update [file]', '从 DESIGN_SYSTEM.yaml 重新生成样式指南')
  .option('-o, --output <file>', '输出文件', 'DESIGN_SYSTEM.yaml')
  .action(async (options) => {
    const { designCommand } = await import('./commands/design');
    await designCommand(options);
  });

program
  .command('init')
  .description('初始化项目：全局层 + Slash Commands')
  .action(async () => {
    const { ensureDir, writeFile } = require('fs-extra');
    const { join } = require('path');

    // 1. 初始化全局层
    const { ensureGlobalLayer } = await import('./core/global-layer');
    await ensureGlobalLayer();
    console.log('✅ 全局需求层已初始化 (.speccore/GLOBAL/)');

    // 2. 确保 .speccore/ITERATIONS 目录
    await ensureDir(join(process.cwd(), '.speccore', 'ITERATIONS'));

    // 3. 注入 Slash Commands
    const tools = ['.codebuddy', '.qoder', '.cursor', '.trae'];

    const commands: [string, string, string][] = [
      ['prototype', '从需求文档生成 HTML 原型', 'specprot prototype --file="${1:REQUIREMENT.md}" --iteration="${2:}"'],
      ['check', '增量检查需求完整性和一致性', 'specprot check --file="${1:REQUIREMENT.md}"'],
      ['review', '生成需求评审报告', 'specprot review --file="${1:REQUIREMENT.md}"'],
      ['iteration-create', '创建新期次', 'specprot iteration create --name="${1:期次-2026-Q3}" --goal="${2:}"'],
      ['iteration-list', '列出所有期次', 'specprot iteration list'],
      ['iteration-freeze', '冻结期次', 'specprot iteration freeze --name="${1:期次-2026-Q3}"'],
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
cd "$(git rev-parse --show-toplevel)" && ${body}
\`\`\`
`);
      }
    }

    console.log(`✅ ${commands.length} 个 Slash Commands 已注入到 ${tools.length} 个工具`);
    console.log('');
    console.log('📁 项目结构：');
    console.log('  .speccore/GLOBAL/     ← 全量需求索引');
    console.log('  期次-XXX/             ← 迭代工作区');
    console.log('    00-需求文档/');
    console.log('    01-原型/');
    console.log('    02-图谱/');
    console.log('    03-评审/');
    console.log('    04-交付/');
  });

program
  .command('watch')
  .alias('w')
  .description('监控需求文件，保存时自动检查并推荐操作')
  .option('-i, --iteration <name>', '指定期次')
  .option('-f, --file <path>', '监控文件路径')
  .action(async (options) => {
    const { watchCommand } = await import('./commands/watch');
    await watchCommand(options);
  });

program.parse();
