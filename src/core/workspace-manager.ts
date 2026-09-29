/**
 * 期次加工车间管理器 — SpecProt 迭代层引擎
 *
 * 核心理念：
 *   产品经理不是"写一个文档"，而是"把素材按端扔进期次目录，让 AI 消化、分析、切分出功能单元"
 *
 * 期次加工车间结构（迭代层）：
 *   期次-XXX/
 *   ├── 00-素材/       ← 产品扔进来的所有材料（按端归类 + shared + converted）
 *   ├── web/           ← Web 端需求文档 + features/ 功能单元
 *   ├── h5/            ← H5 端需求文档 + features/ 功能单元
 *   ├── miniapp/       ← 小程序端需求文档 + features/ 功能单元
 *   ├── backend/       ← 后端需求文档 + features/ 功能单元
 *   ├── _shared/       ← 跨端共享（数据模型、业务规则）
 *   ├── 00-需求文档/   ← 正典引用清单
 *   ├── 01-原型/ 02-图谱/ 03-评审/ 04-交付/
 *   └── README.md      ← 期次状态追踪（平台/状态/里程碑）
 */

import { ensureDir, writeFile, readFile, pathExists, readdir } from 'fs-extra';
import { join } from 'path';

// ============================================================
// 类型定义
// ============================================================

export type Platform = 'web' | 'h5' | 'miniapp' | 'backend';

export type WorkspaceStatus =
  | '📥 素材收集中'
  | '🤖 批量生成中'
  | '📝 待精修'
  | '🔍 评审中'
  | '🔒 已冻结'
  | '✔️ 已交付'
  | '⏸️ 暂缓';

/** 期次状态（README.md 中的粗粒度状态） */
export type IterationStatus = '🔄 进行中' | '🔒 已冻结' | '✔️ 已交付' | '⏸️ 暂缓';

export interface WorkspaceInfo {
  name: string;           // 目录名 = 期次名
  platforms: Platform[];  // 涉及哪些端
  status: IterationStatus;
  materials: string[];    // 素材文件列表
  createdAt: string;
  updatedAt: string;
}

/** 素材摘要（AI 读取素材后聚合的上下文） */
export interface MaterialContext {
  iterationName: string;
  sources: {
    file: string;
    content: string;
    platform: Platform | 'shared' | 'unknown';
    type: 'discussion' | 'reference' | 'idea' | 'screenshot' | 'converted' | 'other';
  }[];
  identifiedRoles: string[];      // 从素材中识别的用户角色
  identifiedScenarios: string[];  // 从素材中识别的场景
  identifiedConstraints: string[]; // 从素材中识别的约束
  rawText: string;                // 所有文本素材的拼接
}

// ============================================================
// 路径工具
// ============================================================

/** 全局层目录锚点（正典 / 风险透镜 / 全局资产共用） */
export function getSpeccoreDir(): string {
  return join(process.cwd(), '.speccore');
}

export function getWorkspaceDir(iterationName: string): string {
  return join(process.cwd(), iterationName);
}

function getMaterialsDir(iterationName: string): string {
  return join(getWorkspaceDir(iterationName), '00-素材');
}

/** 素材端子目录（含跨端通用 shared 与转换产物 converted） */
export function getMaterialPlatformDir(iterationName: string, platform: Platform | 'shared'): string {
  return join(getMaterialsDir(iterationName), platform);
}

export function getConvertedDir(iterationName: string): string {
  return join(getMaterialsDir(iterationName), 'converted');
}

/** 转换产物端目录（converted/{端}/，与素材端目录一一对应） */
export function getConvertedPlatformDir(iterationName: string, platform: Platform | 'shared'): string {
  return join(getConvertedDir(iterationName), platform);
}

function getPlatformDir(iterationName: string, platform: Platform): string {
  return join(getWorkspaceDir(iterationName), platform);
}

/** 端内功能单元目录（slice 产出，功能单元 = feature） */
export function getPlatformFeaturesDir(iterationName: string, platform: Platform): string {
  return join(getPlatformDir(iterationName, platform), 'features');
}

/** 产品模板目录（{期次}/00-素材/_templates/，产品按端投模板，未提供时用系统默认） */
export function getTemplatesDir(iterationName: string): string {
  return join(getMaterialsDir(iterationName), '_templates');
}

