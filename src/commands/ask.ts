/**
 * /spec — 产品经理自然语言智能入口
 *
 * 产品经理不需要记住命令，直接说人话：
 *   specprot ask "帮我看看这个需求有什么问题"
 *   specprot ask "生成原型看看效果"
 *   specprot ask "冻结这个期次"
 */

import { recognizeProductIntent, getConfidenceLevel, getIntentLabel, getAllProductMappings } from '../core/intent-recognition';

export async function askCommand(input: string): Promise<void> {
  if (!input || !input.trim()) {
    showUsage();
    return;
  }

  console.log(`🔍 正在理解你的意图...\n`);

  const results = recognizeProductIntent(input);

  if (results.length === 0) {
    showNoMatch(input);
    return;
  }

  const best = results[0];
  const level = getConfidenceLevel(best.confidence);

  if (level === 'high') {
    await executeHigh(best, input);
  } else if (level === 'medium') {
    showMediumConfidence(results.slice(0, 3));
  } else {
    showLowConfidence(results.slice(0, 3), input);
  }
}

function showNoMatch(input: string): void {
  console.log(`🤔 对 "${input}" 没有匹配到合适的命令。`);
  console.log('');
  console.log('你可以这样说：');
  console.log('  - "检查这个需求的完整性"');
  console.log('  - "生成原型看看长什么样"');
  console.log('  - "新建一个需求"');
  console.log('  - "查看期次列表"');
  console.log('  - "冻结当前期次"');
  console.log('  - "生成评审报告"');
}

function showUsage(): void {
  console.log('🔍 SpecProt 智能入口');
  console.log('');
  console.log('用法: specprot ask "<自然语言描述>"');
  console.log('');
  console.log('示例:');
  console.log('  specprot ask "帮我看看这个需求缺少什么"');
  console.log('  specprot ask "生成原型看看效果"');
  console.log('  specprot ask "新建一个会议室预订的需求"');
  console.log('  specprot ask "创建期次 Q3，目标上线会议室"');
  console.log('  specprot ask "这个功能要哪些图，生成图资产"');
  console.log('  specprot ask "冻结期次-2026-Q3"');
  console.log('  specprot ask "需求 REQ-001 评审通过"');
}

/** 意图 → 必需参数（缺任一则输出 [SPECPROT_NEEDS_INFO] 交互式提示，不执行） */
const REQUIRED_PARAMS: Record<string, string[]> = {
  convert: ['iteration'],
  analyze: ['iteration', 'platform'],
  slice: ['iteration', 'platform'],
  'iteration-create': ['name'],
  'iteration-freeze': ['name'],
  'req-new': ['name'],
  'req-status': ['req', 'status'],
  'req-link': ['req', 'iteration'],
};

/** 参数中文名（提示用） */
const PARAM_LABELS: Record<string, string> = {
  name: '名称（期次/需求名）',
  iteration: '期次名',
  req: '需求 ID（如 REQ-001）',
  status: '状态（草稿/评审中/已通过/已冻结/开发中/已交付/已废弃/暂缓）',
  platform: '端名（web/h5/miniapp/backend）',
  feature: '功能单元名',
};

/** 高置信度：直接执行（与 SpecCore ask 引擎一致） */
async function executeHigh(result: ReturnType<typeof recognizeProductIntent>[0], input: string): Promise<void> {
  const params: Record<string, any> = { ...result.extractedParams };

  // 补充提取：端名（web/h5/miniapp/backend）
  const pm = input.match(/(web|h5|miniapp|backend)/i);
  if (pm) params.platform = pm[1].toLowerCase();

  // iteration-create / iteration-freeze 的 name 兜底（"创建期次 Q3" → iteration=Q3 → name=Q3）
  if (!params.name) params.name = params.iteration;

  const required = REQUIRED_PARAMS[result.command] || [];
  const missing = required.filter((k) => !params[k]);
  if (missing.length > 0) {
    showNeedsInfo(result, missing);
    return;
  }

  console.log(`✅ 我理解你想：${getIntentLabel(result.intent)}（置信度 ${result.confidence}%）`);
  console.log(`🚀 正在执行 specprot ${result.command} ...`);
  console.log('');
  await executeIntent(result.command, params);
}

/** 参数缺失：交互式提示，请用户/AI 补充后重试 */
function showNeedsInfo(result: ReturnType<typeof recognizeProductIntent>[0], missing: string[]): void {
  console.log('[SPECPROT_NEEDS_INFO]');
  console.log(`我理解你想：${getIntentLabel(result.intent)}，但还缺参数：`);
  for (const k of missing) {
    console.log(`   · ${PARAM_LABELS[k] || k}`);
  }
  console.log('');
  console.log(`请补充后重试，例如: specprot ask "冻结期次-2026-Q3"`);
  console.log(`或直接执行: specprot ${result.command} --help 查看完整参数`);
  console.log('[SPECPROT_NEEDS_INFO_END]');
}


