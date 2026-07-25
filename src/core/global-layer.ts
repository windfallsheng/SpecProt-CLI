/**
 * 全局需求索引管理 — SpecProt 产品底座
 *
 * 职责：
 *   1. 管理 GLOBAL/INDEX.md — 全量需求索引表
 *   2. 需求 CRUD：新建、查找、更新、废弃
 *   3. 期次关联：需求 ↔ 期次的双向引用
 *
 * 数据流：
 *   产品写需求 → 存入 GLOBAL/PROJECTS/{项目}/REQ-XXX.md
 *             → 更新 GLOBAL/INDEX.md 索引
 *             → 可选关联到期次
 */

import { ensureDir, writeFile, readFile, pathExists, readdir } from 'fs-extra';
import { join } from 'path';

// ============================================================
// 类型定义
// ============================================================

/** 需求状态（产品侧） */
export type ReqStatus =
  | '📝 草稿'      // 正在编写
  | '🔍 评审中'    // 提交评审
  | '✅ 已通过'    // 评审通过
  | '🔒 已冻结'    // 冻结，不可修改
  | '🔄 开发中'    // 开发进行中
  | '✔️ 已交付'    // 开发完成并上线
  | '🗑️ 已废弃'    // 已废弃
  | '⏸️ 暂缓';     // 暂缓，待排期

/** 需求索引条目 */
export interface ReqIndexEntry {
  id: string;           // REQ-001
  project: string;      // 所属项目
  name: string;         // 需求名称
  status: ReqStatus;
  version: string;      // v1.0, v1.1
  iteration: string;    // 关联期次（空 = 未排期）
  task: string;         // 关联开发 Task（空 = 未拆分）
  filePath: string;     // 相对于 GLOBAL/ 的路径
}

/** 期次关联条目 */
export interface IterationLink {
  name: string;         // 期次-2026-Q3
  reqs: string[];       // 包含的需求 ID 列表
  status: string;       // 🔄 进行中 / ✅ 已完成
  createdAt: string;
}

/** 全局索引结构 */
export interface GlobalIndex {
  reqs: ReqIndexEntry[];
  iterations: IterationLink[];
  version: string;
  lastUpdated: string;
}

/** 期次信息 */
export interface IterationInfo {
  name: string;
  goal: string;         // 本期目标
  from: string;         // 开始日期
  to: string;           // 结束日期
  status: string;
}

// ============================================================
// 路径工具
// ============================================================

function getSpeccoreDir(): string {
  return join(process.cwd(), '.speccore');
}

function getGlobalDir(): string {
  return join(getSpeccoreDir(), 'GLOBAL');
}

function getIndexPath(): string {
  return join(getGlobalDir(), 'INDEX.md');
}

function getIterationDir(name: string): string {
  return join(process.cwd(), name);
}

function getIterationReqDir(name: string): string {
  return join(getIterationDir(name), '00-需求文档');
}

// ============================================================
// INDEX.md 解析
// ============================================================

/**
 * 解析 GLOBAL/INDEX.md 为结构化数据
 */
export async function readGlobalIndex(): Promise<GlobalIndex> {
  const indexPath = getIndexPath();
  if (!(await pathExists(indexPath))) {
    return { reqs: [], iterations: [], version: 'v1.0', lastUpdated: '' };
  }

  const content = await readFile(indexPath, 'utf-8');
  const index: GlobalIndex = { reqs: [], iterations: [], version: 'v1.0', lastUpdated: '' };

  // 解析需求索引表
  const reqTableMatch = content.match(/\| 需求 ID \|[\s\S]*?(?=\n\n---|$)/);
  if (reqTableMatch) {
    for (const line of reqTableMatch[0].split('\n')) {
      if (line.includes(':---')) continue;
      const cols = line.split('|').map((c) => c.trim());
      if (cols.length >= 9 && cols[1]?.match(/^REQ-\d+$/)) {
        index.reqs.push({
          id: cols[1], project: cols[2], name: cols[3],
          status: cols[4] as ReqStatus, version: cols[5],
          iteration: cols[6] === '-' ? '' : cols[6],
          task: cols[7] === '-' ? '' : cols[7],
          filePath: cols[8],
        });
      }
    }
  }

  // 解析期次关联
  const iterMatch = content.match(/\| 期次名称 \|[\s\S]*?(?=\n\n---|$)/);
  if (iterMatch) {
    for (const line of iterMatch[0].split('\n')) {
      if (line.includes(':---')) continue;
      const cols = line.split('|').map((c) => c.trim());
      if (cols.length >= 5 && cols[1] && cols[1] !== '期次名称' && !cols[1].startsWith('_')) {
        index.iterations.push({
          name: cols[1],
          reqs: cols[2] === '-' ? [] : cols[2].split(',').map((r: string) => r.trim()),
          status: cols[3],
          createdAt: cols[4],
        });
      }
    }
  }

  // 版本
  const verMatch = content.match(/\| v(\d+\.\d+) \| ([^|]+) \|/);
  if (verMatch) {
    index.version = `v${verMatch[1]}`;
    index.lastUpdated = verMatch[2].trim();
  }

  return index;
}

