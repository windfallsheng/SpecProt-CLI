/**
 * 需求管理命令 — 新建、查看、关联需求
 *
 * 需求本体存储在全局层：.speccore/GLOBAL/PROJECTS/{项目}/REQ-XXX-名称.md
 * 需求与期次的关系是"引用"而非"复制"
 */

import {
  createRequirement,
  readRequirement,
  linkReqToIteration,
  listUnplannedReqs,
  listIterationReqs,
  readGlobalIndex,
  ensureGlobalLayer,
  updateReqInIndex,
  ReqStatus,
} from '../core/global-layer';

export interface ReqNewOptions {
  name?: string;
  desc?: string;
  project?: string;
  iteration?: string;
}

export interface ReqLinkOptions {
  req?: string;
  iteration?: string;
}

export interface ReqStatusOptions {
  req?: string;
  status?: string;
}

export async function reqNewCommand(options: ReqNewOptions): Promise<void> {
  if (!options.name) {
    console.error('❌ 需求名称是必需的。');
    console.error('   示例: specprot req new "会议室预订功能" --project 会议系统');
    return;
  }

  await ensureGlobalLayer();

  try {
    const entry = await createRequirement(
      options.project || 'default',
      options.name,
      options.desc || '',
      options.iteration
    );

    console.log(`✅ 需求已创建: ${entry.id} — ${entry.name}`);
    console.log(`📁 .speccore/GLOBAL/${entry.filePath}`);
    if (options.iteration) {
      console.log(`🔗 已关联到期次: ${options.iteration}`);
    }
    console.log('');
    console.log('下一步：');
    console.log('  · 在 Trae/Qoder 中打开该文件继续编写需求');
    console.log('  · 或运行: specprot prototype 生成原型');
  } catch (error) {
    console.error(`❌ 创建失败: ${error}`);
  }
}

export async function reqLinkCommand(options: ReqLinkOptions): Promise<void> {
  if (!options.req || !options.iteration) {
    console.error('❌ 请指定需求 ID 和期次名称');
    console.error('   示例: specprot req link --req REQ-001 --iteration 期次-2026-Q3');
    return;
  }

  try {
    await linkReqToIteration(options.req, options.iteration);
    console.log(`🔗 ${options.req} 已关联到 ${options.iteration}`);
  } catch (error) {
    console.error(`❌ 关联失败: ${error}`);
  }
}

export async function reqListCommand(iteration?: string): Promise<void> {
  await ensureGlobalLayer();

  const reqs = iteration
    ? await listIterationReqs(iteration)
    : (await readGlobalIndex()).reqs;

  if (reqs.length === 0) {
    console.log('📭 暂无需求');
    console.log('   创建: specprot req new "需求名称"');
    return;
  }

  const title = iteration ? `${iteration} 的需求列表` : '全量需求列表';
  console.log(`📋 ${title}：\n`);

  for (const req of reqs) {
    const iterTag = req.iteration ? ` [${req.iteration}]` : '';
    console.log(`  ${req.status} ${req.id}  ${req.name}${iterTag}  (${req.version})`);
  }

  if (!iteration) {
    const unplanned = reqs.filter((r) => !r.iteration || r.iteration === '-');
    if (unplanned.length > 0) {
      console.log(`\n⚠️ ${unplanned.length} 个需求尚未排期`);
    }
  }
}

export async function reqShowCommand(reqId: string, project?: string): Promise<void> {
  const content = await readRequirement(project || 'default', reqId);
  if (!content) {
    console.error(`❌ 未找到需求: ${reqId}`);
    return;
  }
  console.log(content);
}

export async function reqStatusCommand(options: ReqStatusOptions): Promise<void> {
  if (!options.req || !options.status) {
    console.error('❌ 请指定需求 ID 和状态');
    console.error('   示例: specprot req status --req REQ-001 --status "评审中"');
    console.error('   可选状态: 草稿 | 评审中 | 已通过 | 已冻结 | 开发中 | 已交付 | 已废弃 | 暂缓');
    return;
  }

  const validStatuses: ReqStatus[] = [
    '📝 草稿', '🔍 评审中', '✅ 已通过', '🔒 已冻结',
    '🔄 开发中', '✔️ 已交付', '🗑️ 已废弃', '⏸️ 暂缓',
  ];

  // 支持简写
  const statusMap: Record<string, ReqStatus> = {
    '草稿': '📝 草稿',
    '评审中': '🔍 评审中',
    '已通过': '✅ 已通过',
    '已冻结': '🔒 已冻结',
    '开发中': '🔄 开发中',
    '已交付': '✔️ 已交付',
    '已废弃': '🗑️ 已废弃',
    '暂缓': '⏸️ 暂缓',
  };

  const mappedStatus = statusMap[options.status] || options.status as ReqStatus;
  if (!validStatuses.includes(mappedStatus)) {
    console.error(`❌ 无效状态: ${options.status}`);
    console.error('   有效状态: 草稿 / 评审中 / 已通过 / 已冻结 / 开发中 / 已交付 / 已废弃 / 暂缓');
    return;
  }

  await updateReqInIndex(options.req, { status: mappedStatus });
  console.log(`✅ ${options.req} 状态已更新: ${mappedStatus}`);
}
