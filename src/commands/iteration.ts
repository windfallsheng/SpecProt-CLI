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
  platforms?: string;
}

export interface IterationFreezeOptions {
  name?: string;
  force?: boolean;
}

export async function iterationCreateCommand(options: IterationCreateOptions): Promise<void> {
  if (!options.name) {
    console.error('❌ 期次名称是必需的。使用 --name <名称>');
    console.error('   示例: specprot iteration create --name 期次-2026-Q3 --goal "上线会议室预订"');
    return;
  }

  await ensureGlobalLayer();

  try {
    const platforms = options.platforms
      ? options.platforms.split(',').map((p) => p.trim()).filter(Boolean)
      : undefined;

    const dir = await createIteration({
      name: options.name,
      goal: options.goal || '',
      from: options.from || '',
      to: options.to || '',
      status: '🔄 进行中',
      platforms,
    });

    console.log(`✅ 期次已创建: ${options.name}（加工车间已就绪）`);
    console.log(`📁 ${dir}`);
    console.log('');
    console.log('下一步：');
    console.log(`  1. 把素材扔进 ${options.name}/00-素材/{端}/（跨端通用放 shared/）`);
    console.log(`  2. 转换素材: specprot convert -i ${options.name}`);
    console.log(`  3. 端级分析: specprot analyze -i ${options.name} -p web`);
    console.log(`  4. 功能切分: specprot slice -i ${options.name} -p web`);
    console.log(`  5. 正典归位: specprot req adopt -i ${options.name} -p web -f <单元>`);
    console.log(`  6. 冻结交接: specprot iteration freeze -n ${options.name}`);
    console.log('');
    console.log(`  或一键流水线: specprot run -i ${options.name} -m auto（全自动）/ -m interactive（人机交互）`);
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
    const deliveryDir = await freezeIteration(options.name, { force: !!options.force });
    console.log(`🔒 期次已冻结: ${options.name}`);
    console.log('');
    console.log(`📦 交接快照已生成: ${deliveryDir}/`);
    console.log('   快照文件头部含 SPECPROT-SNAPSHOT 元数据（来源/冻结时间/冻结版本）');
    console.log('');
    console.log('冻结后的操作：');
    console.log('  1. 手动复制快照文件到 SpecCore 迭代目录的 010-requirements/sources/');
    console.log('  2. 在 SpecCore 中执行 doc2spec / unitize 完成需求切分');
    console.log('  3. GLOBAL/PROJECTS 源文件仍是唯一权威版本');
  } catch (error) {
    console.error(`❌ 冻结失败: ${error}`);
  }
}
