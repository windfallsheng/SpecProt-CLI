/**
 * 期次管理命令 — 创建、查看、冻结期次
 *
 * 期次 = 产品迭代周期（Sprint/Release）
 * 全局层 = 所有需求的单一事实源
 * 期次层 = 本期工作清单 + 专属产出物
 */

import { createIteration, listIterations, freezeIteration, ensureGlobalLayer } from '../core/global-layer';

export interface IterationCreateOptions {
  name?: string;
  goal?: string;
  from?: string;
  to?: string;
}

export interface IterationFreezeOptions {
  name?: string;
}

export async function iterationCreateCommand(options: IterationCreateOptions): Promise<void> {
  if (!options.name) {
    console.error('❌ 期次名称是必需的。使用 --name <名称>');
    console.error('   示例: specprot iteration create --name 期次-2026-Q3 --goal "上线会议室预订"');
    return;
  }

  await ensureGlobalLayer();

  try {
    const dir = await createIteration({
      name: options.name,
      goal: options.goal || '',
      from: options.from || '',
      to: options.to || '',
      status: '🔄 进行中',
    });

    console.log(`✅ 期次已创建: ${options.name}`);
    console.log(`📁 ${dir}`);
    console.log('');
    console.log('下一步：');
    console.log(`  1. 在 ${options.name}/00-需求文档/ 中编写需求`);
    console.log(`  2. 或运行: specprot req new "需求名称" --iteration ${options.name}`);
  } catch (error) {
    console.error(`❌ 创建失败: ${error}`);
  }
}

export async function iterationListCommand(): Promise<void> {
  await ensureGlobalLayer();
  const iterations = await listIterations();

  if (iterations.length === 0) {
    console.log('📭 暂无期次');
    console.log('   创建: specprot iteration create --name 期次-2026-Q3');
    return;
  }

  console.log('📋 期次列表：\n');
  for (const iter of iterations) {
    const reqCount = iter.reqs.length;
    console.log(`  ${iter.status} ${iter.name}  (${reqCount} 个需求)  创建于 ${iter.createdAt}`);
  }
}

export async function iterationFreezeCommand(options: IterationFreezeOptions): Promise<void> {
  if (!options.name) {
    console.error('❌ 请指定要冻结的期次名称');
    return;
  }

  try {
    await freezeIteration(options.name);
    console.log(`🔒 期次已冻结: ${options.name}`);
    console.log('');
    console.log('冻结后的操作：');
    console.log('  · 需求文档不可再修改');
    console.log('  · 可通过 /specprot export 生成开发 Spec');
    console.log('  · 可通过 /specprot handover 生成交接文档');
  } catch (error) {
    console.error(`❌ 冻结失败: ${error}`);
  }
}
