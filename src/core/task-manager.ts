/**
 * 任务管理器 — SpecProt 任务文件夹引擎
 *
 * 核心理念：
 *   产品经理不是"写一个文档"，而是"扔一堆材料到文件夹，让 AI 消化、分析、生成各端产出"
 *
 * 任务文件夹结构：
 *   {任务名}/
 *   ├── 00-素材/       ← 产品扔进来的所有材料（讨论、截图、想法、参考）
 *   ├── web/           ← Web 端需求文档
 *   ├── h5/            ← H5 端需求文档
 *   ├── miniapp/       ← 小程序端需求文档
 *   ├── _shared/       ← 跨端共享（数据模型、业务规则）
 *   ├── 产出/          ← AI 生成物（原型、图谱、评审）
 *   └── TASK.md        ← 任务状态追踪
 */

import { ensureDir, writeFile, readFile, pathExists, readdir } from 'fs-extra';
import { join } from 'path';

// ============================================================
// 类型定义
// ============================================================

export type Platform = 'web' | 'h5' | 'miniapp' | 'backend';

export type TaskStatus =
  | '📥 素材收集中'
  | '🤖 批量生成中'
  | '📝 待精修'
  | '🔍 评审中'
  | '🔒 已冻结'
  | '✔️ 已交付'
  | '⏸️ 暂缓';

export interface TaskInfo {
  name: string;           // 文件夹名 = 任务名
  platforms: Platform[];  // 涉及哪些端
  status: TaskStatus;
  materials: string[];    // 素材文件列表
  createdAt: string;
  updatedAt: string;
  batchRunAt?: string;    // 最后一次批量执行的時間
}

/** 素材摘要（AI 读取素材后聚合的上下文） */
export interface MaterialContext {
  taskName: string;
  sources: { file: string; content: string; type: 'discussion' | 'reference' | 'idea' | 'screenshot' | 'other' }[];
  identifiedRoles: string[];      // 从素材中识别的用户角色
  identifiedScenarios: string[];  // 从素材中识别的场景
  identifiedConstraints: string[]; // 从素材中识别的约束
  rawText: string;                // 所有文本素材的拼接
}

// ============================================================
// 路径工具
// ============================================================

export function getTaskDir(taskName: string): string {
  return join(process.cwd(), taskName);
}

function getMaterialsDir(taskName: string): string {
  return join(getTaskDir(taskName), '00-素材');
}

function getPlatformDir(taskName: string, platform: Platform): string {
  return join(getTaskDir(taskName), platform);
}

function getSharedDir(taskName: string): string {
  return join(getTaskDir(taskName), '_shared');
}

function getOutputDir(taskName: string): string {
  return join(getTaskDir(taskName), '产出');
}

export function getTaskMetaPath(taskName: string): string {
  return join(getTaskDir(taskName), 'TASK.md');
}

// ============================================================
// 任务生命周期
// ============================================================

/**
 * 创建任务文件夹
 */
