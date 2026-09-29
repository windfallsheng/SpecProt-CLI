/**
 * /check 命令 v3 — 需求全面体检
 *
 * 输入源（五级，按优先级）：
 *   specprot check -s "一段需求"              ← 直接贴片段
 *   specprot check -f REQUIREMENT.md          ← 指定文件
 *   specprot check -i 期次 -p web -u 预订     ← 定位单元文档
 *   specprot check -i 期次 -p web             ← 端级需求文档（整个端）
 *   specprot check -i 期次                    ← 期次全量体检（所有端 + 所有单元，汇总）
 *
 * 体检五维：
 *   ① 骨架完整性 — 七段骨架对照，列出缺段
 *   ② 质量六维   — 口语化 / 无验收标准 / 无业务规则 / 无数据字段 / 无边界 / 无结构
 *   ③ 图资产建议 — 按内容特征建议流程/状态/数据/线框图
 *   ④ 风险初筛   — 风险透镜关键词命中（资金/隐私/合规/无障碍/并发）
 *   ⑤ 增量对照   — 全局需求索引 / 同端单元文档（单文档模式）
 *
 * 前四维为确定性检测（CLI 直接算），第五维对照既有沉淀。
 */
import { readFile, pathExists, readdir } from 'fs-extra';
import { join } from 'path';

// —— 七段骨架（端级/单元通用）——
const SEGMENTS: Array<{ name: string; keys: string[] }> = [
  { name: '需求背景/功能概述', keys: ['需求背景', '功能概述', '背景'] },
  { name: '用户场景', keys: ['用户场景', '场景'] },
  { name: '功能描述/功能点', keys: ['功能描述', '功能点', '功能'] },
  { name: '页面/接口', keys: ['页面', '接口'] },
  { name: '数据字段', keys: ['数据字段', '字段'] },
  { name: '业务规则', keys: ['业务规则', '规则'] },
  { name: '验收标准', keys: ['验收标准', '验收', 'AC-'] },
];

// —— 质量六维 ——
const VAGUE_WORDS = ['大概', '差不多', '可能', '应该', '等等', '之类', '一些', '若干', '待定', '再说'];

// —— 图资产建议 ——
const DIAGRAM_HINTS: Array<{ name: string; keys: string[] }> = [
  { name: '业务流程图 (flowchart)', keys: ['流程', '步骤', '流转', '环节'] },
  { name: '状态机图 (stateDiagram)', keys: ['状态机', '状态流转'] },
  { name: '数据模型图 (ER 图)', keys: ['数据字段', '实体', '表结构'] },
  { name: '页面线框图', keys: ['页面', '界面', '布局'] },
];

// —— 风险透镜初筛（命中即提示对应透镜，深度裁决走 deepen 评审包）——
const RISK_LENSES: Array<{ name: string; keys: string[] }> = [
  { name: '资金业务透镜', keys: ['支付', '金额', '余额', '充值', '退款', '转账', '结算', '资金', '交易'] },
  { name: '金融合规透镜', keys: ['牌照', '监管', '反洗钱', '金融', '审计'] },
  { name: '隐私合规透镜 (PIPL/GDPR)', keys: ['身份证', '手机号', '个人信息', '隐私', '敏感数据', '授权'] },
  { name: '无障碍透镜 (WCAG)', keys: ['无障碍', '读屏', '残障', '适老化'] },
  { name: '内容合规透镜', keys: ['评论', 'UGC', '上传', '发布', '审核'] },
  { name: '并发防护透镜', keys: ['并发', '秒杀', '抢购', '幂等', '超卖'] },
  { name: '状态机完备透镜', keys: ['状态机', '状态流转'] },
];

interface CheckResult {
  section: string;
  type: 'conflict' | 'duplicate' | 'new' | 'related' | 'info';
  message: string;
  severity: 'high' | 'medium' | 'low';
}

/** 单文档体检结果（前四维确定性检测） */
interface HealthReport {
  totalChars: number;
  titleCount: number;
  skeleton: boolean;
  missing: string[];
  qualityWarns: string[];
  diagrams: string[];
  risks: string[];
}

