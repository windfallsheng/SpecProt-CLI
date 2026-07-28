/**
 * 任务管理命令 — 创建、列出、查看任务
 *
 * 任务文件夹 = 一个独立功能模块的完整工作区
 *   产品扔材料进去 → AI 批量生成各端初稿 → 产品逐个精修
 */

import {
  createTask,
  listAllTasks,
  readTaskInfo,
  updateTaskStatus,
  TaskStatus,
  Platform,
} from '../core/task-manager';

export interface TaskCreateOptions {
  name?: string;
  platforms?: string;
  desc?: string;
}

export async function taskCreateCommand(options: TaskCreateOptions): Promise<void> {
  if (!options.name) {
    console.error('❌ 任务名称是必需的。');
    console.error('   示例: specprot task create --name "用户登录" --platforms web,h5');
    return;
  }

  const platforms: Platform[] = options.platforms
    ? (options.platforms.split(',').map(p => p.trim()) as Platform[])
    : ['web'];

  try {
    const info = await createTask(options.name, platforms, options.desc || '');
    console.log(`✅ 任务已创建: ${info.name}`);
    console.log(`📁 ${info.name}/`);
    console.log(`   00-素材/     ← 把讨论、截图、想法扔进来`);
    for (const p of platforms) {
      console.log(`   ${p}/         ← ${p} 端需求文档`);
    }
    console.log(`   _shared/     ← 跨端共享（数据模型、业务规则）`);
    console.log(`   产出/        ← AI 生成物`);
    console.log('');
    console.log('💡 下一步：');
    console.log(`   1. 把材料扔进 ${info.name}/00-素材/`);
    console.log(`   2. 运行 specprot batch 批量生成初稿`);
    console.log(`   3. 在 AI 工具中说 "精修 ${info.name}" `);
  } catch (error) {
    console.error(`❌ 创建失败: ${error}`);
  }
}

export async function taskListCommand(): Promise<void> {
  const tasks = await listAllTasks();

  if (tasks.length === 0) {
    console.log('📭 暂无任务');
    console.log('   创建: specprot task create --name "任务名" --platforms web,h5');
    return;
  }

  console.log('📋 任务列表:\n');

  for (const task of tasks) {
    const platformStr = task.platforms.join('/');
    const matStr = task.materials.length > 0 ? `(${task.materials.length} 素材)` : '(无素材)';
    console.log(`  ${task.status} ${task.name}  [${platformStr}] ${matStr}`);
  }

  console.log('');
  console.log(`共 ${tasks.length} 个任务`);
}

export async function taskShowCommand(taskName: string): Promise<void> {
  const info = await readTaskInfo(taskName);
  if (!info) {
    console.error(`❌ 任务不存在: ${taskName}`);
    return;
  }

  console.log(`📋 ${info.name}`);
  console.log(`   状态: ${info.status}`);
  console.log(`   平台: ${info.platforms.join('、')}`);
  console.log(`   素材: ${info.materials.length} 个`);
  if (info.materials.length > 0) {
    for (const m of info.materials) {
      console.log(`     - ${m}`);
    }
  }
  console.log('');
  console.log('💡 操作：');
  console.log('   specprot batch --tasks "' + info.name + '"  批量生成');
  console.log('   在 AI 工具中说 "精修 ' + info.name + '"        逐端修改');
}

export async function taskStatusCommand(taskName: string, status: string): Promise<void> {
  const validStatuses: TaskStatus[] = [
    '📥 素材收集中', '🤖 批量生成中', '📝 待精修',
    '🔍 评审中', '🔒 已冻结', '✔️ 已交付', '⏸️ 暂缓',
  ];

  const statusMap: Record<string, TaskStatus> = {
    '素材收集': '📥 素材收集中',
    '批量生成': '🤖 批量生成中',
    '待精修': '📝 待精修',
    '评审中': '🔍 评审中',
    '已冻结': '🔒 已冻结',
    '已交付': '✔️ 已交付',
    '暂缓': '⏸️ 暂缓',
  };

  const mappedStatus = statusMap[status] || status as TaskStatus;
  if (!validStatuses.includes(mappedStatus)) {
    console.error(`❌ 无效状态: ${status}`);
    console.error('   有效状态: 素材收集 / 批量生成 / 待精修 / 评审中 / 已冻结 / 已交付 / 暂缓');
    return;
  }

  await updateTaskStatus(taskName, mappedStatus);
  console.log(`✅ ${taskName} 状态已更新: ${mappedStatus}`);
}