/**
 * 解析产品文档模板（模板优先，系统默认兜底）
 * 匹配顺序：_templates/{端}/{docName} → _templates/{docName} → null（用系统默认）
 */
export async function resolvePlatformTemplate(
  iterationName: string,
  platform: Platform | string,
  docName: string
): Promise<{ path: string; content: string } | null> {
  const templatesDir = getTemplatesDir(iterationName);
  const candidates = [join(templatesDir, platform, docName), join(templatesDir, docName)];
  for (const p of candidates) {
    if (await pathExists(p)) {
      return { path: p, content: await readFile(p, 'utf-8') };
    }
  }
  return null;
}

/** 跨端共享目录（{期次}/_shared/，术语表 / 共享规则 / 数据模型，经底部导出块导出） */
function getSharedDir(iterationName: string): string {
  return join(getWorkspaceDir(iterationName), '_shared');
}

export function getWorkspaceReadmePath(iterationName: string): string {
  return join(getWorkspaceDir(iterationName), 'README.md');
}

// ============================================================
// 素材收集
// ============================================================

/**
 * 扫描期次加工车间，收集所有素材（按端归类递归扫描）
 * targetPlatform 指定时只收集该端素材 + shared/ + converted/ 转换产物
 */
export async function collectMaterials(
  iterationName: string,
  targetPlatform?: Platform | 'shared'
): Promise<MaterialContext> {
  const materialsDir = getMaterialsDir(iterationName);
  const context: MaterialContext = {
    iterationName,
    sources: [],
    identifiedRoles: [],
    identifiedScenarios: [],
    identifiedConstraints: [],
    rawText: '',
  };

  if (!(await pathExists(materialsDir))) {
    return context;
  }

  // 素材端子目录 + converted 转换产物子目录（converted/{端}/ 与素材端目录一一对应）
  const rawDirs: Array<{ dir: string; platform: Platform | 'shared' }> = [
    { dir: 'web', platform: 'web' },
    { dir: 'h5', platform: 'h5' },
    { dir: 'miniapp', platform: 'miniapp' },
    { dir: 'backend', platform: 'backend' },
    { dir: 'shared', platform: 'shared' },
  ];
  // converted/{端}/ 归对应端；converted/shared/ 与根级文件（images-index.md）归 shared
  const convertedDirs: Array<{ dir: string; platform: Platform | 'shared' }> = [
    { dir: 'converted/web', platform: 'web' },
    { dir: 'converted/h5', platform: 'h5' },
    { dir: 'converted/miniapp', platform: 'miniapp' },
    { dir: 'converted/backend', platform: 'backend' },
    { dir: 'converted/shared', platform: 'shared' },
    { dir: 'converted', platform: 'shared' },
  ];

  const keepPlatform = (platform: Platform | 'shared') => {
    if (!targetPlatform || targetPlatform === 'shared') return true;
    // 端级分析：本端素材 + 本端转换产物 + 跨端通用
    return platform === 'shared' || platform === targetPlatform;
  };
  const rawPlatformDirs = rawDirs.filter(({ platform }) => keepPlatform(platform));
  const convPlatformDirs = convertedDirs.filter(({ platform }) => keepPlatform(platform));

  const textParts: string[] = [];

  const scanDir = async (dir: string, platform: Platform | 'shared', isConverted = false) => {
    const fullDir = join(materialsDir, dir);
    if (!(await pathExists(fullDir))) return;

    for (const file of await readdir(fullDir)) {
      if (file === 'README.md') continue;
      const filePath = join(fullDir, file);

      try {
        const { stat } = await import('fs-extra');
        const st = await stat(filePath);
        if (st.isDirectory()) continue;
      } catch { continue; }

      try {
        const content = await readFile(filePath, 'utf-8');

        // 分类素材类型
        let type: MaterialContext['sources'][0]['type'] = isConverted ? 'converted' : 'other';
        if (file.includes('讨论') || file.includes('会议')) type = 'discussion';
        else if (file.includes('参考') || file.includes('链接')) type = 'reference';
        else if (file.includes('想法') || file.includes('随笔')) type = 'idea';
        else if (file.match(/\.(png|jpg|jpeg|gif|bmp)$/i)) type = 'screenshot';

        context.sources.push({ file: `${dir}/${file}`, content: content.slice(0, 5000), platform, type });
        textParts.push(`[${dir}/${file}]\n${content}`);
      } catch {
        // 跳过二进制文件
        context.sources.push({ file: `${dir}/${file}`, content: `[非文本文件: ${file}]`, platform, type: 'other' });
      }
    }
  };

  for (const { dir, platform } of rawPlatformDirs) {
    await scanDir(dir, platform);
  }
  for (const { dir, platform } of convPlatformDirs) {
    await scanDir(dir, platform, true);
  }

  context.rawText = textParts.join('\n\n---\n\n');
  return context;
}