export async function createTask(
  name: string,
  platforms: Platform[] = ['web'],
  description: string = ''
): Promise<TaskInfo> {
  const taskDir = getTaskDir(name);

  if (await pathExists(taskDir)) {
    throw new Error(`任务已存在: ${name}`);
  }

  const today = new Date().toISOString().split('T')[0];

  // 创建目录结构
  await ensureDir(getMaterialsDir(name));
  await ensureDir(getSharedDir(name));
  await ensureDir(getOutputDir(name));

  for (const platform of platforms) {
    await ensureDir(getPlatformDir(name, platform));
  }

  // 创建素材说明
  await writeFile(
    join(getMaterialsDir(name), 'README.md'),
    `# 📥 素材区

> 把和这个需求相关的所有材料扔进来：
> - 会议讨论记录
> - 竞品截图 / 链接
> - 随手记的想法
> - 参考文档 / PPT
> - Figma / 蓝湖链接
>
> AI 会读取所有材料，自动理解上下文，然后生成需求初稿。
`
  );

  // 创建各端需求文档骨架
  for (const platform of platforms) {
    const platformLabel = { web: 'Web 端', h5: 'H5 端', miniapp: '小程序端', backend: '后端' }[platform];
    await writeFile(
      join(getPlatformDir(name, platform), 'REQUIREMENT.md'),
      `# ${name} — ${platformLabel}需求文档

> 任务：${name}
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
  }

  // 创建共享区
  await writeFile(
    join(getSharedDir(name), 'data-model.md'),
    `# ${name} — 数据模型

> 跨端共享的数据字段定义
`
  );
  await writeFile(
    join(getSharedDir(name), 'business-rules.md'),
    `# ${name} — 业务规则

> 跨端共享的业务规则和约束
`
  );

  // 创建任务追踪文件
  await writeFile(
    getTaskMetaPath(name),
    `# ${name} — 任务追踪

| 属性 | 值 |
| :--- | :--- |
| 任务名称 | ${name} |
| 涉及平台 | ${platforms.map(p => ({ web: 'Web', h5: 'H5', miniapp: '小程序', backend: '后端' }[p])).join('、')} |
| 状态 | 📥 素材收集中 |
| 创建日期 | ${today} |
| 更新日期 | ${today} |
| 素材数 | 0 |
| 上次批量生成 | — |

## 执行历史

| 时间 | 操作 | 结果 |
| :--- | :--- | :--- |
| ${today} | 创建任务 | ✅ |

## 待办

- [ ] 收集素材（截图、讨论、参考）
- [ ] 批量生成各端初稿
- [ ] 精修 Web 端需求
- [ ] 精修 H5 端需求
- [ ] 生成原型
- [ ] 需求评审
- [ ] 冻结交付
`
  );

  const info: TaskInfo = {
    name,
    platforms,
    status: '📥 素材收集中',
    materials: [],
    createdAt: today,
    updatedAt: today,
  };

  return info;
}

/**
 * 扫描任务文件夹，收集所有素材
 */
export async function collectMaterials(taskName: string): Promise<MaterialContext> {
  const materialsDir = getMaterialsDir(taskName);
  const context: MaterialContext = {
    taskName,
    sources: [],
    identifiedRoles: [],
    identifiedScenarios: [],
    identifiedConstraints: [],
    rawText: '',
  };

  if (!(await pathExists(materialsDir))) {
    return context;
  }

  const files = await readdir(materialsDir);
  const textParts: string[] = [];

  for (const file of files) {
    if (file === 'README.md') continue;
    const filePath = join(materialsDir, file);

    try {
      const content = await readFile(filePath, 'utf-8');

      // 分类素材类型
      let type: MaterialContext['sources'][0]['type'] = 'other';
      if (file.includes('讨论') || file.includes('会议')) type = 'discussion';
      else if (file.includes('参考') || file.includes('链接')) type = 'reference';
      else if (file.includes('想法') || file.includes('随笔')) type = 'idea';
      else if (file.match(/\.(png|jpg|jpeg|gif|bmp)$/i)) type = 'screenshot';

      context.sources.push({ file, content: content.slice(0, 5000), type });
      textParts.push(content);
    } catch {
      // 跳过二进制文件
      context.sources.push({ file, content: `[非文本文件: ${file}]`, type: 'other' });
    }
  }

  context.rawText = textParts.join('\n\n---\n\n');
  return context;
}

/**
 * 读取任务信息
 */
export async function readTaskInfo(taskName: string): Promise<TaskInfo | null> {
  const metaPath = getTaskMetaPath(taskName);
  if (!(await pathExists(metaPath))) return null;

  const content = await readFile(metaPath, 'utf-8');

  // 解析平台
  const platformMatch = content.match(/涉及平台\s*\|\s*(.+)/);
  const platforms: Platform[] = [];
  if (platformMatch) {
    const platStr = platformMatch[1];
    if (platStr.includes('Web')) platforms.push('web');
    if (platStr.includes('H5')) platforms.push('h5');
    if (platStr.includes('小程序')) platforms.push('miniapp');
    if (platStr.includes('后端')) platforms.push('backend');
  }

  // 解析状态
  const statusMatch = content.match(/状态\s*\|\s*(.+)/);
  const status = (statusMatch?.[1]?.trim() || '📥 素材收集中') as TaskStatus;

  // 解析素材数
  const matMatch = content.match(/素材数\s*\|\s*(\d+)/);
  const matCount = matMatch ? parseInt(matMatch[1]) : 0;

  const materials: string[] = [];
  if (matCount > 0) {
    // 从文件夹实际读取
    const matDir = getMaterialsDir(taskName);
    if (await pathExists(matDir)) {
      const files = await readdir(matDir);
      materials.push(...files.filter(f => f !== 'README.md'));
    }
  }

  return {
    name: taskName,
    platforms,
    status,
    materials,
    createdAt: '',
    updatedAt: '',
  };
}

/**
 * 列出所有任务
 */
export async function listAllTasks(): Promise<TaskInfo[]> {
  const cwd = process.cwd();
  const entries = await readdir(cwd, { withFileTypes: true });
  const tasks: TaskInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // 任务文件夹的标志：有 TASK.md
    const metaPath = join(cwd, entry.name, 'TASK.md');
    if (await pathExists(metaPath)) {
      const info = await readTaskInfo(entry.name);
      if (info) tasks.push(info);
    }
  }

  return tasks;
}

/**
 * 更新任务状态
 */
export async function updateTaskStatus(taskName: string, status: TaskStatus): Promise<void> {
  const metaPath = getTaskMetaPath(taskName);
  if (!(await pathExists(metaPath))) {
    throw new Error(`任务不存在: ${taskName}`);
  }

  let content = await readFile(metaPath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];

  // 更新状态行
  content = content.replace(/状态\s*\|.+\n/, `状态 | ${status}\n`);
  content = content.replace(/更新日期\s*\|.+\n/, `更新日期 | ${today}\n`);

  // 追加执行历史
  const histLine = `| ${today} | 状态更新 → ${status} | ✅ |`;
  content += `\n${histLine}`;

  await writeFile(metaPath, content);
}

/**
 * 更新任务素材数
 */
export async function updateMaterialCount(taskName: string): Promise<void> {
  const materialsDir = getMaterialsDir(taskName);
  if (!(await pathExists(materialsDir))) return;

  const files = await readdir(materialsDir);
  const count = files.filter(f => f !== 'README.md').length;

  const metaPath = getTaskMetaPath(taskName);
  if (!(await pathExists(metaPath))) return;

  let content = await readFile(metaPath, 'utf-8');
  content = content.replace(/素材数\s*\|\s*\d+/, `素材数 | ${count}`);
  await writeFile(metaPath, content);
}

/**
 * 批量更新需求文档（各端）
 */
export async function updatePlatformDoc(
  taskName: string,
  platform: Platform,
  content: string
): Promise<void> {
  const docPath = join(getPlatformDir(taskName, platform), 'REQUIREMENT.md');
  const today = new Date().toISOString().split('T')[0];

  // 保留元数据头，替换内容
  let existing = '';
  if (await pathExists(docPath)) {
    existing = await readFile(docPath, 'utf-8');
  }

  // 替换 _待批量生成_ 标记
  const fullContent = content.replace(
    '_待批量生成_',
    `_批量生成于 ${today}_`
  );

  await writeFile(docPath, fullContent);
}

// ============================================================
// 导出
// ============================================================

export {
  getMaterialsDir,
  getPlatformDir,
  getSharedDir,
  getOutputDir,
};
