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

import { ensureDir, writeFile, readFile, pathExists, readdir, copy, stat } from 'fs-extra';
import { join, basename } from 'path';

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
  /** 涉及端列表（加工车间模式：预建各端素材目录与需求文档骨架） */
  platforms?: string[];
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
          // 去掉 markdown 反引号标记（索引表用 `path` 格式存储）
          filePath: cols[8].replace(/`/g, '').trim(),
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

  const platforms = (info.platforms && info.platforms.length > 0 ? info.platforms : ['web']);
  const platformLabels: Record<string, string> = { web: 'Web 端', h5: 'H5 端', miniapp: '小程序端', backend: '后端' };
  const today = new Date().toISOString().split('T')[0];

  // 创建目录结构
  await ensureDir(join(iterDir, '00-需求文档'));
  await ensureDir(join(iterDir, '01-原型'));
  await ensureDir(join(iterDir, '02-图谱'));
  await ensureDir(join(iterDir, '03-评审'));
  await ensureDir(join(iterDir, '04-交付'));

  // ===== 加工车间结构 =====
  // 素材区（按端归类 + shared + converted 转换产物）
  await ensureDir(join(iterDir, '00-素材'));
  for (const platform of platforms) {
    await ensureDir(join(iterDir, '00-素材', platform));
  }
  await ensureDir(join(iterDir, '00-素材', 'shared'));
  await ensureDir(join(iterDir, '00-素材', 'converted'));
  for (const platform of platforms) {
    await ensureDir(join(iterDir, '00-素材', 'converted', platform));
  }
  await ensureDir(join(iterDir, '00-素材', 'converted', 'shared'));

  // 素材说明
  await writeFile(
    join(iterDir, '00-素材', 'README.md'),
    `# 📥 素材区（按端归类）

> 把材料扔进对应的端目录，跨端通用的（业务规则、全局字段）扔进 shared/：
>
> - ${platforms.map(p => `\`${p}/\``).join(' ')} ← 各端素材（讨论记录、截图、参考文档）
> - \`shared/\` ← 跨端通用素材（业务规则、数据模型、通用流程）
> - \`converted/{端}/\` ← [自动生成] 该端 docx/pdf/xlsx 转换产物（与端目录一一对应）
> - \`converted/shared/\` ← [自动生成] shared 转换产物
> - \`converted/images-index.md\` ← [自动生成] 图片素材索引
> - \`_templates/\` ← [可选] 产品自定模板（详见 _templates/README.md）：有模板用模板，无模板用系统默认
>
> 转换: \`specprot convert -i "${info.name}"\`
> 端级分析: \`specprot analyze -i "${info.name}" -p ${platforms[0]}\`
`
  );

  // 产品模板区（模板优先，系统默认兜底；_templates 不参与素材扫描）
  await ensureDir(join(iterDir, '00-素材', '_templates'));
  await writeFile(
    join(iterDir, '00-素材', '_templates', 'README.md'),
    `# 📐 产品模板区（可选）

> 产品可以按端给出需求文档模板：有模板用模板，没有模板用系统默认。

## 支持覆盖的文档（按文件名匹配）

| 模板文件名 | 覆盖对象 | 生效阶段 |
| :--- | :--- | :--- |
| \`{端}/REQUIREMENT.md\` | 端级需求文档 | analyze |
| \`{端}/UNIT_REQUIREMENT.md\` | 功能单元文档 | slice |
| \`{端}/CLARIFY.md\` | 待确认清单 | analyze |

## 目录规则

- 端专属模板放 \`{端}/\` 子目录（web / h5 / miniapp / backend），只影响该端；
- 放 \`_templates/\` 根级同名文件 = 所有端共用；
- 匹配优先级：\`{端}/专属\` > \`根级共用\` > \`系统默认\`；
- 模板只需给出章节结构（标题 + 一句话说明），AI 按结构成文；
- 系统强制结构（OUTLINE 四段契约、RISK 三列裁决）不开放模板覆盖。
`
  );

  // 各端需求文档骨架 + features 功能单元目录
  for (const platform of platforms) {
    const platformLabel = platformLabels[platform] || platform;
    await ensureDir(join(iterDir, platform, 'features'));
    await writeFile(
      join(iterDir, platform, 'REQUIREMENT.md'),
      `# ${info.name} — ${platformLabel}需求文档

> 期次：${info.name}
> 平台：${platformLabel}
> 状态：📥 素材收集中
> 创建日期：${today}

## 1. 需求背景

_待批量生成_

## 2. 用户场景

_待批量生成_

## 3. 功能描述

_待批量生成_

## 4. 页面/接口

_待批量生成_

## 5. 数据字段

_待批量生成_

## 6. 业务规则

_待批量生成_

## 7. 验收标准

_待批量生成_

---
_最后一次批量生成：—_
`
    );
    await writeFile(
      join(iterDir, platform, 'features', 'INDEX.md'),
      `# ${platformLabel}功能单元索引

> 本文件由 \`specprot slice\` 预建，AI 接力填充功能单元清单。

| 功能单元 | 一句话描述 | 状态 | 素材溯源 |
| :--- | :--- | :--- | :--- |
| _待切分_ | | | |
`
    );
  }

  // 跨端共享区
  await ensureDir(join(iterDir, '_shared'));
  await writeFile(
    join(iterDir, '_shared', 'data-model.md'),
    `# ${info.name} — 数据模型

> 跨端共享的数据字段定义
`
  );
  await writeFile(
    join(iterDir, '_shared', 'business-rules.md'),
    `# ${info.name} — 业务规则

> 跨端共享的业务规则和约束
`
  );

  // README.md
  await writeFile(join(iterDir, 'README.md'), `# ${info.name}

> 目标：${info.goal}
> 时间：${info.from || '未指定'} ~ ${info.to || '未指定'}
> 平台：${platforms.join(', ')}
> 状态：🔄 进行中

## 本期需求

| 需求 ID | 需求名称 | 类型 | 状态 | 原型 | 流程图 | 评审 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| | | | | | | |

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
  const newRow = `| ${reqId} | ${entry.name} | 新增 | 📝 草稿 | — | — | — |`;

  if (content.includes('| | | | | | | |')) {
    content = content.replace('| | | | | | | |', newRow);
  } else {
    const tableStart = content.indexOf('| 需求 ID |');
    const tableEnd = content.indexOf('\n##', tableStart);
    const insertPos = tableEnd > tableStart ? tableEnd : content.length;
    content = content.slice(0, insertPos) + '\n' + newRow + content.slice(insertPos);
  }

  await writeFile(readmePath, content);
}

/**
 * 收养功能单元进正典（新增血缘）
 * 期次加工车间中定稿的功能单元 → 归并为正典需求（GLOBAL/PROJECTS 新建 REQ）
 */
export async function adoptFeatureToGlobal(
  iterationName: string,
  platform: string,
  featureName: string,
  project: string = 'default'
): Promise<ReqIndexEntry> {
  const featurePath = join(getIterationDir(iterationName), platform, 'features', featureName, 'REQUIREMENT.md');
  if (!(await pathExists(featurePath))) {
    throw new Error(`功能单元不存在: ${iterationName}/${platform}/features/${featureName}`);
  }
  const featureContent = await readFile(featurePath, 'utf-8');

  const index = await readGlobalIndex();
  const today = new Date().toISOString().split('T')[0];

  // 幂等检查：同一功能单元只收养一次，重复收养直接返回既有正典需求
  for (const r of index.reqs) {
    const existingPath = join(getGlobalDir(), r.filePath);
    if (!(await pathExists(existingPath))) continue;
    const existingContent = await readFile(existingPath, 'utf-8');
    if (existingContent.includes(`| 来源功能单元 | ${platform}/features/${featureName} |`)) {
      return r;
    }
  }

  const reqId = getNextReqId(index);

  const projDir = join(getGlobalDir(), 'PROJECTS', project);
  await ensureDir(projDir);

  const content = `# ${reqId}：${featureName}

> **元数据**
> | 字段 | 值 |
> | :--- | :--- |
> | 需求 ID | ${reqId} |
> | 所属项目 | ${project} |
> | 当前版本 | v1.0 |
> | 状态 | 📝 草稿 |
> | 关联期次 | ${iterationName} |
> | 来源功能单元 | ${platform}/features/${featureName} |
> | 创建日期 | ${today} |

## 需求描述

${featureContent}

## 变更历史

| 版本 | 日期 | 变更内容 | 变更人 |
| :--- | :--- | :--- | :--- |
| v1.0 | ${today} | 由功能单元收养（${iterationName}/${platform}/features/${featureName}） | — |
`;

  const fileName = `${reqId}-${featureName}.md`;
  await writeFile(join(projDir, fileName), content);

  const entry: ReqIndexEntry = {
    id: reqId,
    project,
    name: featureName,
    status: '📝 草稿',
    version: 'v1.0',
    iteration: iterationName,
    task: '',
    filePath: `PROJECTS/${project}/${fileName}`,
  };
  await appendReqToIndex(entry);

  // 更新期次 README 的"本期需求"表（类型 = 新增）
  const readmePath = join(getIterationDir(iterationName), 'README.md');
  if (await pathExists(readmePath)) {
    let rm = await readFile(readmePath, 'utf-8');
    const newRow = `| ${reqId} | ${featureName} | 新增 | 📝 草稿 | — | — | — |`;
    if (rm.includes('| | | | | | | |')) {
      rm = rm.replace('| | | | | | | |', newRow);
    } else if (!rm.includes(`| ${reqId} |`)) {
      const tableStart = rm.indexOf('| 需求 ID |');
      const tableEnd = rm.indexOf('\n##', tableStart);
      const insertPos = tableEnd > tableStart ? tableEnd : rm.length;
      rm = rm.slice(0, insertPos) + '\n' + newRow + rm.slice(insertPos);
    }
    await writeFile(readmePath, rm);
  }

  return entry;
}

/**
 * 变更血缘：基于正典需求发起变更（迭代层 → 全局层的回流入口）
 * 标记正典 REQ 为"变更中"并锁定关联期次，期次冻结时版本演进 + 变更历史落定。
 */
export async function changeRequirement(
  reqId: string,
  iterationName: string,
  changeDesc: string = ''
): Promise<ReqIndexEntry> {
  const index = await readGlobalIndex();
  const req = index.reqs.find((r) => r.id === reqId);
  if (!req) {
    throw new Error(`需求不存在: ${reqId}`);
  }

  const reqPath = join(getGlobalDir(), req.filePath);
  if (!(await pathExists(reqPath))) {
    throw new Error(`需求文件缺失: ${req.filePath}`);
  }

  const today = new Date().toISOString().split('T')[0];
  let content = await readFile(reqPath, 'utf-8');

  // 状态 → 变更中，关联期次更新
  content = content.replace(/\| 状态 \| [^|]+ \|/, `| 状态 | 🔄 变更中（${iterationName}） |`);
  content = content.replace(/\| 关联期次 \| [^|]+ \|/, `| 关联期次 | ${iterationName} |`);

  // 变更历史表追加"变更发起"占位行（冻结回流时替换为真实版本号）
  if (!content.includes('变更发起')) {
    const histLine = `| v?.? | ${today} | 变更发起（${iterationName}）${changeDesc ? '：' + changeDesc : ''} | — |`;
    content = content.replace(/(\| v1\.0 \| [^\n]+\n)/, `$1${histLine}\n`);
  }

  await writeFile(reqPath, content);

  // 索引同步：状态 → 开发中（变更实施期），锁定期次
  req.status = '🔄 开发中';
  req.iteration = iterationName;
  await updateReqInIndex(reqId, { status: '🔄 开发中', iteration: iterationName });

  return req;
}

/** 从 SCHEMES.md 提取推荐方案段（快照正文用） */
function buildRecommendedBlock(schemesContent: string, recommendedIds: string[]): string {
  if (recommendedIds.length === 0) return '';
  const sections = schemesContent.split(/^## /m).slice(1);
  let block = '\n## 推荐方案（产品圈选）\n';
  let found = 0;
  for (const sec of sections) {
    const firstLine = sec.split('\n')[0].trim();
    const idMatch = firstLine.match(/^S\d+/);
    if (idMatch && recommendedIds.includes(idMatch[0])) {
      block += `\n### ${firstLine}\n` + sec.slice(firstLine.length).trim() + '\n';
      found++;
    }
  }
  return found > 0 ? block : '';
}

