/**
 * 批量执行命令 — 扫描所有任务，批量生成/检查
 *
 * 使用场景：
 *   下班前：specprot batch --action generate
 *   上班后：查看各任务产出，逐个精修
 */

import { runBatch, BatchOptions } from '../core/batch-engine';
import { Platform } from '../core/task-manager';

export interface BatchCommandOptions {
  action?: string;
  tasks?: string;
  platforms?: string;
  status?: string;
  prototype?: boolean;
  flow?: boolean;
}

export async function batchCommand(options: BatchCommandOptions): Promise<void> {
  const action = (options.action || 'both') as BatchOptions['action'];

  if (!['generate', 'check', 'both'].includes(action)) {
    console.error('❌ 无效的操作类型。可选: generate / check / both');
    return;
  }

  const batchOptions: BatchOptions = {
    action,
    prototype: options.prototype || false,
    flow: options.flow || false,
  };

  if (options.tasks) {
    batchOptions.tasks = options.tasks.split(',').map(t => t.trim());
  }

  if (options.platforms) {
    batchOptions.platforms = options.platforms.split(',').map(p => p.trim()) as Platform[];
  }

  if (options.status) {
    batchOptions.status = options.status;
  }

  console.log('┌─────────────────────────────────────────┐');
  console.log('│       SpecProt 批量处理引擎              │');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│  操作: ${action === 'generate' ? '生成初稿' : action === 'check' ? '完整性检查' : '生成 + 检查'}`);
  if (batchOptions.tasks) {
    console.log(`│  任务: ${batchOptions.tasks.join(', ')}`);
  } else {
    console.log(`│  范围: 所有待处理任务`);
  }
  if (batchOptions.platforms) {
    console.log(`│  平台: ${batchOptions.platforms.join(', ')}`);
  }
  console.log('└─────────────────────────────────────────┘');

  await runBatch(batchOptions);
}
