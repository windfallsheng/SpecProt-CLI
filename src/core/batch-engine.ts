/**
 * 批量引擎 — SpecProt 批量处理
 *
 * 支持两种模式：
 *   1. 批量生成 — 扫描所有待处理任务，逐个生成初稿
 *   2. 批量分析 — 对所有任务进行完整性检查
 *
 * 产品经理的工作流：
 *   下午 → 把材料扔进各任务的 00-素材/
 *   晚上 → specprot batch 批量执行
 *   早上 → 查看各任务的产出，逐个精修
 */

import {
  listAllTasks,
  collectMaterials,
  updateTaskStatus,
  updateMaterialCount,
  TaskInfo,
  MaterialContext,
  Platform,
} from './task-manager';
import { pathExists, writeFile, readFile } from 'fs-extra';
import { join } from 'path';

// ============================================================
// 类型定义
// ============================================================

export interface BatchOptions {
  /** 只处理指定平台 */
  platforms?: Platform[];
  /** 只处理指定状态的任务 */
  status?: string;
  /** 只处理指定任务 */
  tasks?: string[];
  /** 执行动作: generate = 生成初稿, check = 完整性分析 */
  action: 'generate' | 'check' | 'both';
  /** 是否生成原型 */
  prototype?: boolean;
  /** 是否生成流程图 */
  flow?: boolean;
}

export interface BatchResult {
  taskName: string;
  success: boolean;
  action: string;
  summary: string;
  artifacts: string[];     // 生成物文件路径
  warnings: string[];      // 发现的问题
  duration: string;        // 耗时
}

export interface BatchReport {
  timestamp: string;
  totalTasks: number;
  completed: number;
  failed: number;
  skipped: number;
  results: BatchResult[];
}

// ============================================================
// 批量引擎
// ============================================================

/**
 * 执行批量处理
 */
export async function runBatch(options: BatchOptions): Promise<BatchReport> {
  const startTime = Date.now();

  // 1. 获取所有任务
  let tasks = await listAllTasks();

  // 2. 过滤
  if (options.tasks && options.tasks.length > 0) {
    tasks = tasks.filter(t => options.tasks!.includes(t.name));
  }
  if (options.status) {
    tasks = tasks.filter(t => t.status === options.status);
  }

  if (tasks.length === 0) {
    return {
      timestamp: new Date().toISOString(),
      totalTasks: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };
  }

  console.log(`\n🚀 批量处理开始 — ${tasks.length} 个任务\n`);

  const results: BatchResult[] = [];
  let completed = 0, failed = 0, skipped = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`[${i + 1}/${tasks.length}] ${task.name}...`);

    const taskStart = Date.now();

    try {
      const result = await processTask(task, options);
      results.push(result);

      if (result.success) {
        completed++;
        console.log(`  ✅ ${result.summary}`);
      } else {
        failed++;
        console.log(`  ❌ ${result.summary}`);
      }

      const duration = ((Date.now() - taskStart) / 1000).toFixed(1);
      result.duration = `${duration}s`;

    } catch (error) {
      failed++;
      results.push({
        taskName: task.name,
        success: false,
        action: options.action,
        summary: `错误: ${error}`,
        artifacts: [],
        warnings: [],
        duration: `${((Date.now() - taskStart) / 1000).toFixed(1)}s`,
      });
      console.log(`  ❌ 错误: ${error}`);
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  // 输出汇总
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 批量处理完成`);
  console.log(`   总任务: ${tasks.length} | 成功: ${completed} | 失败: ${failed} | 总耗时: ${totalDuration}s`);
  console.log(`${'='.repeat(50)}\n`);

  // 保存批量报告
  const reportPath = join(process.cwd(), '.speccore', 'batch-report.md');
  await saveBatchReport(results, reportPath);
  console.log(`📄 批量报告已保存: .speccore/batch-report.md`);

  return {
    timestamp: new Date().toISOString(),
    totalTasks: tasks.length,
    completed,
    failed,
    skipped,
    results,
  };
}

/**
 * 处理单个任务
 */
async function processTask(task: TaskInfo, options: BatchOptions): Promise<BatchResult> {
  const artifacts: string[] = [];
  const warnings: string[] = [];

  // 更新素材计数
  await updateMaterialCount(task.name);

  if (options.action === 'generate' || options.action === 'both') {
    // 1. 收集素材上下文
    const context = await collectMaterials(task.name);
    const materialCount = context.sources.length;

    if (materialCount === 0) {
      warnings.push('⚠️ 素材区为空，生成的初稿可能不完整');
    }

    // 2. 生成各端初稿
    const platforms = options.platforms || task.platforms || ['web'];

    for (const platform of platforms) {
      try {
        const draftContent = generateDraftContent(task.name, platform, context);
        const docPath = join(task.name, platform, 'REQUIREMENT.md');
        await updatePlatformDoc(task.name, platform, draftContent);
        artifacts.push(docPath);
      } catch (e) {
        warnings.push(`${platform} 端生成失败: ${e}`);
      }
    }

    // 3. 可选：生成原型和流程图（标记为待生成）
    if (options.prototype) {
      artifacts.push(`${task.name}/产出/prototype.md ← 待 AI 生成`);
    }
    if (options.flow) {
      artifacts.push(`${task.name}/产出/flowchart.md ← 待 AI 生成`);
    }

    // 4. 更新任务状态
    await updateTaskStatus(task.name, '📝 待精修');
  }

  if (options.action === 'check' || options.action === 'both') {
    // 检查各端文档完整性
    const platforms = options.platforms || task.platforms || ['web'];
    for (const platform of platforms) {
      const docPath = join(task.name, platform, 'REQUIREMENT.md');
      if (await pathExists(docPath)) {
        const content = await readFile(docPath, 'utf-8');
        const issues = quickCheck(content);
        warnings.push(...issues.map(i => `${platform} 端: ${i}`));
      }
    }
  }

  const summary = options.action === 'generate'
    ? `已生成 ${artifacts.filter(a => !a.includes('←')).length} 个文档`
    : `已检查，发现 ${warnings.length} 个问题`;

  return {
    taskName: task.name,
    success: true,
    action: options.action,
    summary,
    artifacts,
    warnings,
    duration: '',
  };
}

/**
 * 生成初稿内容
 */
function generateDraftContent(
  taskName: string,
  platform: Platform,
  context: MaterialContext
): string {
  const today = new Date().toISOString().split('T')[0];
  const platformLabel = { web: 'Web 端', h5: 'H5 端', miniapp: '小程序端', backend: '后端' }[platform];

  // 从素材中提取关键词摘要
  const materialSummary = context.sources.length > 0
    ? context.sources.map(s => `- [${s.type}] ${s.file}`).join('\n')
    : '- _(无素材)_';

  const rawTextPreview = context.rawText.length > 1000
    ? context.rawText.slice(0, 1000) + '\n\n> ...（更多内容已读取，AI 可在对话中引用完整素材）'
    : context.rawText;

  return `# ${taskName} — ${platformLabel}需求文档

> 任务：${taskName}
> 平台：${platformLabel}
> 状态：📝 待精修
> 批量生成于 ${today}

---

## 📥 素材上下文

AI 已读取以下素材来理解需求背景：

${materialSummary}

### 素材摘要

\`\`\`
${rawTextPreview}
\`\`\`

---

## 1. 需求背景

<!-- 
  AI 提示：请根据上面的素材上下文，填写需求背景。
  内容包括：为什么要做这个功能、解决什么问题、目标用户是谁。
-->

_待精修_

## 2. 用户场景

<!-- AI 提示：请根据素材中提到的用户角色和场景，列出具体用例。-->

### 2.1 场景一

**作为** _（角色）_
**我想要** _（目标）_
**以便** _（价值）_

### 2.2 场景二

_待补充_

## 3. 功能描述

### 3.1 核心功能

<!-- AI 提示：列出主要功能点，每个功能点包含：名称、描述、交互逻辑。-->

| 功能 | 描述 | 涉及角色 |
| :--- | :--- | :--- |
| | | |

## 4. 页面/接口

### 4.1 页面结构

<!-- AI 提示：如果是前端平台，描述页面布局和组件组成。-->

### 4.2 接口列表（${platform === 'backend' ? '后端' : '前端依赖'}）

| 接口 | 方法 | 路径 | 说明 |
| :--- | :--- | :--- | :--- |
| | | | |

## 5. 数据字段

<!-- AI 提示：列出所有需要的数据字段，包括名称、类型、约束、默认值。-->

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| | | | |

## 6. 业务规则

<!-- AI 提示：列出所有业务规则，使用 "如果...则..." 的格式。-->

| 规则编号 | 规则描述 | 触发条件 | 处理逻辑 |
| :--- | :--- | :--- | :--- |
| | | | |

## 7. 验收标准

<!-- AI 提示：为每个场景生成验收标准，覆盖正常流程和异常流程。-->

- [ ] 待精修

## 8. 异常场景

<!-- AI 提示：列出可能的异常情况和处理方式。-->

| 异常 | 触发条件 | 处理方式 | 用户提示 |
| :--- | :--- | :--- | :--- |
| | | | |

---

> 🤖 此文档由 SpecProt 批量引擎根据素材自动生成骨架。
> 请在 AI 对话中说 "精修 ${platform} 端 ${taskName}" 来完善内容。
`;
}

