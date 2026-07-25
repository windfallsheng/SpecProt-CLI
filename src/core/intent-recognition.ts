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
  | 'check'             // 需求检查分析
  | 'prototype'         // 生成 HTML 原型
  | 'review'            // 生成评审报告
  | 'flow'              // 生成流程图
  | 'data_model'        // 生成数据模型图
  | 'state_diagram'     // 生成状态机图
  | 'story_map'         // 生成用户故事地图
  | 'panorama'          // 生成需求全景图
  | 'iteration_create'  // 创建期次
  | 'iteration_list'    // 查看期次
  | 'iteration_freeze'  // 冻结期次
  | 'req_new'           // 新建需求
  | 'req_list'          // 查看需求
  | 'req_status'        // 更新需求状态
  | 'req_link'          // 关联需求到期次
  | 'design'            // 设计系统管理
  | 'init'              // 项目初始化
  | 'diff'              // 变更检测
  | 'impact'            // 变更影响分析
  | 'export'            // 导出开发 Spec
  | 'handover'          // 生成交接文档
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
  // —— 流程图 ——
  {
    id: 'flow',
    intent: 'flow',
    priority: 95,
    triggers: ['流程图', '流程', '操作流程', '步骤', '用户路径', '业务流程',
               '画流程', '业务流转', '流转图'],
    patterns: ['生成(.+)流程图', '画(.+)流程', '(.+)的流程(.+)', '(.+)操作步骤(.+)'],
    description: '用户/业务流程图 — 自动选择最适合的流程图类型',
    example: 'specprot flow',
  },
  // —— 数据模型 ——
  {
    id: 'data-model',
    intent: 'data_model',
    priority: 92,
    triggers: ['数据模型', '字段', '数据结构', 'ER图', '实体关系', '有哪些字段',
               '数据表', '属性'],
    patterns: ['生成(.+)数据模型', '(.+)有哪些字段', '(.+)数据结构'],
    description: '数据模型图 — 从字段描述生成 ER 图',
    example: 'specprot data-model',
  },
  // —— 状态机 ——
  {
    id: 'state',
    intent: 'state_diagram',
    priority: 88,
    triggers: ['状态图', '状态流转', '状态变化', '状态机', '状态转移',
               '有哪些状态', '状态管理'],
    patterns: ['生成(.+)状态图', '(.+)状态(.+)流转', '(.+)有哪些状态'],
    description: '状态机图 — 从状态描述生成状态流转图',
    example: 'specprot state',
  },
  // —— 评审 ——
  {
    id: 'review',
    intent: 'review',
    priority: 85,
    triggers: ['评审', '生成评审', '评审报告', '准备评审', '评审材料',
               'review', '风险评估', '风险分析'],
    patterns: ['生成(.+)评审', '准备(.+)评审', '(.+)评审报告'],
    description: '需求评审报告 — 生成完整性、一致性、风险评估',
    example: 'specprot review',
  },
  // —— 需求全景图 ——
  {
    id: 'panorama',
    intent: 'panorama',
    priority: 82,
    triggers: ['全景图', '总览', '全局视图', '模块关系', '依赖关系',
               '整体看', '全貌', '关系图'],
    patterns: ['生成(.+)全景图', '(.+)模块(.+)关系', '(.+)全景'],
    description: '需求全景图 — 模块依赖关系和需求结构总览',
    example: 'specprot panorama',
  },
  // —— 用户故事地图 ——
  {
    id: 'storymap',
    intent: 'story_map',
    priority: 80,
    triggers: ['故事地图', '用户故事', '故事拆分', '用户场景', '用户旅程',
               'user story', '故事卡片'],
    patterns: ['生成(.+)故事地图', '(.+)用户故事(.+)', '拆分(.+)故事'],
    description: '用户故事地图 — 角色 × 优先级 × 迭代',
    example: 'specprot storymap',
  },
  // —— 期次管理 ——
  {
    id: 'iteration-create',
    intent: 'iteration_create',
    priority: 78,
    triggers: ['创建期次', '新建迭代', '新迭代', '开始一期', '开一期',
               '创建迭代', '新建期次', '开始新版本'],
    patterns: ['创建(.+)期次', '新建(.+)迭代', '开(.+)期'],
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
    patterns: ['冻结(.+)期次', '锁定(.+)期次', '(.+)封版', '冻结(.+)'],
    description: '冻结期次 — 锁定需求，生成开发 Spec',
    example: 'specprot iteration freeze --name "期次-2026-Q3"',
  },
  // —— 需求管理 ——
  {
    id: 'req-new',
    intent: 'req_new',
    priority: 70,
    triggers: ['新建需求', '添加需求', '新需求', '加一个需求', '写需求',
               '创建需求', '加需求', '新建', '添加功能', '新功能',
               '创建一个'],
    patterns: ['新建(.+)需求', '添加(.+)需求', '写(.+)需求', '创建(.+)需求',
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
  // —— 导出与交接 ——
  {
    id: 'export',
    intent: 'export',
    priority: 60,
    triggers: ['导出', '生成开发文档', '给开发的', '开发Spec', '输出Spec',
               '交接', '交付', '转给开发'],
    patterns: ['导出(.+)Spec', '生成(.+)开发文档', '给开发(.+)'],
    description: '导出开发 Spec — 从需求生成 frontend/REQ.md',
    example: 'specprot export',
  },
  {
    id: 'handover',
    intent: 'handover',
    priority: 58,
    triggers: ['交接文档', '交接材料', '交接清单', '移交给'],
    patterns: ['生成(.+)交接', '准备(.+)交接', '(.+)交接文档'],
    description: '交接文档 — 给开发的完整需求材料包',
    example: 'specprot handover',
  },
  // —— 变更管理 ——
  {
    id: 'diff',
    intent: 'diff',
    priority: 52,
    triggers: ['对比', '差异', '变化', '改了哪里', '和之前比',
               'diff', '变更对比', '修改了哪些'],
    patterns: ['对比(.+)变化', '(.+)和(.+)差异', '(.+)改了(.+)'],
    description: '变更对比 — 检测需求变更并展示 diff',
    example: 'specprot diff',
  },
  {
    id: 'impact',
    intent: 'impact',
    priority: 50,
    triggers: ['影响', '影响范围', '改了影响', '影响分析',
               '会影响哪些', '波及'],
    patterns: ['分析(.+)影响', '(.+)会影响(.+)', '查看(.+)影响范围'],
    description: '变更影响分析 — 分析需求变更影响哪些模块',
    example: 'specprot impact',
  },
  // —— 初始化 ——
  {
    id: 'init',
    intent: 'init',
    priority: 85,
    triggers: ['初始化', '开始使用', '安装', '配置项目', 'setup'],
    patterns: ['初始化(.+)项目', '开始使用(.+)', '配置(.+)项目'],
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

  // 提取期次名
  const iterMatch = input.match(/期次[：:\s]*(\S+)/);
  if (iterMatch) {
    params.iteration = iterMatch[1];
  }

  // 提取需求 ID（REQ-XXX 格式）
  const reqMatch = input.match(/REQ-\d+/i);
  if (reqMatch) {
    params.req = reqMatch[0].toUpperCase();
  }

  // 提取状态
  const statusKeywords = ['草稿', '评审中', '已通过', '已冻结', '开发中', '已交付', '已废弃', '暂缓'];
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
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'medium';
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
    check: '🔍 需求检查分析',
    prototype: '🎨 HTML 原型生成',
    review: '📋 需求评审报告',
    flow: '🔄 流程图生成',
    data_model: '📊 数据模型图',
    state_diagram: '🔀 状态机图',
    story_map: '🗺️ 用户故事地图',
    panorama: '🏗️ 需求全景图',
    iteration_create: '📅 创建期次',
    iteration_list: '📋 查看期次',
    iteration_freeze: '🔒 冻结期次',
    req_new: '📝 新建需求',
    req_list: '📋 查看需求',
    req_status: '🏷️ 更新状态',
    req_link: '🔗 关联期次',
    design: '🎨 设计系统',
    init: '🚀 项目初始化',
    diff: '📊 变更对比',
    impact: '💥 影响分析',
    export: '📤 导出 Spec',
    handover: '📦 交接文档',
    help: '💡 帮助',
    unknown: '❓ 未识别',
  };
  return labels[intent] || intent;
}
