/**
 * 期次加工车间管理器 — SpecProt 迭代层引擎
 *
 * 核心理念：
 *   产品经理不是"写一个文档"，而是"把素材按端扔进期次目录，让 AI 消化、分析、切分出功能单元"
 *
 * 期次加工车间结构（迭代层）：
 *   期次-XXX/
 *   ├── 00-素材/       ← 产品扔进来的所有材料（按端归类 + shared + converted）
 *   │   ├── {端}/      ← 各端素材（端名产品自定，如 web / admin-web / h5-mobile）
 *   │   ├── shared/    ← 跨端通用素材
 *   │   ├── converted/ ← [自动生成] 转换产物（converted/{端}/ 与端目录一一对应）
 *   │   └── _templates/ ← [可选] 产品自定文档模板
 *   ├── {端}/          ← 各端需求文档 + features/ 功能单元（端名与素材区一致）
 *   ├── _shared/       ← 跨端共享（数据模型、业务规则、术语表）
 *   ├── 04-交付/       ← [冻结生成] 交付镜像（对齐 SpecCore 010-requirements/）
 *   └── README.md      ← 期次状态追踪（平台/状态/里程碑）
 */

import { ensureDir, writeFile, readFile, pathExists, readdir, stat } from 'fs-extra';
import { join } from 'path';
import * as yaml from 'js-yaml';

// ============================================================
// 类型定义
// ============================================================

/** 端名 = 产品自定的标识（英文 kebab-case 为佳，如 web / admin-web / booking-service） */
export type Platform = string;

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
    type: 'discussion' | 'reference' | 'idea' | 'screenshot' | 'converted' | 'refined' | 'other';
  }[];
  identifiedRoles: string[];      // 从素材中识别的用户角色
  identifiedScenarios: string[];  // 从素材中识别的场景
  identifiedConstraints: string[]; // 从素材中识别的约束
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

