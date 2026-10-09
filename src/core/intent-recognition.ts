/**
 * 意图识别引擎 — SpecProt 产品底座
 *
 * 产品经理用自然语言说需求，AI 自动匹配最合适的命令。
 * 例如："帮我检查这个需求" → specprot check
 *      "生成原型" → specprot prototype
 *      "这个期次冻结" → specprot iteration freeze
 */

// ============================================================
// 类型定义
// ============================================================

/** 产品侧意图类型 */
export type ProductIntent =
  | 'analyze'           // 端级分析（AI 接力）
  | 'slice'             // 端内功能切分（AI 接力）
  | 'convert'           // 素材转换
  | 'check'             // 需求检查分析
  | 'prototype'         // 生成 HTML 原型
  | 'iteration_create'  // 创建期次
  | 'iteration_list'    // 查看期次
  | 'iteration_freeze'  // 冻结期次
  | 'export_docs'       // 需求快照转 Word/HTML/PDF
  | 'resolve'           // 风险裁决（清零冻结门禁）
  | 'deepen'            // 需求深化（AI 接力）
  | 'assets'            // 资产生成（AI 接力）
  | 'schemes'           // 方案分叉（AI 接力）
  | 'req_new'           // 新建需求
  | 'req_list'          // 查看需求
  | 'req_status'        // 更新需求状态
  | 'req_link'          // 关联需求到期次
  | 'design'            // 设计系统管理
  | 'init'              // 项目初始化
  | 'help'              // 帮助
  | 'unknown';          // 未识别

/** 意图匹配结果 */
export interface IntentResult {
  intent: ProductIntent;
  command: string;
  confidence: number;
  priority: number;
  matchedTriggers: string[];
  extractedParams: Record<string, string>;
}

/** 命令映射 */
export interface CommandMapping {
  id: string;
  intent: ProductIntent;
  priority: number;
  triggers: string[];
  patterns: string[];
  description: string;
  example: string;
}

// ============================================================
// 产品侧命令映射表
// ============================================================