/**
 * 快速检查文档完整性
 */
function quickCheck(content: string): string[] {
  const issues: string[] = [];

  const checks: [string, string][] = [
    ['_待精修_', '有未填写的章节'],
    ['_待补充', '有未完成的补充项'],
    ['_待批量生成_', '尚未批量生成'],
  ];

  for (const [marker, msg] of checks) {
    if (content.includes(marker)) {
      issues.push(msg);
    }
  }

  // 检查关键章节是否为空
  const sections = ['需求背景', '用户场景', '功能描述', '业务规则', '验收标准'];
  for (const section of sections) {
    const sectionRegex = new RegExp(`## \\d+\\. ${section}\\n\\n(.+?)(?=\\n##|$)`, 's');
    const match = content.match(sectionRegex);
    if (match && match[1].trim().length < 20) {
      issues.push(`${section} 内容过短或为空`);
    }
  }

  return issues;
}

/**
 * 更新平台文档（从 task-manager 的 updatePlatformDoc 包装）
 */
async function updatePlatformDoc(
  taskName: string,
  platform: Platform,
  content: string
): Promise<void> {
  const { updatePlatformDoc } = await import('./task-manager');
  await updatePlatformDoc(taskName, platform, content);
}

/**
 * 保存批量报告
 */
async function saveBatchReport(results: BatchResult[], outputPath: string): Promise<void> {
  const { ensureDir } = await import('fs-extra');
  await ensureDir(join(outputPath, '..'));

  const lines: string[] = [
    `# 批量处理报告`,
    `> 生成时间: ${new Date().toISOString()}`,
    '',
    `| 任务 | 操作 | 结果 | 生成物 | 警告 |`,
    `| :--- | :--- | :--- | :--- | :--- |`,
  ];

  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    const artStr = r.artifacts.join(', ') || '—';
    const warnStr = r.warnings.join('; ') || '—';
    lines.push(`| ${r.taskName} | ${r.action} | ${status} | ${artStr} | ${warnStr} |`);
  }

  await writeFile(outputPath, lines.join('\n'));
}
