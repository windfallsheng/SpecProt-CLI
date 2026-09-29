#!/usr/bin/env node
import pkg from '../package.json';
import { program } from 'commander';

program
  .name('specprot')
  .description('需求定稿工坊（产品底座）— 素材 → 六段 → 冻结交付镜像，与 SpecCore 交接')
  .version(pkg.version);
program.addHelpText(
  'before',
  '\n需求定稿工坊 · 产品三步走:  iteration create 建期次 → 投料进 00-素材/ → run 一条龙(冻结即产出 010-requirements 交付镜像)\n\n'
);


// ===== 🧠 智能入口：自然语言意图识别 =====

program
  .command('ask [input...]')
  .description('自然语言智能入口 — 识别意图直接执行（与 SpecCore ask 对齐）')
  .action(async (input: string[]) => {
    const { askCommand } = await import('./commands/ask');
    await askCommand(input?.join(' ') || '');
  });

// ===== 🔧 素材转换 =====

program
  .command('convert')
  .alias('cv')
  .description('素材转换 — docx/pdf/xlsx → md（录音提示转写，图片建索引）')
  .requiredOption('-i, --iteration <name>', '期次名称')
  .option('-p, --platform <platform>', '只转换指定端（默认全部端 + shared）')
  .action(async (options) => {
    const { convertCommand } = await import('./commands/convert');
    await convertCommand(options);
  });

// ===== 🔍 端级分析 =====

program
  .command('analyze')
  .alias('az')
  .description('端级分析 — 从端素材提炼完整需求文档（AI 接力）')
  .requiredOption('-i, --iteration <name>', '期次名称')
  .requiredOption('-p, --platform <platform>', '目标端: web/h5/miniapp/backend')
  .action(async (options) => {
    const { analyzeCommand } = await import('./commands/analyze');
    await analyzeCommand(options);
  });

// ===== 🔪 端内功能切分 =====

program
  .command('slice')
  .alias('sl')
  .description('端内功能切分 — 端级需求切分为功能单元（AI 接力 + 素材溯源）')
  .requiredOption('-i, --iteration <name>', '期次名称')
  .requiredOption('-p, --platform <platform>', '目标端: web/h5/miniapp/backend')
  .action(async (options) => {
    const { sliceCommand } = await import('./commands/slice');
    await sliceCommand(options);
  });

// ===== 🚀 批量处理引擎 =====

program
  .command('deepen')
  .description('单元深度完善 — 结构契约(OUTLINE) → 评审包(RISK裁决/CLARIFY/REBOUND 回流)')
  .requiredOption('-i, --iteration <name>', '期次名称')
  .requiredOption('-p, --platform <name>', '端名')
  .option('-f, --feature <name>', '功能单元名（缺省 = 该端全部单元）')
  .option('--phase <phase>', '阶段: outline / review / all', 'all')
  .action(async (options) => {
    const { deepenCommand } = await import('./commands/deepen');
    await deepenCommand(options);
  });

program
  .command('assets')
  .description('资产生成 — 图(Mermaid) + 原型 HTML + ASSETS.yaml 资产注册表')
  .requiredOption('-i, --iteration <name>', '期次名称')
  .requiredOption('-p, --platform <name>', '端名')
  .requiredOption('-f, --feature <name>', '功能单元名')
  .option('-k, --kind <kind>', '资产类型: diagrams / prototype / all', 'all')
  .action(async (options) => {
    const { assetsCommand } = await import('./commands/assets');
    await assetsCommand(options);
  });

program
  .command('schemes')
  .description('方案分叉 — 多案对比 + 推荐圈选（冻结时推荐进快照正文，其余进备选附录）')
  .requiredOption('-i, --iteration <name>', '期次名称')
  .requiredOption('-p, --platform <name>', '端名')
  .requiredOption('-f, --feature <name>', '功能单元名')
  .action(async (options) => {
    const { schemesCommand } = await import('./commands/schemes');
    await schemesCommand(options);
  });

// ===== 🎬 流水线编排器（自动/交互双模式） =====

program
  .command('run')
  .alias('r')
  .description('产品流水线 — convert → analyze → slice → deepen → adopt → freeze（全自动/人机交互双模式）')
  .requiredOption('-i, --iteration <name>', '期次名称')
  .option('-p, --platforms <list>', '端列表 (逗号分隔)，留空 = 期次配置的平台')
  .option('--from <stage>', '起始阶段: convert/analyze/slice/deepen/adopt/freeze', 'convert')
  .option('--to <stage>', '结束阶段: convert/analyze/slice/deepen/adopt/freeze', 'freeze')
  .option('-m, --mode <mode>', '模式: auto(全自动推进，关键闸口仍停) / interactive(每段停下确认)', 'interactive')
  .option('-y, --yes', '跳过交互确认（interactive 模式下一键放行）', false)
  .option('--resume', '断点续跑 — 从上次未完成阶段继续', false)
  .action(async (options) => {
    const { runCommand } = await import('./commands/run');
    await runCommand(options);
  });

// ===== 🏗️ 全局层 & 期次管理 =====

const iterationCmd = program
  .command('iteration')
  .alias('iter')
  .description('期次管理');

iterationCmd
  .command('create')
  .alias('cr')
  .description('创建新期次（加工车间：素材区 + 各端需求文档 + 功能单元目录）')
  .requiredOption('-n, --name <name>', '期次名称，如: 期次-2026-Q3')
  .option('-p, --platforms <list>', '涉及端: web,h5,miniapp,backend (逗号分隔)', 'web')
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
  .description('冻结期次，禁止修改需求（风险未裁决/待确认未决时拦闸）')
  .requiredOption('-n, --name <name>', '期次名称')
  .option('--force', '跳过冻结门禁（风险未裁决/待确认未决）', false)
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
  .command('adopt')
  .description('收养功能单元进正典（新增血缘：迭代层 → 全局层）')
  .requiredOption('-i, --iteration <name>', '期次名称')
  .requiredOption('-p, --platform <platform>', '功能单元所在端: web/h5/miniapp/backend')
  .requiredOption('-f, --feature <name>', '功能单元目录名')
  .option('-pj, --project <project>', '所属项目', 'default')
  .action(async (options) => {
    const { reqAdoptCommand } = await import('./commands/requirement');
    await reqAdoptCommand(options);
  });

reqCmd
  .command('change')
  .description('标记正典需求变更（冻结时自动回流版本演进）')
  .requiredOption('-r, --req <id>', '需求 ID，如: REQ-001')
  .requiredOption('-i, --iteration <name>', '实施变更的期次')
  .option('-d, --desc <desc>', '变更说明')
  .action(async (options) => {
    const { reqChangeCommand } = await import('./commands/requirement');
    await reqChangeCommand(options);
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
  .description('需求全面体检 — 骨架/质量/图建议/风险初筛/增量对照 五维评估')
  .option('-i, --iteration <name>', '指定期次')
  .option('-s, --snippet <text>', '直接传入需求片段')
  .option('-f, --file <path>', '读取需求文件')
  .option('-p, --platform <name>', '端名（配合 -i -u 定位单元文档）')
  .option('-u, --unit <name>', '功能单元目录名（配合 -i -p 定位单元文档）')
  .action(async (options) => {
    const { checkCommand } = await import('./commands/check');
    await checkCommand(options);
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
    const { initCommand } = await import('./commands/init');
    await initCommand();
  });

program.parse();