const PRODUCT_COMMAND_MAPPINGS: CommandMapping[] = [
  // —— 素材工作流（v0.2.0：convert/analyze/slice 新流程）——
  {
    id: 'analyze',
    intent: 'analyze',
    priority: 102,
    triggers: ['端级分析', '逐端分析', '提炼需求', '从素材提炼', '分析素材',
               '生成需求文档', '需求提炼', '端需求', '端的需求'],
    patterns: ['分析(.+)端需求', '提炼(.+)端需求', '(.+)端需求分析', '分析(.+)端素材',
               '分析(.+)端', '(.+)端需求'],
    description: '端级分析 — 从端素材提炼完整需求文档（AI 接力）',
    example: 'specprot analyze -n "任务" -p web',
  },
  {
    id: 'slice',
    intent: 'slice',
    priority: 101,
    triggers: ['切分功能', '切片', '拆功能', '功能单元', '划分功能',
               '按功能拆', '拆分功能', '切分', '按功能'],
    patterns: ['切分(.+)功能', '(.*)按功能切', '(.+)功能单元(.+)', '拆分(.+)功能'],
    description: '端内功能切分 — 端级需求切分为功能单元（AI 接力 + 素材溯源）',
    example: 'specprot slice -n "任务" -p web',
  },
  {
    id: 'convert',
    intent: 'convert',
    priority: 99,
    triggers: ['转换素材', '素材转换', '转成文档', '转换文件', '转 md',
               '转换格式', '整理素材', '转换'],
    patterns: ['转换(.+)素材', '(.+)素材转换(.+)', '把(.+)转成'],
    description: '素材转换 — docx/pdf/xlsx → md（录音提示转写，图片建索引）',
    example: 'specprot task convert -n "任务"',
  },
  // —— 分析检查 ——
  {
    id: 'check',
    intent: 'check',
    priority: 100,
    triggers: ['检查', '分析', '看看这个需求', '有什么问题', '缺什么', '少了什么',
               '帮我看看', '核查', '审阅', '审视', '查看一下'],
    patterns: ['检查(.+)需求', '分析(.+)需求', '看看(.+)有没有问题', '(.+)有什么遗漏'],
    description: '需求完整性检查 — 检测模糊表述、缺失场景、冲突规则',
    example: 'specprot check',
  },
  // —— 原型生成 ——
  {
    id: 'prototype',
    intent: 'prototype',
    priority: 98,
    triggers: ['原型', '生成页面', '看看效果', '长什么样', '交互效果',
               '页面草稿', 'mockup', '预览', '可交互'],
    patterns: ['生成(.+)原型', '画(.+)原型', '(.+)长什么样', '(.+)原型(.+)'],
    description: 'HTML 交互原型 — 从需求文档生成可交互的原型页面',
    example: 'specprot prototype',
  },
  // —— 期次管理 ——
  {
    id: 'iteration-create',
    intent: 'iteration_create',
    priority: 78,
    triggers: ['创建期次', '新建迭代', '新迭代', '开始一期', '开一期',
               '创建迭代', '新建期次', '开始新版本'],
    patterns: ['创建期次[：:\s]*([^,，\s]+)', '新建期次[：:\s]*([^,，\s]+)', '创建(.+)期次', '新建(.+)迭代', '开(.+)期'],
    description: '创建期次 — 创建新的产品迭代周期',
    example: 'specprot iteration create --name "期次-2026-Q3"',
  },
  {
    id: 'iteration-list',
    intent: 'iteration_list',
    priority: 75,
    triggers: ['期次列表', '所有期次', '有哪些期次', '迭代列表',
               '看看期次', '正在进行的期次'],
    patterns: ['查看(.+)期次', '列出(.+)期次', '(.+)期次(.+)列表'],
    description: '期次列表 — 查看所有期次和状态',
    example: 'specprot iteration list',
  },
  {
    id: 'iteration-freeze',
    intent: 'iteration_freeze',
    priority: 72,
    triggers: ['冻结', '锁定', '封版', '定版', '需求冻结', '不许改了',
               'freeze', '锁定期次', '冻结需求'],
    patterns: ['冻结期次[：:\s]*([^,，\s]+)', '冻结(.+)期次', '锁定(.+)期次', '(.+)封版'],
    description: '冻结期次 — 锁定需求，生成开发 Spec',
    example: 'specprot iteration freeze --name "期次-2026-Q3"',
  },
  // —— 需求管理 ——
  {
    id: 'export',
    intent: 'export_docs',
    priority: 66,
    triggers: ['转格式', '转成 Word', '转成 word', '导出 Word', '转 PDF', '转 pdf',
               '转 docx', '转换文档', '格式转换', '转word', '转成PDF'],
    patterns: ['(.+)转成 Word', '(.+)转成 word', '导出(.+)Word', '转换(.+)文档格式'],
    description: '格式转换 — 已导出的需求快照转 Word/HTML/PDF（先 freeze 后 export）',
    example: 'specprot export -i 期次-2026-Q3 -f docx',
  },
  {
    id: 'resolve',
    intent: 'resolve',
    priority: 65,
    triggers: ['风险裁决', '裁决风险', '风险怎么处理', '待裁决', '裁决'],
    patterns: ['裁决(.+)风险', '(.+)风险裁决', '裁决(.+)'],
    description: '风险裁决 — 逐条裁决 RISK 待裁决与 CLARIFY 未决，清零冻结门禁',
    example: 'specprot resolve -i 期次-2026-Q3 -p web -f 预订',
  },
  {
    id: 'deepen',
    intent: 'deepen',
    priority: 64,
    triggers: ['深化需求', '深挖', '深化', '需求深化', '评审包', '加深'],
    patterns: ['深化(.+)需求', '(.+)需求深化'],
    description: '需求深化 — OUTLINE 结构契约 → 评审包（RISK + CLARIFY + REBOUND）',
    example: 'specprot deepen -i 期次-2026-Q3 -p web -f 预订',
  },
  {
    id: 'assets',
    intent: 'assets',
    priority: 63,
    triggers: ['生成图表', '生成资产', '画图', '生成图', '资产生成', '生成架构图'],
    patterns: ['(.+)生成图表', '给(.+)画图', '(.+)生成资产'],
    description: '资产生成 — 图（Mermaid）+ 原型 HTML + ASSETS.yaml 注册表',
    example: 'specprot assets -i 期次-2026-Q3 -p web -f 预订',
  },
  {
    id: 'schemes',
    intent: 'schemes',
    priority: 62,
    triggers: ['方案对比', '多方案', '方案分叉', '出几个方案', '多个方案', '方案比较'],
    patterns: ['(.+)方案对比', '(.+)出几个方案', '(.+)方案分叉'],
    description: '方案分叉 — 多案对比 + 推荐圈选（冻结时推荐进正文，其余进备选附录）',
    example: 'specprot schemes -i 期次-2026-Q3 -p web -f 预订',
  },
  {
    id: 'req-new',
    intent: 'req_new',
    priority: 70,
    triggers: ['新建需求', '添加需求', '新需求', '加一个需求', '写需求',
               '创建需求', '加需求', '新建', '添加功能', '新功能',
               '创建一个'],
    patterns: ['新建需求[：:\s]*([^,，\s]+)', '新建(.+)需求', '添加(.+)需求', '写(.+)需求', '创建(.+)需求',
               '新增(.+)功能', '加一个(.+)需求'],
    description: '新建需求 — 创建需求并存入全局层',
    example: 'specprot req new --name "会议室预订功能"',
  },
  {
    id: 'req-list',
    intent: 'req_list',
    priority: 68,
    triggers: ['需求列表', '所有需求', '查看需求', '有哪些需求',
               '排期了哪些'],
    patterns: ['查看(.+)需求', '列出(.+)需求', '(.+)有哪些需求'],
    description: '需求列表 — 查看全量或按期次筛选的需求',
    example: 'specprot req list',
  },
  {
    id: 'req-status',
    intent: 'req_status',
    priority: 65,
    triggers: ['状态更新', '改状态', '标记为', '设为', '评审通过',
               '已通过', '废弃', '暂缓', '通过评审', '状态改为',
               '已交付', '完成了'],
    patterns: ['(.+)状态(.+)改为', '把(.+)标记为(.+)', '(.+)评审通过', '(.+)已通过'],
    description: '更新需求状态 — 草稿→评审中→已通过→已冻结→开发中→已交付',
    example: 'specprot req status --req REQ-001 --status "评审中"',
  },
  {
    id: 'req-link',
    intent: 'req_link',
    priority: 62,
    triggers: ['关联', '放入', '加入', '排入', '纳入', '放到',
               '排期', '安排到'],
    patterns: ['把(.+)放入(.+)期次', '将(.+)排到(.+)', '(.+)关联(.+)'],
    description: '关联需求到期次 — 将全局需求纳入迭代',
    example: 'specprot req link --req REQ-001 --iteration "期次-2026-Q3"',
  },
  // —— 设计系统 ——
  {
    id: 'design',
    intent: 'design',
    priority: 55,
    triggers: ['设计系统', '颜色', '字体', '组件库', '样式', '主题',
               'design system', '配色'],
    patterns: ['配置(.+)设计系统', '(.+)设计系统(.+)', '提取(.+)样式'],
    description: '设计系统管理 — 配置颜色/字体/组件/间距',
    example: 'specprot design',
  },
  // —— 初始化 ——
  {
    id: 'init',
    intent: 'init',
    priority: 85,
    triggers: ['初始化', '开始使用', '安装', '配置项目', 'setup'],
    patterns: ['初始化(.+)项目', '开始使用(.+)', '配置(.+)项目', '初始化'],
    description: '项目初始化 — 创建全局层 + 注入 Slash Commands',
    example: 'specprot init',
  },
  // —— 帮助 ——
  {
    id: 'help',
    intent: 'help',
    priority: 40,
    triggers: ['帮助', '怎么用', '有哪些命令', '不会用', '教程',
               'help', '使用说明'],
    patterns: ['帮助', '怎么用', '有哪些命令', '教程'],
    description: '帮助 — 查看所有可用命令',
    example: 'specprot --help',
  },
];