/**
 * 冻结期次：状态锁定 + 生成交接快照（v0.2.0）
 *
 * 快照 = 文件复制：把本期需求从 GLOBAL/PROJECTS 复制到 {期次}/04-交付/，
 * 每个文件头部加 SPECPROT-SNAPSHOT 元数据（来源 / 冻结时间 / 冻结版本）。
 * GLOBAL 源文件仍是唯一权威版本，快照只用于交接（如手动复制到 SpecCore 的 sources/）。
 */
/**
 * v0.3.2: 交付镜像 — 把期次资产聚拢到 04-交付/，对齐 SpecCore 010-requirements/
 * 原型 HTML → assets/prototypes/{单元}/；图 .mmd → assets/designs/{单元}/；
 * 素材截图 → assets/screenshots/（重名加端前缀）；转换产物 → converted/（根级 + 各端）
 * 冻结后 04-交付/ 可整目录复制到 SpecCore 的 010-requirements/，外链不丢。
 */
async function collectDeliveryAssets(iterDir: string, deliveryDir: string): Promise<void> {
  const copyOne = async (src: string, dest: string): Promise<void> => {
    if (await pathExists(src)) await copy(src, dest);
  };

  // 1. 各端功能单元资产：原型 HTML / 图 .mmd
  for (const pf of ['web', 'h5', 'miniapp', 'backend'] as const) {
    const featuresDir = join(iterDir, pf, 'features');
    if (!(await pathExists(featuresDir))) continue;
    for (const f of await readdir(featuresDir)) {
      if (f === 'INDEX.md' || f.startsWith('.')) continue;
      const unitAssets = join(featuresDir, f, 'assets');
      if (!(await pathExists(unitAssets))) continue;
      const protoDir = join(unitAssets, 'prototype');
      if (await pathExists(protoDir)) {
        const outDir = join(deliveryDir, 'assets', 'prototypes', f);
        await ensureDir(outDir);
        for (const h of await readdir(protoDir)) {
          if (h.endsWith('.html')) await copyOne(join(protoDir, h), join(outDir, h));
        }
      }
      const diagDir = join(unitAssets, 'diagrams');
      if (await pathExists(diagDir)) {
        const outDir = join(deliveryDir, 'assets', 'designs', f);
        await ensureDir(outDir);
        for (const m of await readdir(diagDir)) {
          if (m.endsWith('.mmd')) await copyOne(join(diagDir, m), join(outDir, m));
        }
      }
    }
  }

  // 2. 素材截图 → assets/screenshots/（重名加端前缀）
  for (const pf of ['web', 'h5', 'miniapp', 'backend', 'shared'] as const) {
    const matDir = join(iterDir, '00-素材', pf);
    if (!(await pathExists(matDir))) continue;
    for (const f of await readdir(matDir)) {
      if (!/\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(f)) continue;
      const shotDir = join(deliveryDir, 'assets', 'screenshots');
      await ensureDir(shotDir);
      if (await pathExists(join(shotDir, f))) {
        await copyOne(join(matDir, f), join(shotDir, pf + '-' + f));
      } else {
        await copyOne(join(matDir, f), join(shotDir, f));
      }
    }
  }

  // 3. 转换产物镜像 → converted/（根级 + 各端，doc2spec 可跳过）
  const convSrc = join(iterDir, '00-素材', 'converted');
  if (await pathExists(convSrc)) {
    for (const f of await readdir(convSrc)) {
      const sp = join(convSrc, f);
      try {
        const st = await stat(sp);
        if (st.isFile() && f.endsWith('.md')) {
          await ensureDir(join(deliveryDir, 'converted'));
          await copyOne(sp, join(deliveryDir, 'converted', f));
        }
      } catch { /* 目录跳过 */ }
    }
    for (const pf of ['web', 'h5', 'miniapp', 'backend', 'shared'] as const) {
      const convPf = join(convSrc, pf);
      if (!(await pathExists(convPf))) continue;
      for (const f of await readdir(convPf)) {
        if (!f.endsWith('.md')) continue;
        await ensureDir(join(deliveryDir, 'converted', pf));
        await copyOne(join(convPf, f), join(deliveryDir, 'converted', pf, f));
      }
    }
  }
}