/** 获取下一个需求编号 */
export function getNextReqId(index: GlobalIndex): string {
  let maxNum = 0;
  for (const req of index.reqs) {
    const m = req.id.match(/REQ-(\d+)/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return `REQ-${String(maxNum + 1).padStart(3, '0')}`;
}

/** 递增版本号 */
export function bumpVersion(current: string): string {
  const m = current.match(/v(\d+)\.(\d+)/);
  return m ? `v${m[1]}.${parseInt(m[2]) + 1}` : 'v1.1';
}

// ============================================================
// 需求操作
// ============================================================

/**
 * 新建需求：写入全局 PROJECTS 目录 + 更新索引
 */
export async function createRequirement(
  project: string,
  name: string,
  description: string,
  iteration?: string
): Promise<ReqIndexEntry> {
  const index = await readGlobalIndex();
  const reqId = getNextReqId(index);
  const today = new Date().toISOString().split('T')[0];

  // 写入需求文件
  const projDir = join(getGlobalDir(), 'PROJECTS', project);
  await ensureDir(projDir);

  const content = `# ${reqId}：${name}

> **元数据**
> | 字段 | 值 |
> | :--- | :--- |
> | 需求 ID | ${reqId} |
> | 所属项目 | ${project} |
> | 当前版本 | v1.0 |
> | 状态 | 📝 草稿 |
> | 关联期次 | ${iteration || '-'} |
> | 创建日期 | ${today} |

## 需求描述

${description}

## 业务规则

_待补充_

## 验收标准

- [ ] 待补充

## 变更历史

| 版本 | 日期 | 变更内容 | 变更人 |
| :--- | :--- | :--- | :--- |
| v1.0 | ${today} | 初始创建 | — |
`;

  const fileName = `${reqId}-${name}.md`;
  await writeFile(join(projDir, fileName), content);

  // 更新索引
  const entry: ReqIndexEntry = {
    id: reqId,
    project,
    name,
    status: '📝 草稿',
    version: 'v1.0',
    iteration: iteration || '',
    task: '',
    filePath: `PROJECTS/${project}/${fileName}`,
  };
  await appendReqToIndex(entry);

  // 如果指定了期次，加入期次引用
  if (iteration) {
    await linkReqToIteration(reqId, iteration);
  }

  return entry;
}

/**
 * 读取需求内容
 */
export async function readRequirement(project: string, reqId: string): Promise<string> {
  const index = await readGlobalIndex();
  const entry = index.reqs.find((r) => r.id === reqId && r.project === project);
  if (!entry) return '';

  const filePath = join(getGlobalDir(), entry.filePath);
  if (!(await pathExists(filePath))) return '';
  return await readFile(filePath, 'utf-8');
}

/**
 * 更新需求状态
 */
export async function updateReqStatus(
  reqId: string,
  status: ReqStatus,
  iteration?: string
): Promise<void> {
  await updateReqInIndex(reqId, { status, ...(iteration !== undefined ? { iteration } : {}) });
}

// ============================================================
// INDEX.md 写入
// ============================================================

/** 追加需求到索引表 */
export async function appendReqToIndex(entry: ReqIndexEntry): Promise<void> {
  const indexPath = getIndexPath();
  let content = await readFile(indexPath, 'utf-8');

  const newLine = `| ${entry.id} | ${entry.project} | ${entry.name} | ${entry.status} | ${entry.version} | ${entry.iteration || '-'} | ${entry.task || '-'} | \`${entry.filePath}\` |`;

  if (content.includes('_暂无需求_')) {
    content = content.replace(
      /\| _暂无需求_ \| - \| - \| - \| - \| - \| - \| - \|/,
      newLine
    );
  } else {
    // 在表格最后一行后追加
    const tableEnd = content.indexOf('\n\n---', content.indexOf('| 需求 ID |'));
    if (tableEnd > 0) {
      content = content.slice(0, tableEnd) + '\n' + newLine + content.slice(tableEnd);
    }
  }

  await writeFile(indexPath, content);
}

/** 更新索引中的需求条目 */
export async function updateReqInIndex(
  reqId: string,
  updates: Partial<ReqIndexEntry>
): Promise<void> {
  const indexPath = getIndexPath();
  let content = await readFile(indexPath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`| ${reqId} |`)) {
      const cols = lines[i].split('|').map((c) => c.trim());
      if (cols.length >= 9 && cols[1] === reqId) {
        if (updates.status) cols[4] = updates.status;
        if (updates.version) cols[5] = updates.version;
        if (updates.iteration !== undefined) cols[6] = updates.iteration || '-';
        if (updates.task !== undefined) cols[7] = updates.task || '-';
        if (updates.name) cols[3] = updates.name;
        lines[i] = `| ${cols[1]} | ${cols[2]} | ${cols[3]} | ${cols[4]} | ${cols[5]} | ${cols[6]} | ${cols[7]} | ${cols[8]} |`;
        break;
      }
    }
  }

  await writeFile(indexPath, lines.join('\n'));
}