// ============================================================
// 意图识别引擎
// ============================================================

/**
 * 从产品经理的自然语言输入中识别意图
 */
export function recognizeProductIntent(input: string): IntentResult[] {
  const results: IntentResult[] = [];
  const inputLower = input.toLowerCase();

  for (const mapping of PRODUCT_COMMAND_MAPPINGS) {
    let totalScore = 0;
    const matched: string[] = [];

    // 1. 关键词直接匹配（权重 25）
    for (const trigger of mapping.triggers) {
      if (input.includes(trigger) || inputLower.includes(trigger.toLowerCase())) {
        totalScore += 25;
        matched.push(`关键词:"${trigger}"`);
      }
    }

    // 2. 正则模式匹配（权重 35）
    for (const pattern of mapping.patterns) {
      try {
        const regex = new RegExp(pattern);
        if (regex.test(input)) {
          totalScore += 35;
          matched.push(`模式:"${pattern}"`);
        }
      } catch {
        // 忽略无效正则
      }
    }

    // 3. 优先级加成（权重 0.2）
    totalScore += mapping.priority * 0.2;

    if (totalScore > 0) {
      const confidence = Math.min(100, Math.round(totalScore));
      const extractedParams = extractProductParams(input, mapping);

      results.push({
        intent: mapping.intent,
        command: mapping.id,
        confidence,
        priority: mapping.priority,
        matchedTriggers: matched,
        extractedParams,
      });
    }
  }

  return results.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.priority - a.priority;
  });
}