export async function freezeIteration(name: string, opts: { force?: boolean } = {}): Promise<string> {
  const iterDir = getIterationDir(name);
  const readmePath = join(iterDir, 'README.md');

  if (!(await pathExists(readmePath))) {
    throw new Error(`期次不存在: ${name}`);
  }

  // v0.3.1: 冻结门禁 — 风险未裁决 / 待确认未决 不可冻结（--force 跳过）
  if (!opts.force) {
    const gates: string[] = [];
    for (const pf of ['web', 'h5', 'miniapp', 'backend'] as const) {
      const featuresDir = join(iterDir, pf, 'features');
      if (!(await pathExists(featuresDir))) continue;
      for (const f of await readdir(featuresDir)) {
        if (f === 'INDEX.md' || f.startsWith('.')) continue;
        const riskPath = join(featuresDir, f, 'RISK.md');
        if (await pathExists(riskPath)) {
          const risk = await readFile(riskPath, 'utf-8');
          if (risk.includes('待裁决')) gates.push(`${pf}/features/${f}/RISK.md 存在待裁决风险`);
        }
        const clarifyPath = join(featuresDir, f, 'CLARIFY.md');
        if (await pathExists(clarifyPath)) {
          const clarify = await readFile(clarifyPath, 'utf-8');
          if (clarify.includes('未决')) gates.push(`${pf}/features/${f}/CLARIFY.md 存在未决问题`);
        }
      }
    }
    if (gates.length > 0) {
      console.error('⛔ 冻结门禁拦截 — 以下问题必须清零后方可冻结:');
      for (const g of gates) console.error(`   - ${g}`);
      console.error('   （裁决风险/确认问题后重试；确需跳过用 --force，慎用）');
      return '';
    }
  }

  let content = await readFile(readmePath, 'utf-8');
  // 用正则替换状态行（批量引擎可能已把状态改为"📝 待精修"等，精确字符串替换会失效）
  content = content.replace(/>\s*状态[:：].*/, '> 状态: 🔒 已冻结');
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

  // 变更回流：本期的变更需求在冻结时版本演进 + 变更历史落定
  const index = await readGlobalIndex();
  const frozenAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  for (const req of index.reqs.filter((r) => r.iteration === name)) {
    const src = join(getGlobalDir(), req.filePath);
    if (!(await pathExists(src))) continue;
    let reqContent = await readFile(src, 'utf-8');
    if (!reqContent.includes('变更发起')) continue;

    // 版本演进 vX.Y → vX.(Y+1)
    const verMatch = reqContent.match(/\| 当前版本 \| v(\d+)\.(\d+) \|/);
    if (!verMatch) continue;
    const newVersion = `v${verMatch[1]}.${parseInt(verMatch[2], 10) + 1}`;
    reqContent = reqContent.replace(/\| 当前版本 \| [^|]+ \|/, `| 当前版本 | ${newVersion} |`);
    reqContent = reqContent.replace(/\| 状态 \| [^|]+ \|/, `| 状态 | ✔️ 已交付 |`);
    reqContent = reqContent.replace(
      /\| v\?\.\? \| [^|]+ \| 变更发起[^|]* \| [^|]* \|/,
      `| ${newVersion} | ${frozenAt} | 变更回流（${name}） | — |`
    );
    await writeFile(src, reqContent);

    // 索引同步（内存对象同步更新，供下方快照使用回流后的版本号）
    req.version = newVersion;
    req.status = '✔️ 已交付';
    await updateReqInIndex(req.id, { status: '✔️ 已交付', version: newVersion });
  }

  // v0.2.0: 生成交接快照
  const reqs = index.reqs.filter((r) => r.iteration === name);
  const deliveryDir = join(iterDir, '04-交付');
  await ensureDir(deliveryDir);
  // v0.3.2: 交付镜像目录（对齐 SpecCore 010-requirements/，整目录复制即交接）
  await ensureDir(join(deliveryDir, 'sources'));
  const copied: { file: string; source: string; version: string }[] = [];
  // v0.3.1: 方案分叉收集（推荐进正文，全部进备选附录）
  const alternativeEntries: Array<{ req: string; unit: string; content: string }> = [];

  for (const req of reqs) {
    const src = join(getGlobalDir(), req.filePath);
    if (!(await pathExists(src))) continue;

    const srcContent = await readFile(src, 'utf-8');
    const header = `<!-- SPECPROT-SNAPSHOT
  来源: GLOBAL/${req.filePath}
  冻结时间: ${frozenAt}
  冻结版本: ${req.version}
  状态: 🔒 已冻结
-->
\n`;

    // 推荐方案进快照正文（产品圈选「推荐: Sx」）
    let recommendedBlock = '';
    const srcUnit = srcContent.match(/\| 来源功能单元 \| ([^|]+) \|/);
    if (srcUnit) {
      const parts = srcUnit[1].trim().split('/'); // {platform}/features/{feature}
      if (parts.length === 3 && parts[1] === 'features') {
        const schemesPath = join(iterDir, parts[0], 'features', parts[2], 'SCHEMES.md');
        if (await pathExists(schemesPath)) {
          const sc = await readFile(schemesPath, 'utf-8');
          const recMatch = sc.match(/推荐[:：]\s*(S\d+[^\n]*)/);
          const recommendedIds = recMatch ? (recMatch[1].match(/S\d+/g) || []) : [];
          recommendedBlock = buildRecommendedBlock(sc, recommendedIds);
          alternativeEntries.push({ req: req.id, unit: srcUnit[1].trim(), content: sc });
        }
      }
    }

    const destName = basename(req.filePath);
    await writeFile(join(deliveryDir, 'sources', destName), header + srcContent + recommendedBlock);
    copied.push({ file: destName, source: req.filePath, version: req.version });
  }

  // v0.3.1: 备选方案附录（全部方案保留，SpecCore 技术阶段可再选）
  if (alternativeEntries.length > 0) {
    let apx = `# 备选方案附录 — ${name}\n\n> 冻结时间: ${frozenAt}\n> 说明: 本期各单元的全部方案分叉。推荐方案已进对应快照正文，其余方案保留在此，SpecCore 技术阶段可再选。\n\n`;
    for (const e of alternativeEntries) {
      apx += `---\n\n## ${e.req} · 来源: ${e.unit}\n\n${e.content}\n`;
    }
    await writeFile(join(deliveryDir, 'sources', '备选方案附录.md'), apx);
  }

  // v0.3.2: 资产交付镜像（原型/图/截图/转换产物 → SpecCore 同构目录）
  await collectDeliveryAssets(iterDir, deliveryDir);

  // 交接说明
  const rows = copied
    .map((c) => `| ${c.file} | GLOBAL/${c.source} | ${c.version} |`)
    .join('\n');
  await writeFile(
    join(deliveryDir, 'README.md'),
    `# 期次交付物 — ${name}

> 冻结时间: ${frozenAt}
> 本目录为需求快照（冻结副本），GLOBAL/PROJECTS 中源文件仍是唯一权威版本。

## 快照清单

| 文件 | 来源 | 冻结版本 |
| :--- | :--- | :--- |
${rows}

## 交接指引

1. 将本目录**整体复制**到 SpecCore 迭代目录的 \`010-requirements/\`（同名子目录合并）:
   - \`sources/\` → 需求快照（unitize 的输入）
   - \`converted/\` → 已转换素材 md（doc2spec 可跳过）
   - \`assets/prototypes/\` → 原型 HTML（按单元子目录）
   - \`assets/designs/\` → Mermaid 图源 .mmd（按单元子目录）
   - \`assets/screenshots/\` → 参考截图（重名加端前缀）
2. 在 SpecCore 中执行 \`speccore unitize\` 完成需求切分
3. 每个快照文件头部的 SPECPROT-SNAPSHOT 元数据记录了来源与冻结信息，便于追溯
`
  );

  return deliveryDir;
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