/** 前四维确定性检测（单文档 → 结果结构，供单文档/批量两模式复用） */
function analyzeDocument(content: string): HealthReport {
  const titles = (content.match(/^#{1,3}\s+(.+)$/gm) || []).map((t) => t.replace(/^#+\s*/, ''));
  const titleText = titles.join(' | ');

  const missing: string[] = [];
  for (const seg of SEGMENTS) {
    if (!seg.keys.some((k) => titleText.includes(k))) missing.push(seg.name);
  }

  const qualityWarns: string[] = [];
  const vagueHits: Record<string, number> = {};
  for (const w of VAGUE_WORDS) {
    const n = content.split(w).length - 1;
    if (n > 0) vagueHits[w] = n;
  }
  if (Object.keys(vagueHits).length > 0) {
    qualityWarns.push('口语化表述: ' + Object.entries(vagueHits).map(([w, n]) => `"${w}"×${n}`).join('、'));
  }
  if (!/AC-|验收/.test(content)) qualityWarns.push('无验收标准（补 AC-NN: [前置]→[操作]→[预期]）');
  if (!/规则/.test(content)) qualityWarns.push('无业务规则');
  if (!/字段|数据/.test(content)) qualityWarns.push('无数据字段说明');
  if (!/边界|异常|失败|超时/.test(content)) qualityWarns.push('无边界/异常场景');
  if (titles.length < 3) qualityWarns.push('结构过简（章节 < 3）');

  const diagrams = DIAGRAM_HINTS.filter((d) => d.keys.some((k) => content.includes(k))).map((d) => d.name);

  const risks: string[] = [];
  for (const r of RISK_LENSES) {
    const hit = r.keys.filter((k) => content.includes(k));
    if (hit.length > 0) risks.push(`「${r.name}」: ${hit.slice(0, 3).join('、')}`);
  }

  const skeleton = content.includes('_待批量生成_');
  return { totalChars: content.length, titleCount: titles.length, skeleton, missing, qualityWarns, diagrams, risks };
}

/** 单份文档的体检是否健康 */
function isHealthy(r: HealthReport): boolean {
  return !r.skeleton && r.missing.length === 0 && r.qualityWarns.length === 0 && r.risks.length === 0;
}


// ============================================================
// 辅助：期次定位 / 增量对照
// ============================================================

/** 查找期次目录（直接匹配 期次-{name}，再模糊匹配） */
async function findIterationDir(iteration: string): Promise<string | null> {
  // 1) 直接以参数为目录名（与 analyze 的 getWorkspaceDir 一致）
  if (await pathExists(iteration)) return iteration;
  // 2) 兼容：用户只传 XXX 时补 期次- 前缀
  const prefixed = `期次-${iteration}`;
  if (await pathExists(prefixed)) return prefixed;
  // 3) 模糊匹配（仅 期次- 前缀目录，避免误伤普通文件）
  for (const entry of await readdir('.')) {
    if (entry.startsWith('期次-') && entry.includes(iteration)) return entry;
  }
  return null;
}


/** 增量对照：全局需求索引标题重叠 + 同端其他单元标题重复 */
async function deltaCheck(content: string, iteration: string, platform: string, unit: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const titles = (content.match(/^#{1,3}\s+(.+)$/gm) || [])
    .map((t) => t.replace(/^#+\s*/, '').trim())
    .filter((t) => t.length >= 2);

  // 1) 全局需求索引（排除本期次自身）
  try {
    const { readGlobalIndex } = await import('../core/global-layer');
    const idx = await readGlobalIndex();
    for (const req of idx.reqs) {
      if (req.iteration === iteration || req.name.length < 2 || !req.name) continue;

      if (titles.some((t) => t.includes(req.name) || req.name.includes(t))) {
        results.push({ section: '全局需求', type: 'duplicate', severity: 'medium',
          message: `标题与全局需求「${req.name}」(${req.id}) 重叠，确认是否同一需求` });
      }
    }
  } catch { /* 全局层未初始化时跳过 */ }


  // 2) 同端其他单元文档（仅单元模式）
  if (iteration && platform && unit) {
    const iterDir = await findIterationDir(iteration);
    if (iterDir) {
      const featuresDir = join(iterDir, platform, 'features');
      try {
        for (const f of await readdir(featuresDir)) {
          if (f === unit || f === 'INDEX.md' || f.startsWith('.')) continue;
          const other = join(featuresDir, f, 'REQUIREMENT.md');
          if (!(await pathExists(other))) continue;
          const otherTitles = ((await readFile(other, 'utf-8')).match(/^#{1,3}\s+(.+)$/gm) || [])
            .map((t) => t.replace(/^#+\s*/, '').trim());

          for (const t of titles) {
            if (t.length >= 4 && otherTitles.includes(t)) {
              results.push({ section: `单元「${f}」`, type: 'duplicate', severity: 'low',
                message: `标题「${t}」与其重复` });
            }
          }
        }
      } catch { /* 无 features 目录时跳过 */ }
    }
  }
  return results;
}


// ============================================================
// 渲染
// ============================================================

/** 单文档五维体检报告渲染 */
function renderHealth(label: string, r: HealthReport, deltas: CheckResult[]): void {
  console.log('');
  console.log(`🩺 需求体检报告 — ${label}`);
  console.log(`   篇幅: ${r.totalChars} 字 / ${r.titleCount} 个章节`);

  console.log('');
  console.log('① 骨架完整性');
  if (r.skeleton) console.log('   ⚠️ 仍为骨架占位(_待批量生成_)，尚未成文 — 先跑 analyze');
  else if (r.missing.length === 0) console.log('   ✅ 七段骨架齐备');
  else console.log(`   ⚠️ 缺少段落: ${r.missing.join('、')}`);

  console.log('② 质量六维');
  if (r.qualityWarns.length === 0) console.log('   ✅ 未发现质量问题');
  else for (const w of r.qualityWarns) console.log(`   ⚠️ ${w}`);


  console.log('③ 图资产建议');
  if (r.diagrams.length === 0) console.log('   — 暂无明确图需求');
  else {
    for (const d of r.diagrams) console.log(`   💡 建议生成: ${d}`);
    console.log('   → 生成: specprot assets -i <期次> -p <端> -f <单元>');
  }

  console.log('④ 风险初筛');
  if (r.risks.length === 0) console.log('   ✅ 未命中风险透镜');
  else {
    for (const risk of r.risks) console.log(`   ⚠️ 命中${risk}`);
    console.log('   → 深度裁决: specprot deepen -i <期次> -p <端>');
  }

  console.log('⑤ 增量对照');
  if (deltas.length === 0) console.log('   ✅ 无冲突、无重复');
  else for (const d of deltas) console.log(`   ⚠️ [${d.severity}] ${d.section}: ${d.message}`);


  console.log('');
  const parts = [
    `骨架 ${!r.skeleton && r.missing.length === 0 ? '✅' : '⚠️'}`,
    `质量 ${r.qualityWarns.length === 0 ? '✅' : '⚠️'}`,
    `图 ${r.diagrams.length} 张`,
    `风险 ${r.risks.length === 0 ? '✅' : '⚠️'}`,
    `对照 ${deltas.length === 0 ? '✅' : '⚠️'}`,
  ];
  console.log(`📊 体检总结: ${parts.join(' · ')}`);
  if (isHealthy(r) && deltas.length === 0) console.log('   🎉 通过：可以进入下一阶段');
}


/** 期次全量体检：所有端级 + 所有单元文档，输出汇总 */
async function checkAll(iterDir: string, iteration: string): Promise<void> {
  const platforms: string[] = [];
  for (const entry of await readdir(iterDir)) {
    if (entry.startsWith('_') || /^\d{2}-/.test(entry)) continue;
    if (await pathExists(join(iterDir, entry, 'REQUIREMENT.md'))) platforms.push(entry);
  }
  if (platforms.length === 0) {
    console.error(`❌ 期次 ${iteration} 下未找到任何端的需求文档`);
    process.exit(1);
  }

  console.log('');
  console.log(`🩺 期次全量体检 — ${iteration}`);
  console.log('');

  const rows: Array<{ label: string; r: HealthReport }> = [];
  for (const pf of platforms.sort()) {
    rows.push({ label: `${pf} 端级需求`, r: analyzeDocument(await readFile(join(iterDir, pf, 'REQUIREMENT.md'), 'utf-8')) });

    const featuresDir = join(iterDir, pf, 'features');
    try {
      for (const f of (await readdir(featuresDir)).sort()) {
        if (f === 'INDEX.md' || f.startsWith('.')) continue;
        const unitDoc = join(featuresDir, f, 'REQUIREMENT.md');
        if (!(await pathExists(unitDoc))) continue;
        rows.push({ label: `${pf}/${f}`, r: analyzeDocument(await readFile(unitDoc, 'utf-8')) });
      }
    } catch { /* 无 features 目录 */ }
  }

  let healthy = 0;
  let missingTotal = 0;
  let diagramTotal = 0;
  let riskTotal = 0;
  let skeletonTotal = 0;
  for (const row of rows) {
    const r = row.r;
    if (isHealthy(r)) healthy++;
    if (r.skeleton) skeletonTotal++;
    missingTotal += r.missing.length;
    diagramTotal += r.diagrams.length;
    riskTotal += r.risks.length;

    const warnBits: string[] = [];
    if (r.skeleton) warnBits.push('骨架未填充');
    if (r.missing.length) warnBits.push(`缺 ${r.missing.length} 段`);
    if (r.qualityWarns.length) warnBits.push(`质量 ${r.qualityWarns.length}`);
    if (r.risks.length) warnBits.push(`风险 ${r.risks.length}`);
    const detail = warnBits.length ? ` (${warnBits.join(' · ')})` : '';
    console.log(`   ${row.label.padEnd(20)} ${isHealthy(r) ? '✅ 健康' : '⚠️ 待完善'}${detail}`);
  }

  console.log('');
  console.log(`📊 汇总: ${rows.length} 份文档 · 健康 ${healthy} · 待完善 ${rows.length - healthy} · 骨架未填充 ${skeletonTotal} · 共缺 ${missingTotal} 段 · 建议图 ${diagramTotal} 张 · 风险 ${riskTotal}`);
  console.log('');
  console.log('💡 单文档明细: specprot check -i <期次> -p <端> [-u <单元>]');
}


// ============================================================
// 命令入口
// ============================================================

export async function checkCommand(options: any) {
  const iteration = options.iteration || '';
  const snippet = options.snippet || '';
  const file = options.file || '';
  const platform = options.platform || '';
  const unit = options.unit || '';

  // —— 无期次：片段 / 指定文件 ——
  if (!iteration) {
    if (snippet) { renderHealth('输入片段', analyzeDocument(snippet), []); return; }
    if (file && (await pathExists(file))) {
      renderHealth(file, analyzeDocument(await readFile(file, 'utf-8')), []);
      return;
    }
    console.error('❌ 请指定体检对象：');
    console.error('   specprot check -s "一段需求"');
    console.error('   specprot check -f REQUIREMENT.md');
    console.error('   specprot check -i 期次 [-p 端] [-u 单元]');
    process.exit(1);
  }


  const iterDir = await findIterationDir(iteration);
  if (!iterDir) {
    console.error(`❌ 未找到期次目录: 期次-${iteration}`);
    process.exit(1);
  }

  // —— 期次全量（无 -p）：所有端 + 所有单元汇总 ——
  if (!platform) { await checkAll(iterDir, iteration); return; }

  // —— 端级整篇 / 单元文档 ——
  const docPath = unit
    ? join(iterDir, platform, 'features', unit, 'REQUIREMENT.md')
    : join(iterDir, platform, 'REQUIREMENT.md');
  const label = unit ? `${iteration}/${platform}/features/${unit}` : `${iteration}/${platform} 端级需求`;
  if (!(await pathExists(docPath))) {
    console.error(`❌ 未找到需求文档: ${docPath}`);
    process.exit(1);
  }
  const content = await readFile(docPath, 'utf-8');
  const r = analyzeDocument(content);
  const deltas = await deltaCheck(content, iteration, platform, unit);
  renderHealth(label, r, deltas);
}
