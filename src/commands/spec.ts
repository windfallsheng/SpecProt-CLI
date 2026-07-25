/**
 * /spec — 产品经理自然语言智能入口
 *
 * 产品经理不需要记住命令，直接说人话：
 *   specprot spec "帮我看看这个需求有什么问题"
 *   specprot spec "生成原型看看效果"
 *   specprot spec "冻结这个期次"
 */

import { recognizeProductIntent, getConfidenceLevel, getIntentLabel, getAllProductMappings } from '../core/intent-recognition';

export async function specCommand(input: string): Promise<void> {
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
    showHighConfidence(best);
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
  console.log('  - "画个流程图"');
  console.log('  - "生成评审报告"');
}

function showUsage(): void {
  console.log('🔍 SpecProt 智能入口');
  console.log('');
  console.log('用法: specprot spec "<自然语言描述>"');
  console.log('');
  console.log('示例:');
  console.log('  specprot spec "帮我看看这个需求缺少什么"');
  console.log('  specprot spec "生成原型看看效果"');
  console.log('  specprot spec "新建一个会议室预订的需求"');
  console.log('  specprot spec "创建期次 Q3，目标上线会议室"');
  console.log('  specprot spec "这个需求有哪些字段，画个数据模型"');
  console.log('  specprot spec "冻结期次-2026-Q3"');
  console.log('  specprot spec "需求 REQ-001 评审通过"');
}

function showHighConfidence(result: ReturnType<typeof recognizeProductIntent>[0]): void {
  console.log(`✅ 我理解你想：${getIntentLabel(result.intent)}`);
  console.log(`   置信度: ${result.confidence}% | 匹配命令: specprot ${result.command}`);
  console.log('');

  // 显示提取的参数
  const params = result.extractedParams;
  if (Object.keys(params).length > 0) {
    console.log('📝 已提取参数:');
    for (const [key, value] of Object.entries(params)) {
      console.log(`   ${key}: ${value}`);
    }
    console.log('');
  }

  // 构建执行命令预览
  let cmd = `specprot ${result.command}`;
  if (params.name) cmd += ` --name "${params.name}"`;
  if (params.iteration) cmd += ` --iteration "${params.iteration}"`;
  if (params.req) cmd += ` --req ${params.req}`;
  if (params.status) cmd += ` --status "${params.status}"`;

  console.log('📍 建议执行:');
  console.log(`   $ ${cmd}`);
  console.log('');
  console.log('💡 在 AI 工具中可以直接用 /specprot-check 等 Slash Command');
}

function showMediumConfidence(results: ReturnType<typeof recognizeProductIntent>): void {
  console.log('🔍 你的输入可能有多重含义：');
  console.log('');

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(`  ${i + 1}. ${getIntentLabel(r.intent)} (置信度: ${r.confidence}%) → specprot ${r.command}`);
  }

  console.log('');
  console.log('💡 请输入序号选择，或补充更多信息后重试。');
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
    '🔍 分析检查': [],
    '🎨 可视化生成': [],
    '📅 期次管理': [],
    '📝 需求管理': [],
    '📤 交付管理': [],
    '🛠️ 工具': [],
  };

  for (const m of mappings) {
    if (['check'].includes(m.id)) groups['🔍 分析检查'].push(m);
    else if (['prototype', 'flow', 'data-model', 'state', 'storymap', 'panorama'].includes(m.id))
      groups['🎨 可视化生成'].push(m);
    else if (['iteration-create', 'iteration-list', 'iteration-freeze'].includes(m.id))
      groups['📅 期次管理'].push(m);
    else if (['req-new', 'req-list', 'req-status', 'req-link', 'review'].includes(m.id))
      groups['📝 需求管理'].push(m);
    else if (['export', 'handover', 'diff', 'impact'].includes(m.id))
      groups['📤 交付管理'].push(m);
    else groups['🛠️ 工具'].push(m);
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