/** 提炼稿目录（converted/{端}/_refined/，宿主 AI 提炼的干货，分析优先依据） */
export function getRefinedPlatformDir(iterationName: string, platform: Platform | 'shared'): string {
  return join(getConvertedPlatformDir(iterationName, platform), '_refined');
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
// 素材处理策略配置（{期次}/.specprot.yml）
// ============================================================

export type MediaMode = 'prompt' | 'ai' | 'local' | 'third-party';

export interface MaterialConfig {
  audio: { mode: MediaMode };
  video: { mode: MediaMode };
  refine: { enabled: boolean };
}

const DEFAULT_CONFIG: MaterialConfig = {
  audio: { mode: 'prompt' },
  video: { mode: 'prompt' },
  refine: { enabled: true },
};

const VALID_MODES = ['prompt', 'ai', 'local', 'third-party'];

/** 读取期次级素材处理策略（缺失/解析失败 → 全默认，向后兼容） */
export async function readMaterialConfig(iterationName: string): Promise<MaterialConfig> {
  const cfgPath = join(process.cwd(), iterationName, '.specprot.yml');
  if (!(await pathExists(cfgPath))) return DEFAULT_CONFIG;
  try {
    const parsed = yaml.load(await readFile(cfgPath, 'utf-8')) as { materials?: any };
    const m = parsed?.materials ?? {};
    const modeOf = (raw: any, fallback: MediaMode): MediaMode =>
      typeof raw?.mode === 'string' && VALID_MODES.includes(raw.mode) ? raw.mode : fallback;
    return {
      audio: { mode: modeOf(m.audio, DEFAULT_CONFIG.audio.mode) },
      video: { mode: modeOf(m.video, DEFAULT_CONFIG.video.mode) },
      refine: { enabled: m.refine?.enabled !== false },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * 期次端列表：README 平台行 ∪ 素材区实际端子目录（端名产品自定，目录即声明）。
 * 供 convert 扫描、run 素材闸口等消费——禁止再硬编码 web/h5/miniapp/backend。
 */
export async function listIterationPlatforms(iterationName: string): Promise<string[]> {
  const platforms: string[] = [];
  const info = await readWorkspaceInfo(iterationName);
  if (info?.platforms?.length) platforms.push(...info.platforms);
  const matDir = getMaterialsDir(iterationName);
  if (await pathExists(matDir)) {
    for (const f of await readdir(matDir)) {
      if (f === 'shared' || f === 'converted' || f === '_templates' || f === 'README.md' || f.startsWith('.')) continue;
      const st = await stat(join(matDir, f)).catch(() => null);
      if (!st || !st.isDirectory()) continue;
      if (!platforms.includes(f)) platforms.push(f);
    }
  }
  return platforms;
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
  };

  if (!(await pathExists(materialsDir))) {
    return context;
  }

  // 素材端子目录 + converted 转换产物子目录 — 端名产品自定，按素材区实际子目录动态扫描
  // （converted/{端}/ 与素材端目录一一对应；converted 根级文件如 images-index.md 归 shared）
  const rawDirs: Array<{ dir: string; platform: Platform | 'shared' }> = [];
  for (const f of await readdir(materialsDir)) {
    if (f === 'shared' || f === 'converted' || f === '_templates' || f === 'README.md' || f.startsWith('.')) continue;
    const st = await stat(join(materialsDir, f));
    if (!st.isDirectory()) continue;
    rawDirs.push({ dir: f, platform: f });
  }
  rawDirs.push({ dir: 'shared', platform: 'shared' });
  const cfg = await readMaterialConfig(iterationName);
  const convertedDirs: Array<{ dir: string; platform: Platform | 'shared' }> = [
    { dir: 'converted', platform: 'shared' },
    { dir: 'converted/shared', platform: 'shared' },
  ];
  if (cfg.refine.enabled) {
    convertedDirs.push({ dir: 'converted/shared/_refined', platform: 'shared' });
  }
  // converted/{端}/ 端集合：素材区端目录 ∪ converted 下实际子目录
  // （覆盖「素材区无该端目录、只有 converted/{端}/_refined/」的场景，如仅投提炼稿）
  const convPlatforms = new Set<string>();
  const convRoot = join(materialsDir, 'converted');
  if (await pathExists(convRoot)) {
    for (const f of await readdir(convRoot)) {
      if (f === 'shared' || f.startsWith('_') || f.startsWith('.')) continue;
      const cst = await stat(join(convRoot, f)).catch(() => null);
      if (cst?.isDirectory()) convPlatforms.add(f);
    }
  }
  for (const d of rawDirs) if (d.platform !== 'shared') convPlatforms.add(d.platform);
  for (const p of convPlatforms) {
    convertedDirs.push({ dir: `converted/${p}`, platform: p });
    // 提炼稿子目录（_refined/）——存在且开启提炼稿机制时优先注入，标记 type=refined
    if (cfg.refine.enabled) {
      convertedDirs.push({ dir: `converted/${p}/_refined`, platform: p });
    }
  }

  const keepPlatform = (platform: Platform | 'shared') => {
    if (!targetPlatform || targetPlatform === 'shared') return true;
    // 端级分析：本端素材 + 本端转换产物 + 跨端通用
    return platform === 'shared' || platform === targetPlatform;
  };
  const rawPlatformDirs = rawDirs.filter(({ platform }) => keepPlatform(platform));
  const convPlatformDirs = convertedDirs.filter(({ platform }) => keepPlatform(platform));

  const scanDir = async (dir: string, platform: Platform | 'shared', isConverted = false, isRefined = false) => {
    const fullDir = join(materialsDir, dir);
    if (!(await pathExists(fullDir))) return;

    for (const file of await readdir(fullDir)) {
      if (file === 'README.md') continue;
      if (file.startsWith('_')) continue; // 清单/索引类文件（如 _pending-ai.md）不入素材
      const filePath = join(fullDir, file);
      const st = await stat(filePath).catch(() => null);
      if (!st || st.isDirectory()) continue;

      // 分类素材类型（_refined/ 目录的文件强制 refined，其余保持原分类）
      const isImage = /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(file);
      let type: MaterialContext['sources'][0]['type'] = isRefined ? 'refined' : isConverted ? 'converted' : 'other';
      if (!isRefined && isImage) type = 'screenshot';
      else if (!isRefined) {
        if (file.includes('讨论') || file.includes('会议')) type = 'discussion';
        else if (file.includes('参考') || file.includes('链接')) type = 'reference';
        else if (file.includes('想法') || file.includes('随笔')) type = 'idea';
      }

      // 图片/二进制不读内容（UTF-8 解二进制不报错、会产生乱码污染 prompt）；AI 按需 Read 原图
      if (isImage) {
        context.sources.push({ file: `${dir}/${file}`, content: `[图片素材: 请用 Read 工具查看 00-素材/${dir}/${file}]`, platform, type });
        continue;
      }

      try {
        const content = await readFile(filePath, 'utf-8');
        const truncated = content.length > 5000;
        const visible = truncated
          ? content.slice(0, 5000) + `\n\n…（内容截断，共 ${content.length} 字符；全文见 00-素材/${dir}/${file}）`
          : content;
        context.sources.push({ file: `${dir}/${file}`, content: visible, platform, type });
      } catch {
        // 非文本文件（加密/损坏等无法以 UTF-8 读取）
        context.sources.push({ file: `${dir}/${file}`, content: `[非文本文件: ${file}]`, platform, type: 'other' });
      }
    }
  };

  for (const { dir, platform } of rawPlatformDirs) {
    await scanDir(dir, platform);
  }
  for (const { dir, platform } of convPlatformDirs) {
    await scanDir(dir, platform, true, dir.includes('/_refined'));
  }

  return context;
}

// ============================================================
// 期次信息读取与状态流转
// ============================================================

/** 端名默认中文标签映射（仅作展示；未知端名显示原名） */
export const PLATFORM_LABELS: Record<string, string> = {
  web: 'Web 端',
  h5: 'H5 端',
  miniapp: '小程序端',
  backend: '后端',
  app: '移动端',
  admin: '管理端',
};

/**
 * 解析端声明串：支持 `web=网页端,backend` / `web(网页端), backend` 双语法。
 * 返回 [{name, label?}]，name 为目录名（命令参数），label 为可选中文展示名。
 */
export function parsePlatformTokens(str: string): { name: string; label?: string }[] {
  return str
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      // `web(网页端)` 或 `web=网页端`
      const m = t.match(/^([^=()]+)(?:[=(]\s*([^)\s]+[^)]*?)\s*[)]?)?$/);
      if (!m) return { name: t };
      return { name: m[1].trim(), label: m[2]?.trim() || undefined };
    });
}

/** 端声明串 → 端名列表（剥离标签与反引号） */
export function platformNamesFrom(decl: string): string[] {
  return parsePlatformTokens(decl)
    .map((t) => t.name.replace(/`/g, ''))
    .filter(Boolean);
}

/** 端名 → 展示标签（产品自定标签 > 默认表 > 原名） */
export function platformLabel(name: string, customLabel?: string): string {
  return customLabel || PLATFORM_LABELS[name] || name;
}

/**
 * 读取期次加工车间信息（从 README.md 解析）
 */
export async function readWorkspaceInfo(iterationName: string): Promise<WorkspaceInfo | null> {
  const readmePath = getWorkspaceReadmePath(iterationName);
  if (!(await pathExists(readmePath))) return null;

  const content = await readFile(readmePath, 'utf-8');

  // 解析平台（`> 平台: web(网页端), backend` 行）— 端名产品自定，括号内为可选标签
  const platformMatch = content.match(/>\s*平台[:：]\s*(.+)/);
  const platforms: Platform[] = platformMatch ? platformNamesFrom(platformMatch[1]) : [];

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
    if (onlyActive && !['🔄 进行中', '📥 素材收集中'].includes(info.status)) continue;
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