// ============================================================
// 期次信息读取与状态流转
// ============================================================

/** 平台中文标签映射 */
export const PLATFORM_LABELS: Record<Platform, string> = {
  web: 'Web 端',
  h5: 'H5 端',
  miniapp: '小程序端',
  backend: '后端',
};

/**
 * 读取期次加工车间信息（从 README.md 解析）
 */
export async function readWorkspaceInfo(iterationName: string): Promise<WorkspaceInfo | null> {
  const readmePath = getWorkspaceReadmePath(iterationName);
  if (!(await pathExists(readmePath))) return null;

  const content = await readFile(readmePath, 'utf-8');

  // 解析平台（`> 平台: web,h5` 行）
  const platformMatch = content.match(/>\s*平台[:：]\s*(.+)/);
  const platforms: Platform[] = [];
  if (platformMatch) {
    const platStr = platformMatch[1];
    for (const p of ['web', 'h5', 'miniapp', 'backend'] as Platform[]) {
      if (platStr.includes(p)) platforms.push(p);
    }
  }

  // 解析状态（`> 状态: 🔄 进行中` 行）
  const statusMatch = content.match(/>\s*状态[:：]\s*(.+)/);
  const status = (statusMatch?.[1]?.trim() || '🔄 进行中') as IterationStatus;

  // 素材文件列表（从素材区实际读取）
  const materials: string[] = [];
  const matDir = getMaterialsDir(iterationName);
  if (await pathExists(matDir)) {
    for (const p of [...platforms, 'shared'] as (Platform | 'shared')[]) {
      const pd = getMaterialPlatformDir(iterationName, p);
      if (!(await pathExists(pd))) continue;
      const files = await readdir(pd);
      materials.push(...files.filter(f => f !== 'README.md' && !f.startsWith('.')).map(f => `${p}/${f}`));
    }
  }

  return {
    name: iterationName,
    platforms,
    status,
    materials,
    createdAt: '',
    updatedAt: '',
  };
}

/**
 * 列出所有活跃期次（README.md 含"状态"行即期次；默认只看进行中）
 */
export async function listActiveIterations(onlyActive = true): Promise<WorkspaceInfo[]> {
  const cwd = process.cwd();
  const entries = await readdir(cwd, { withFileTypes: true });
  const iterations: WorkspaceInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // 期次车间的标志：有 README.md
    if (!(await pathExists(join(cwd, entry.name, 'README.md')))) continue;
    const info = await readWorkspaceInfo(entry.name);
    if (!info) continue;
    if (onlyActive && !['🔄 进行中', '�� 素材收集中'].includes(info.status)) continue;
    iterations.push(info);
  }

  return iterations;
}

/**
 * 更新期次状态（写入 README.md 的状态行）
 */
export async function updateIterationStatus(iterationName: string, status: IterationStatus | WorkspaceStatus): Promise<void> {
  const readmePath = getWorkspaceReadmePath(iterationName);
  if (!(await pathExists(readmePath))) {
    throw new Error(`期次不存在: ${iterationName}`);
  }

  let content = await readFile(readmePath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];

  // 更新状态行（`> 状态: xxx`）
  if (!content.includes('> 状态')) {
    throw new Error(`期次 README.md 缺少状态行: ${iterationName}`);
  }
  content = content.replace(/>\s*状态[:：].+/, `> 状态: ${status}`);
  content = content.replace(/>\s*更新[:：].+/, `> 更新: ${today}`);

  await writeFile(readmePath, content);
}

/**
 * 批量更新需求文档（各端）
 */
export async function updatePlatformDoc(
  iterationName: string,
  platform: Platform,
  content: string
): Promise<void> {
  const docPath = join(getPlatformDir(iterationName, platform), 'REQUIREMENT.md');
  const today = new Date().toISOString().split('T')[0];

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
};
