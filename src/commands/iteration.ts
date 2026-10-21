/**
 * 期次管理命令 — 创建、查看、冻结期次
 *
 * 期次 = 产品迭代周期（Sprint/Release）
 * 全局层 = 所有需求的单一事实源
 * 期次层 = 本期工作清单 + 专属产出物
 */

import { createIteration, listIterations, freezeIteration, ensureGlobalLayer, listIterationReqs, readGlobalIndex } from '../core/global-layer';
import { readFile, writeFile, rename, remove, readdir, pathExists } from 'fs-extra';
import { join } from 'path';

export interface IterationCreateOptions {
  name?: string;
  goal?: string;
  from?: string;
  to?: string;
  platforms?: string;
  /** 端名 → SpecCore 工程标识映射（web=admin-web,backend=booking-service） */
  platformMap?: string;
}

export interface IterationFreezeOptions {
  name?: string;
  force?: boolean;
  /** 只冻结/导出这些端（逗号分隔），留空 = 全部端 */
  platforms?: string;
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
    const hintPlatform = (platforms && platforms.length > 0 ? platforms[0] : 'web');

    const dir = await createIteration({
      name: options.name,
      goal: options.goal || '',
      from: options.from || '',
      to: options.to || '',
      status: '🔄 进行中',
      platforms,
      platformMap: options.platformMap,
    });

    console.log(`✅ 期次已创建: ${options.name}（加工车间已就绪）`);
    console.log(`📁 ${dir}`);
    console.log('');
    console.log('下一步：');
    console.log(`  1. 把素材扔进 ${options.name}/00-素材/{端}/（跨端通用放 shared/）`);
    console.log(`  2. 转换素材: specprot convert -i ${options.name}`);
    console.log(`  3. 端级分析: specprot analyze -i ${options.name} -p ${hintPlatform}`);
    console.log(`  4. 功能切分: specprot slice -i ${options.name} -p ${hintPlatform}`);
    console.log(`  5. 正典归位: specprot req adopt -i ${options.name} -p web -f <单元>`);
    console.log(`  6. 冻结交接: specprot iteration freeze -n ${options.name}`);
    console.log('');
    console.log(`  或一键流水线: specprot run -i ${options.name} -m auto（全自动）/ -m interactive（人机交互）`);
  } catch (error) {
    console.error(`❌ 创建失败: ${error}`);
  }
}

export async function iterationListCommand(detail = false): Promise<void> {
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
    if (detail) {
      const stats = await iterationStats(iter.name);
      console.log(`  ${iter.status} ${iter.name}`);
      console.log(`     端: ${stats.platforms.length > 0 ? stats.platforms.join(' / ') : '—'} | 单元: ${stats.units} | 需求: ${reqCount} | 素材: ${stats.materials} | 创建于 ${iter.createdAt}`);
    } else {
      console.log(`  ${iter.status} ${iter.name}  (${reqCount} 个需求)  创建于 ${iter.createdAt}`);
    }
  }
  console.log('');
  console.log('单期次详情: specprot iteration show -n 期次名');
}

/** 期次统计: 端列表 / 单元数 / 素材数（show 与 list --detail 共用） */
async function iterationStats(name: string): Promise<{ platforms: string[]; units: number; materials: number }> {
  const iterDir = join(process.cwd(), name);
  let platforms: string[] = [];
  let units = 0;
  let materials = 0;
  const readmePath = join(iterDir, 'README.md');
  if (await pathExists(readmePath)) {
    const readme = await readFile(readmePath, 'utf-8');
    const pm = readme.match(/>\s*平台[:：]\s*(.+)/);
    if (pm) {
      platforms = pm[1].split(/[,，]/).map((s) => s.trim().replace(/[=＝].*$/, '')).filter(Boolean);
    }
  }
  for (const pf of platforms) {
    const featuresDir = join(iterDir, pf, 'features');
    if (await pathExists(featuresDir)) {
      for (const f of await readdir(featuresDir)) {
        if (f.startsWith('.') || f === 'INDEX.md') continue;
        if (await pathExists(join(featuresDir, f, 'REQUIREMENT.md'))) units++;
      }
    }
  }
  const materialsDir = join(iterDir, '00-素材');
  if (await pathExists(materialsDir)) {
    for (const f of await readdir(materialsDir)) {
      if (f.startsWith('.') || f === 'INDEX.md') continue;
      materials++;
    }
  }
  return { platforms, units, materials };
}

/** 期次详情 */
export async function iterationShowCommand(name: string): Promise<void> {
  if (!name) {
    console.error('❌ 请指定期次名称: specprot iteration show -n 期次名');
    return;
  }
  const iterDir = join(process.cwd(), name);
  const readmePath = join(iterDir, 'README.md');
  if (!(await pathExists(readmePath))) {
    console.error(`❌ 期次不存在: ${name}`);
    return;
  }
  const readme = await readFile(readmePath, 'utf-8');
  const status = (readme.match(/>\s*状态[:：]\s*(.+)/) || [])[1]?.trim() || '—';
  const stats = await iterationStats(name);
  const reqs = await listIterationReqs(name);

  console.log(`📖 期次详情: ${name}\n`);
  console.log(`  状态: ${status}`);
  console.log(`  端:   ${stats.platforms.length > 0 ? stats.platforms.join(' / ') : '—'}`);
  console.log(`  功能单元: ${stats.units}`);
  console.log(`  关联需求: ${reqs.length}`);
  console.log(`  素材目录: ${stats.materials} 项（00-素材/）`);
  console.log('');
  console.log('下一步:');
  console.log('  查看需求: specprot req list -i ' + name);
  console.log('  跑流水线: specprot run -i ' + name + ' -m auto');
  console.log('  冻结交付: specprot iteration freeze -n ' + name);
}