/**
 * 提取参数：需求名称、期次名称、状态等
 */
function extractProductParams(input: string, mapping: CommandMapping): Record<string, string> {
  const params: Record<string, string> = {};

  // 提取引号内容（需求名称、期次名称）
  const quoted = input.match(/["""]([^"""]+)[""']/);
  if (quoted) {
    if (!params.name) params.name = quoted[1];
  }

  // 提取期次名：优先紧凑形「期次-XXX / 期次XXX」（字母数字连字符，
  // 避免「期次-D的需求转成」被整段吞掉），再兜底旧正则
  const iterMatch =
    input.match(/期次[-：:\s]*([A-Za-z0-9_-]+)/) ||
    input.match(/期次[：:\s]*([^\s,，]+)/);
  if (iterMatch) {
    params.iteration = iterMatch[1];
  }

  // 提取需求 ID（REQ-XXX 格式）
  const reqMatch = input.match(/REQ-\d+/i);
  if (reqMatch) {
    params.req = reqMatch[0].toUpperCase();
  }

  // 提取状态
  const statusKeywords = ['草稿', '评审中', '评审通过', '已通过', '已冻结', '开发中', '已交付', '完成了', '已废弃', '暂缓'];
  for (const s of statusKeywords) {
    if (input.includes(s)) {
      params.status = s;
      break;
    }
  }

  // 从模式中提取参数
  for (const pattern of mapping.patterns) {
    try {
      const regex = new RegExp(pattern);
      const match = input.match(regex);
      if (match) {
        if (match[1] && !params.name) params.name = match[1].trim();
        if (match[2] && !params.target) params.target = match[2].trim();
      }
    } catch {
      // 忽略
    }
  }

  return params;
}

/**
 * 获取置信度级别
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 70) return 'high';
  if (confidence >= 45) return 'medium';
  return 'low';
}

/**
 * 获取所有命令映射
 */
export function getAllProductMappings(): CommandMapping[] {
  return [...PRODUCT_COMMAND_MAPPINGS];
}

/**
 * 获取意图对应的友好标签
 */
export function getIntentLabel(intent: ProductIntent): string {
  const labels: Record<ProductIntent, string> = {
    analyze: '🔍 端级需求分析',
    slice: '🔪 端内功能切分',
    convert: '🔧 素材转换',
    check: '🔍 需求检查分析',
    prototype: '🎨 HTML 原型生成',
    iteration_create: '📅 创建期次',
    iteration_list: '📋 查看期次',
    iteration_freeze: '🔒 冻结期次',
    export_docs: '📄 转成 Word/PDF',
    resolve: '⚖️ 风险裁决',
    deepen: '📖 需求深化',
    assets: '🎨 资产生成',
    schemes: '🔀 方案分叉',
    req_new: '📝 新建需求',
    req_list: '📋 查看需求',
    req_status: '🏷️ 更新状态',
    req_link: '🔗 关联期次',
    design: '🎨 设计系统',
    init: '🚀 项目初始化',
    help: '💡 帮助',
    unknown: '❓ 未识别',
  };
  return labels[intent] || intent;
}