// ============================================================
// 期次操作
// ============================================================

/**
 * 创建期次目录结构
 */
export async function createIteration(info: IterationInfo): Promise<string> {
  const iterDir = getIterationDir(info.name);

  if (await pathExists(iterDir)) {
    throw new Error(`期次已存在: ${info.name}`);
  }

  // 创建目录结构
  await ensureDir(join(iterDir, '00-需求文档'));
  await ensureDir(join(iterDir, '01-原型'));
  await ensureDir(join(iterDir, '02-图谱'));
  await ensureDir(join(iterDir, '03-评审'));
  await ensureDir(join(iterDir, '04-交付'));

  // README.md
  await writeFile(join(iterDir, 'README.md'), `# ${info.name}

> 目标：${info.goal}
> 时间：${info.from || '未指定'} ~ ${info.to || '未指定'}
> 状态：🔄 进行中

## 本期需求

| 需求 ID | 需求名称 | 状态 | 原型 | 流程图 | 评审 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| | | | | | |

## 里程碑

| 节点 | 日期 | 状态 |
| :--- | :--- | :--- |
| 需求冻结 | | ⏳ |
| 开发完成 | | ⏳ |
| 测试通过 | | ⏳ |
| 上线 | | ⏳ |
`);

  // 更新全局索引
  await appendIterationToGlobal(info.name);

  // 更新 .speccore/ITERATIONS/README.md
  await updateIterationsReadme(info);

  return iterDir;
}

/** 追加期次到全局索引 */
async function appendIterationToGlobal(name: string): Promise<void> {
  const indexPath = getIndexPath();
  if (!(await pathExists(indexPath))) return;

  let content = await readFile(indexPath, 'utf-8');
  if (content.includes(`| ${name} |`)) return;

  const today = new Date().toISOString().split('T')[0];
  const newLine = `| ${name} | - | 🔄 进行中 | ${today} |`;

  if (content.includes('_暂无期次_')) {
    content = content.replace(/\| _暂无期次_ \| - \| - \| - \|/, newLine);
  } else {
    const lines = content.split('\n');
    const sectionIdx = lines.findIndex((l) => l.startsWith('## 期次关联'));
    if (sectionIdx >= 0) {
      let insertIdx = sectionIdx + 3;
      for (let i = insertIdx; i < lines.length; i++) {
        if (lines[i].startsWith('|')) insertIdx = i + 1;
        else if (lines[i].startsWith('##') || lines[i].startsWith('---')) break;
      }
      lines.splice(insertIdx, 0, newLine);
      content = lines.join('\n');
    }
  }

  await writeFile(indexPath, content);
}

/** 更新 .speccore/ITERATIONS/README.md */
async function updateIterationsReadme(info: IterationInfo): Promise<void> {
  const indexPath = join(getSpeccoreDir(), 'ITERATIONS', 'README.md');
  await ensureDir(join(getSpeccoreDir(), 'ITERATIONS'));

  let content: string;
  if (await pathExists(indexPath)) {
    content = await readFile(indexPath, 'utf-8');
  } else {
    content = '# 期次索引\n\n| 期次名称 | 时间范围 | 状态 | 负责人 | 备注 |\n| :--- | :--- | :--- | :--- | :--- |\n';
  }

  const dateRange = `${info.from || '未指定'} ~ ${info.to || '未指定'}`;
  content += `| ${info.name} | ${dateRange} | 🔄 进行中 | | |\n`;
  await writeFile(indexPath, content);
}