/** 意图 → 命令处理器（CLI 进程内直接调用，不 spawn 子进程） */
async function executeIntent(id: string, p: Record<string, any>): Promise<void> {
  switch (id) {
    case 'convert': {
      const { convertCommand } = await import('./convert');
      await convertCommand({ iteration: p.iteration, platform: p.platform });
      break;
    }
    case 'analyze': {
      const { analyzeCommand } = await import('./analyze');
      await analyzeCommand({ iteration: p.iteration, platform: p.platform });
      break;
    }
    case 'slice': {
      const { sliceCommand } = await import('./slice');
      await sliceCommand({ iteration: p.iteration, platform: p.platform });
      break;
    }
    case 'check': {
      const { checkCommand } = await import('./check');
      await checkCommand({ iteration: p.iteration });
      break;
    }
    case 'prototype': {
      const { prototypeCommand } = await import('./prototype');
      await prototypeCommand({ iteration: p.iteration });
      break;
    }
    case 'design': {
      const { designCommand } = await import('./design');
      await designCommand({});
      break;
    }
    case 'init': {
      const { initCommand } = await import('./init');
      await initCommand();
      break;
    }
    case 'iteration-create': {
      const { iterationCreateCommand } = await import('./iteration');
      await iterationCreateCommand({ name: p.name });
      break;
    }
    case 'iteration-list': {
      const { iterationListCommand } = await import('./iteration');
      await iterationListCommand();
      break;
    }
    case 'iteration-freeze': {
      const { iterationFreezeCommand } = await import('./iteration');
      await iterationFreezeCommand({ name: p.name });
      break;
    }
    case 'req-new': {
      const { reqNewCommand } = await import('./requirement');
      await reqNewCommand({ name: p.name, project: 'default', iteration: p.iteration });
      break;
    }
    case 'req-list': {
      const { reqListCommand } = await import('./requirement');
      await reqListCommand(p.iteration);
      break;
    }
    case 'req-status': {
      const { reqStatusCommand } = await import('./requirement');
      const alias: Record<string, string> = { '评审通过': '已通过', '完成了': '已交付' };
      await reqStatusCommand({ req: p.req, status: alias[p.status] || p.status });
      break;
    }
    case 'req-link': {
      const { reqLinkCommand } = await import('./requirement');
      await reqLinkCommand({ req: p.req, iteration: p.iteration });
      break;
    }
    default:
      console.log(`⚠️ 「${id}」暂未接入自动执行，请直接用命令: specprot ${id}`);
  }
}


function showMediumConfidence(results: ReturnType<typeof recognizeProductIntent>): void {
  console.log('🔍 你的输入可能有多重含义：');
  console.log('');
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(`  ${i + 1}. ${getIntentLabel(r.intent)} (置信度: ${r.confidence}%) → specprot ${r.command}`);
  }
  console.log('');
  console.log('[SPECPROT_NEEDS_INFO]');
  console.log('请把话说得更明确（带上对象名与参数），或直接执行:');
  for (const r of results) {
    console.log(`   · specprot ${r.command} --help`);
  }
  console.log('[SPECPROT_NEEDS_INFO_END]');
}

function showLowConfidence(
  results: ReturnType<typeof recognizeProductIntent>,
  input: string
): void {
  console.log(`🤔 对 "${input}" 的识别置信度较低。`);

  if (results.length > 0) {
    console.log('');
    console.log('你可能想说的是：');
    for (const r of results) {
      console.log(`  - ${getIntentLabel(r.intent)} (specprot ${r.command})`);
    }
  }

  console.log('');
  console.log('你可以这样说：');
  console.log('  - "检查这个需求的完整性"');
  console.log('  - "生成原型看看长什么样"');
  console.log('  - "新建一个需求"');
  console.log('  - "查看期次列表"');
  console.log('  - "冻结当前期次"');
}

/**
 * 显示所有可用命令（给 help 用）
 */
export function showAllIntents(): void {
  const mappings = getAllProductMappings();
  console.log('📋 SpecProt 支持的意图类型：\n');

  // 按优先级分组
  const groups: Record<string, typeof mappings> = {
    '🚀 流水线': [],
    '📅 期次管理': [],
    '📝 需求与辅助': [],
  };
  for (const m of mappings) {
    if (['convert', 'analyze', 'slice'].includes(m.id)) groups['🚀 流水线'].push(m);
    else if (['iteration-create', 'iteration-list', 'iteration-freeze'].includes(m.id))
      groups['📅 期次管理'].push(m);
    else groups['📝 需求与辅助'].push(m);
  }
  for (const [group, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    console.log(`${group}`);
    for (const item of items) {
      console.log(`  ${getIntentLabel(item.intent).padEnd(20)} → specprot ${item.id}`);
    }
    console.log('');
  }
}
