#!/usr/bin/env node
import { program } from 'commander';
// @ts-ignore — pkg may not be resolved at build time
const pkg = { version: '0.1.0' };

program
  .name('specprot')
  .description('产品底座 — 从需求文档生成原型和图表')
  .version(pkg.version);

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
  .description('在当前项目生成 Qcoder/Trae Slash Commands')
  .action(async () => {
    const { ensureDir, writeFile } = require('fs-extra');
    const { join } = require('path');

    const tools = ['.codebuddy', '.qoder', '.cursor', '.trae'];

    for (const dir of tools) {
      const cmdDir = join(process.cwd(), dir, 'commands');
      await ensureDir(cmdDir);

      await writeFile(join(cmdDir, 'prototype.md'), `---
name: prototype
description: 从需求文档生成 HTML 原型
---
请执行以下命令生成原型：

\`\`\`bash
cd "$(git rev-parse --show-toplevel)" && specprot prototype --file="\$1" --output="\$2"
\`\`\`

参数: $1=需求文档路径(默认REQUIREMENT.md) $2=输出目录(默认prototypes)
`);
    }

    console.log(`✅ Slash Commands 已注入到 ${tools.length} 个工具`);
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