/**
 * 将需求关联到期次
 */
export async function linkReqToIteration(reqId: string, iteration: string): Promise<void> {
  // 更新全局索引中需求的期次字段
  await updateReqInIndex(reqId, { iteration });

  // 更新期次 README 的需求表格
  const iterDir = getIterationDir(iteration);
  const readmePath = join(iterDir, 'README.md');
  if (!(await pathExists(readmePath))) return;

  const index = await readGlobalIndex();
  const entry = index.reqs.find((r) => r.id === reqId);
  if (!entry) return;

  let content = await readFile(readmePath, 'utf-8');
  const newRow = `| ${reqId} | ${entry.name} | 📝 草稿 | — | — | — |`;

  if (content.includes('| | | | | | |')) {
    content = content.replace('| | | | | | |', newRow);
  } else {
    const tableStart = content.indexOf('| 需求 ID |');
    const tableEnd = content.indexOf('\n##', tableStart);
    const insertPos = tableEnd > tableStart ? tableEnd : content.length;
    content = content.slice(0, insertPos) + '\n' + newRow + content.slice(insertPos);
  }

  await writeFile(readmePath, content);
}

/**
 * 冻结期次
 */
export async function freezeIteration(name: string): Promise<void> {
  const iterDir = getIterationDir(name);
  const readmePath = join(iterDir, 'README.md');

  if (!(await pathExists(readmePath))) {
    throw new Error(`期次不存在: ${name}`);
  }

  let content = await readFile(readmePath, 'utf-8');
  content = content.replace('🔄 进行中', '🔒 已冻结');
  await writeFile(readmePath, content);

  // 更新全局索引
  const indexPath = getIndexPath();
  if (await pathExists(indexPath)) {
    let idxContent = await readFile(indexPath, 'utf-8');
    idxContent = idxContent.replace(
      new RegExp(`\\| ${name} \\| [^|]+ \\| 🔄 进行中 \\|`),
      `| ${name} | - | 🔒 已冻结 |`
    );
    await writeFile(indexPath, idxContent);
  }
}

// ============================================================
// 查询操作
// ============================================================

/** 列出所有期次 */
export async function listIterations(): Promise<IterationLink[]> {
  const index = await readGlobalIndex();
  return index.iterations;
}

/** 列出未排期的需求 */
export async function listUnplannedReqs(): Promise<ReqIndexEntry[]> {
  const index = await readGlobalIndex();
  return index.reqs.filter((r) => !r.iteration || r.iteration === '-');
}

/** 列出指定期次的需求 */
export async function listIterationReqs(iteration: string): Promise<ReqIndexEntry[]> {
  const index = await readGlobalIndex();
  return index.reqs.filter((r) => r.iteration === iteration);
}

// ============================================================
// 索引初始化
// ============================================================

/**
 * 确保全局层存在并初始化 INDEX.md（幂等）
 */
export async function ensureGlobalLayer(): Promise<void> {
  const globalDir = getGlobalDir();
  await ensureDir(globalDir);
  await ensureDir(join(globalDir, 'PROJECTS'));

  const indexPath = getIndexPath();
  if (await pathExists(indexPath)) return;

  const today = new Date().toISOString().split('T')[0];
  await writeFile(indexPath, `# 全量需求索引（Global Catalog）

> 本文件是需求定位的"地图"。由 SpecProt 自动维护。

---

## 需求索引

| 需求 ID | 项目 | 需求名称 | 状态 | 版本 | 关联期次 | 关联 Task | 文件路径 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| _暂无需求_ | - | - | - | - | - | - | - |

---

## 期次关联

| 期次名称 | 包含需求 | 状态 | 创建日期 |
| :--- | :--- | :--- | :--- |
| _暂无期次_ | - | - | - |

---

## 版本信息

| 版本 | 日期 | 变更说明 |
| :--- | :--- | :--- |
| v1.0 | ${today} | 初始创建 |
`);
}

export { getGlobalDir, getIndexPath, getIterationDir, getIterationReqDir };
