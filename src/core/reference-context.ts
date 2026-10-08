/**
 * 参考上下文构建 — 迭代层生成需求时的既有沉淀注入
 *
 * 三个来源（存在才注入，摘要而非全文，同端优先）：
 *   1. 正典历史需求摘要（GLOBAL/PROJECTS 中同端既有 REQ）
 *   2. 期次 _shared/GLOSSARY.md + RULES.md（术语表 / 跨单元规则）
 *   3. 设计系统 DESIGN_SYSTEM.yaml（期次根 > 全局层）
 * 附带:端名映射桥提示（_shared/PLATFORM_MAP.yaml）
 */

import { readFile, pathExists } from 'fs-extra';
import { join } from 'path';
import { readGlobalIndex, getGlobalDir } from './global-layer';
import { platformNamesFrom } from './workspace-manager';

const HISTORY_LIMIT = 5;    // 同端历史需求最多注入条数
const SUMMARY_CHARS = 300;  // 每条历史需求摘要最大字符
const MAX_SCAN = 30;        // 正典最多扫描条数（按索引顺序）
const DOC_CHARS = 3000;     // 术语表/规则/设计系统单篇注入上限

export interface HistoryReq {
  id: string;
  name: string;
  status: string;
  /** 所属端（从 REQ 元数据推断，未知为 '-'，未知端也会注入作通用参考） */
  platform: string;
  summary: string;
}

export interface ReferenceContext {
  history: HistoryReq[];
  glossary: string;
  rules: string;
  designSystem: string;
  /** 端名映射桥提示（存在映射时非空） */
  mapNote: string;
}

/** 提取文档摘要：元数据表之后的第一个正文段落 */
function extractSummary(content: string): string {
  const lines = content.split('\n');
  let inHeader = true;
  for (const l of lines) {
    if (inHeader) {
      if (l.trim() === '---') { inHeader = false; continue; }
      continue;
    }
    const t = l.trim();
    if (!t || t.startsWith('#') || t.startsWith('>') || t.startsWith('|')) continue;
    if (t.startsWith('<!--')) continue;
    return t.length > SUMMARY_CHARS ? t.slice(0, SUMMARY_CHARS) + '…' : t;
  }
  return '';
}

async function readSnippet(path: string): Promise<string> {
  if (!(await pathExists(path))) return '';
  const raw = await readFile(path, 'utf-8');
  const t = raw.trim();
  return t.length > DOC_CHARS ? t.slice(0, DOC_CHARS) + '\n…（截断）' : t;
}

/** 端名映射桥:读 _shared/PLATFORM_MAP.yaml 的非注释映射行 */
async function readMapNote(iterationName: string): Promise<string> {
  const mapPath = join(process.cwd(), iterationName, '_shared', 'PLATFORM_MAP.yaml');
  if (!(await pathExists(mapPath))) return '';
  const raw = await readFile(mapPath, 'utf-8');
  const active = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes(':'));
  if (active.length === 0) return '';
  return active.map((l) => `- ${l.split('#')[0].trim()}`).join('\n');
}

/**
 * 组装参考上下文（analyze/slice 的 prompt 注入节）
 */
export async function buildReferenceContext(
  iterationName: string,
  platform: string
): Promise<ReferenceContext> {
  const ctx: ReferenceContext = { history: [], glossary: '', rules: '', designSystem: '', mapNote: '' };

  // 1) 正典历史需求摘要（同端优先，未知端兜底作通用参考）
  const index = await readGlobalIndex();
  const candidates = index.reqs.filter(
    (r) => r.iteration !== iterationName && r.status !== '🗑️ 已废弃'
  );
  const samePlatform: HistoryReq[] = [];
  const generic: HistoryReq[] = [];
  for (const req of candidates.slice(0, MAX_SCAN)) {
    const src = join(getGlobalDir(), req.filePath);
    if (!(await pathExists(src))) continue;
    const content = await readFile(src, 'utf-8');
    const platMatch = content.match(/\| (?:来源功能单元|所属端) \| ([^|]+) \|/);
    const reqPlatform = platMatch ? platMatch[1].trim().split('/')[0].trim() : '-';
    const summary = extractSummary(content);
    const item: HistoryReq = { id: req.id, name: req.name, status: req.status, platform: reqPlatform, summary };
    if (reqPlatform === platform) samePlatform.push(item);
    else if (reqPlatform === '-') generic.push(item);
  }
  ctx.history = [...samePlatform, ...generic].slice(0, HISTORY_LIMIT);

  // 2) 期次 _shared/ 术语表与共享规则（deepen 回流目标 / 产品手写）
  const sharedDir = join(process.cwd(), iterationName, '_shared');
  ctx.glossary = await readSnippet(join(sharedDir, 'GLOSSARY.md'));
  ctx.rules = await readSnippet(join(sharedDir, 'RULES.md'));

  // 3) 设计系统:期次根 > 全局层
  const globalDs = join(getGlobalDir(), 'DESIGN_SYSTEM.yaml');
  const iterDs = join(process.cwd(), iterationName, 'DESIGN_SYSTEM.yaml');
  ctx.designSystem = (await readSnippet(iterDs)) || (await readSnippet(globalDs));

  // 4) 端名映射桥
  ctx.mapNote = await readMapNote(iterationName);

  return ctx;
}

/** 参考上下文 → prompt 节（空上下文返回空串） */
export function formatReferenceSection(ctx: ReferenceContext, label: string): string {
  let p = '';
  p += `## 参考上下文（既有沉淀）\n\n`;

  if (ctx.history.length > 0) {
    p += `### 同端历史需求（${label}既有 REQ）\n\n`;
    p += `> 写作风格、术语口径与既有需求保持一致；同名概念不得另造术语；与既有需求重复/冲突处须在待确认清单标注。\n\n`;
    for (const h of ctx.history) {
      const platNote = h.platform === '-' ? '' : ` · ${h.platform}`;
      p += `- **${h.id}** ${h.name}（${h.status}${platNote}）\n`;
      if (h.summary) p += `  ${h.summary}\n`;
    }
    p += `\n`;
  } else {
    p += `### 历史需求\n\n（正典库暂无同端历史需求，本期为该端首次成文）\n\n`;
  }

  if (ctx.glossary) {
    p += `### 术语表（_shared/GLOSSARY.md）\n\n\`\`\`markdown\n${ctx.glossary}\n\`\`\`\n\n`;
  }
  if (ctx.rules) {
    p += `### 共享规则（_shared/RULES.md）\n\n\`\`\`markdown\n${ctx.rules}\n\`\`\`\n\n`;
  }
  if (ctx.designSystem) {
    p += `### 设计系统（DESIGN_SYSTEM.yaml）\n\n> 页面/组件描述贴合设计语言，验收标准引用设计规范时标注来源。\n\n\`\`\`yaml\n${ctx.designSystem}\n\`\`\`\n\n`;
  }
  if (ctx.mapNote) {
    p += `### 端名映射桥（PLATFORM_MAP）\n\n> 本期端名与 SpecCore 工程标识的映射（交接时按此对齐）：\n\n${ctx.mapNote}\n\n`;
  }

  return p;
}

export { platformNamesFrom };