/** 期次重命名: 目录 + 索引 + 关联需求同步改名 */
export async function iterationRenameCommand(options: { name?: string; target?: string }): Promise<void> {
  if (!options.name || !options.target) {
    console.error('❌ 请指定旧名与新名: specprot iteration rename -n 旧名 -t 新名');
    return;
  }
  const oldDir = join(process.cwd(), options.name);
  const newDir = join(process.cwd(), options.target);
  if (!(await pathExists(oldDir))) {
    console.error(`❌ 期次不存在: ${options.name}`);
    return;
  }
  if (await pathExists(newDir)) {
    console.error(`❌ 新名已被占用: ${options.target}`);
    return;
  }

  await rename(oldDir, newDir);

  // 全局索引: 期次表 + 需求表的期次列
  const index = await readGlobalIndex();
  const indexPath = join(process.cwd(), '.speccore', 'GLOBAL', 'INDEX.md');
  let idx = await readFile(indexPath, 'utf-8');
  idx = idx.replace(new RegExp('\\| ' + options.name + ' \\|', 'g'), '| ' + options.target + ' |');
  await writeFile(indexPath, idx, 'utf-8');

  // 关联需求文件: 关联期次行
  for (const req of index.reqs.filter((r) => r.iteration === options.name)) {
    const src = join(process.cwd(), '.speccore', 'GLOBAL', req.filePath);
    if (!(await pathExists(src))) continue;
    let content = await readFile(src, 'utf-8');
    content = content.replace(/\| 关联期次 \| [^|]+ \|/, '| 关联期次 | ' + options.target + ' |');
    await writeFile(src, content, 'utf-8');
  }
  console.log(`✏️ 期次已改名: ${options.name} → ${options.target}`);
  console.log('   目录 / 全局索引 / ' + index.reqs.filter((r) => r.iteration === options.name).length + ' 个关联需求已同步。');
}

/** 期次删除: 影响清单 + --yes 确认; 解绑需求并把「变更中」复位为「已通过」 */
export async function iterationDeleteCommand(options: { name?: string; yes?: boolean }): Promise<void> {
  if (!options.name) {
    console.error('❌ 请指定期次名称: specprot iteration delete -n 期次名');
    return;
  }
  const iterDir = join(process.cwd(), options.name);
  const reqs = await listIterationReqs(options.name);
  const changing = reqs.filter((r) => r.status.includes('变更中'));

  if (!options.yes) {
    console.error('⛔ 删除期次不可恢复，请先确认影响面:');
    console.error(`   期次目录: ${options.name}/`);
    console.error(`   关联需求: ${reqs.length} 个（将解绑回「未排期」）`);
    console.error(`   其中变更中: ${changing.length} 个（状态将复位为「已通过」，变更占位行清除）`);
    console.error('');
    console.error('   确认执行: specprot iteration delete -n ' + options.name + ' --yes');
    return;
  }

  // 解绑需求
  for (const req of reqs) {
    const src = join(process.cwd(), '.speccore', 'GLOBAL', req.filePath);
    if (await pathExists(src)) {
      let content = await readFile(src, 'utf-8');
      content = content.replace(/\| 关联期次 \| [^|]+ \|/, '| 关联期次 | - |');
      if (req.status.includes('变更中')) {
        content = content.replace(/\| 状态 \| [^|]+ \|/, '| 状态 | ✅ 已通过 |');
        content = content.replace(/\n\| v\?\.\? \| [^|]+ \| 变更发起[^|]* \| [^|]* \|/, '');
      }
      await writeFile(src, content, 'utf-8');
    }
  }

  // 全局索引: 先删期次表行（行首第一列 = 期次名），再清需求表的期次列
  const indexPath = join(process.cwd(), '.speccore', 'GLOBAL', 'INDEX.md');
  if (await pathExists(indexPath)) {
    let idx = await readFile(indexPath, 'utf-8');
    idx = idx.split('\n').filter((l) => !l.trim().startsWith('| ' + options.name + ' |')).join('\n');
    idx = idx.replace(new RegExp('\\| ' + options.name + ' \\|', 'g'), '| - |');
    await writeFile(indexPath, idx, 'utf-8');
  }

  await remove(iterDir);
  console.log(`🗑️ 期次已删除: ${options.name}（${reqs.length} 个需求已解绑）`);
}

export async function iterationFreezeCommand(options: IterationFreezeOptions): Promise<void> {
  if (!options.name) {
    console.error('❌ 请指定要冻结的期次名称');
    return;
  }

  try {
    const onlyPlatforms = options.platforms
      ? options.platforms.split(',').map((p) => p.trim()).filter(Boolean)
      : [];
    const deliveryDir = await freezeIteration(options.name, {
      force: !!options.force,
      platforms: onlyPlatforms.length > 0 ? onlyPlatforms : undefined,
    });
    if (!deliveryDir) {
      console.error('⛔ 冻结未完成 — 请先裁决上述问题（specprot resolve -i <期次> -p <端> -f <单元>）后重试。');
      return;
    }
    console.log(`🔒 期次已冻结: ${options.name}`);
    console.log('');
    console.log(`📦 交接快照已生成: ${deliveryDir}/`);
    if (onlyPlatforms.length > 0) {
      console.log(`   仅包含端: ${onlyPlatforms.join(', ')}`);
    }
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
