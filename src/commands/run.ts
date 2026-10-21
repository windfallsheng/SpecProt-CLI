/**
 * 产品流水线编排器 — run（v0.2.0）
 *
 * convert → analyze → slice → deepen → adopt → freeze 六段编排，自动/交互双模式。
 *
 * 铁律：CLI 不循环执行多步骤。每段执行完输出 [SPECPROT_STEP_DONE]，
 * AI 接力段由宿主 AI 填充产物后，--resume 断点续跑（步骤隔离）。
 *
 * 六闸口（自动模式也停）：
 *   1. 范围确认     — interactive 模式展示计划待确认（-y 放行）
 *   2. 素材为空     — convert/analyze 前素材区无料即停
 *   3. 空骨架拦截   — slice 前端级需求仍有占位符即停
 *   4. 待确认未清   — slice 前 CLARIFY.md 有未决项即停（--force 跳过）
 *   5. 风险未裁决   — deepen/freeze 前 RISK.md 有待裁决项即停（--force 跳过）
 *   6. 收养确认     — adopt 前 interactive 模式列出待收养单元（-y 放行）
 *   （change 变更血缘由产品事前声明: specprot req change，freeze 时自动回流）
 */

import { readFile, writeFile, pathExists, readdir, stat } from 'fs-extra';
import { join } from 'path';
import { checkOutlineSections } from './deepen';
import * as readline from 'readline';
import {
  getWorkspaceDir,
  getPlatformDir,
  getPlatformFeaturesDir,
  getMaterialsDir,
  getMaterialPlatformDir,
  getConvertedDir,
  getConvertedPlatformDir,
  listIterationPlatforms,
  Platform,
} from '../core/workspace-manager';

const STAGES = ['convert', 'analyze', 'slice', 'deepen', 'adopt', 'freeze'] as const;
type Stage = typeof STAGES[number];

interface RunState {
  iteration: string;
  platforms: string[];
  completed: {
    convert: boolean;
    analyze: string[];
    slice: string[];
    deepen: string[];
    adopt: boolean;
    freeze: boolean;
  };
  lastUpdated: string;
}

export interface RunOptions {
  iteration: string;
  platforms?: string;
  from?: string;
  to?: string;
  mode?: string;
  yes?: boolean;
  resume?: boolean;
  force?: boolean;
}

function getStatePath(iterationName: string): string {
  return join(getWorkspaceDir(iterationName), '.run-state.json');
}

async function loadState(iterationName: string): Promise<RunState> {
  const p = getStatePath(iterationName);
  if (await pathExists(p)) {
    try {
      return JSON.parse(await readFile(p, 'utf-8'));
    } catch {
      /* 状态损坏视为无状态 */
    }
  }
  return {
    iteration: iterationName,
    platforms: [],
    completed: { convert: false, analyze: [], slice: [], deepen: [], adopt: false, freeze: false },
    lastUpdated: '',
  };
}

async function saveState(state: RunState): Promise<void> {
  state.lastUpdated = new Date().toISOString().replace('T', ' ').slice(0, 16);
  await writeFile(getStatePath(state.iteration), JSON.stringify(state, null, 2), 'utf-8');
}

/** 素材区是否空空如也（端素材目录 + converted/{端}/；converted 根级只算文件，预建空目录不算） */
async function hasAnyMaterial(iterationName: string): Promise<boolean> {
  const platforms = await listIterationPlatforms(iterationName);
  const dirs: string[] = [];
  for (const p of [...platforms, 'shared']) {
    dirs.push(getMaterialPlatformDir(iterationName, p as Platform | 'shared'));
    dirs.push(getConvertedPlatformDir(iterationName, p as Platform | 'shared'));
  }
  for (const d of dirs) {
    if (!(await pathExists(d))) continue;
    const files = (await readdir(d)).filter((f) => f !== 'README.md' && !f.startsWith('.'));
    if (files.length > 0) return true;
  }
  // converted 根级文件（images-index.md 等）——子目录本身不算素材；清单类（_ 开头）不计
  const root = getConvertedDir(iterationName);
  if (await pathExists(root)) {
    for (const f of await readdir(root)) {
      if (f.startsWith('_')) continue;
      if ((await stat(join(root, f))).isFile()) return true;
    }
  }
  return false;
}

/** 端级需求是否仍是空骨架 */
async function isSkeleton(iterationName: string, platform: string): Promise<boolean> {
  const reqPath = join(getPlatformDir(iterationName, platform as Platform), 'REQUIREMENT.md');
  if (!(await pathExists(reqPath))) return true;
  const content = await readFile(reqPath, 'utf-8');
  return content.includes('_待批量生成_') || content.trim().length < 50;
}

/** CLARIFY.md 是否有未决项 */
async function hasPendingClarify(iterationName: string, platform: string): Promise<boolean> {
  const p = join(getPlatformDir(iterationName, platform as Platform), 'CLARIFY.md');
  if (!(await pathExists(p))) return false;
  const content = await readFile(p, 'utf-8');
  return /^\s*-\s*\[ \]\s*.+/m.test(content);
}

/** 切分是否已完成（INDEX 无占位 + 存在单元目录） */
async function isSliced(iterationName: string, platform: string): Promise<boolean> {
  const featuresDir = getPlatformFeaturesDir(iterationName, platform as Platform);
  const indexPath = join(featuresDir, 'INDEX.md');
  if (!(await pathExists(indexPath))) return false;
  const content = await readFile(indexPath, 'utf-8');
  if (content.includes('_待切分_')) return false;
  const dirs = (await readdir(featuresDir)).filter((d) => d !== 'INDEX.md');
  return dirs.length > 0;
}

/** 输出步骤完成标记 */
function emitStepDone(nextHint: string): void {
  console.log('');
  console.log('[SPECPROT_STEP_DONE]');
  console.log(`[SPECPROT_NEXT_STEP] ${nextHint}`);
}

export async function runCommand(options: RunOptions): Promise<void> {
  if (!options.iteration) {
    console.error('❌ 期次名称是必需的。示例: specprot run -i 期次-2026-Q3 -p web');
    return;
  }

  const taskDir = getWorkspaceDir(options.iteration);
  if (!(await pathExists(taskDir))) {
    console.error(`❌ 期次不存在: ${options.iteration}`);
    return;
  }

  // ── 1. 范围确定 ──
  const platforms: string[] = options.platforms
    ? options.platforms.split(',').map((p) => p.trim()).filter(Boolean)
    : await listIterationPlatforms(options.iteration);
  if (platforms.length === 0) platforms.push('web'); // 极端兜底：无平台声明且素材区为空

  const fromIdx = Math.max(0, STAGES.indexOf((options.from || 'convert') as Stage));
  const toIdx = Math.max(fromIdx, STAGES.indexOf((options.to || 'slice') as Stage));
  if (toIdx < fromIdx) {
    console.error('❌ --to 阶段必须在 --from 阶段之后');
    return;
  }
  const plan = STAGES.slice(fromIdx, toIdx + 1);

  // ── 2. 状态与续跑 ──
  const state = await loadState(options.iteration);
  state.iteration = options.iteration;
  state.platforms = platforms;

  // 已完成的段跳过
  const remaining: Stage[] = [];
  for (const st of plan) {
    const done =
      st === 'convert'
        ? state.completed.convert
        : st === 'analyze'
          ? platforms.every((p) => state.completed.analyze.includes(p))
          : st === 'slice'
            ? platforms.every((p) => state.completed.slice.includes(p))
            : st === 'deepen'
              ? false // 段内自判（逐单元推进）
              : st === 'adopt'
                ? !!state.completed.adopt
                : !!state.completed.freeze;
    if (!done) remaining.push(st);
  }

  // ── 3. 闸口一：范围确认 ──
  const mode = options.mode === 'auto' ? 'auto' : 'interactive';
  console.log('🎬 SpecProt 产品流水线');
  console.log(`   期次: ${options.iteration}`);
  console.log(`   端: ${platforms.join(', ')}`);
  console.log(`   阶段: ${plan.join(' → ')}`);
  console.log(`   模式: ${mode === 'auto' ? '🤖 自动（节点间不等待）' : '👤 交互（每段停下确认）'}`);
  if (remaining.length === 0) {
    console.log('');
    console.log('✅ 全部阶段已完成，无需执行。');
    return;
  }
  console.log(`   待执行: ${remaining.join(' → ')}`);
  console.log('');

  if (mode === 'interactive' && !options.yes) {
    const answer = await ask(`确认执行？[回车继续 / 输入 n 取消] `);
    if (answer.toLowerCase() === 'n') {
      console.log('已取消。');
      return;
    }
  }

  // ── 4. 逐段执行（每段后输出 STEP_DONE，AI 接力段等 --resume）──
  for (const stage of remaining) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`▶ 阶段: ${stage}`);
    console.log('═'.repeat(50));

    if (stage === 'convert') {
      // 闸口二：素材为空
      if (!(await hasAnyMaterial(options.iteration))) {
        console.error(`⛔ 闸口拦截：素材区空空如也。`);
        console.error(`   先把材料扔进 ${options.iteration}/00-素材/{端}/（跨端通用放 shared/），再 --resume 续跑。`);
        emitStepDone(`投料后: specprot run --resume -n "${options.iteration}"`);
        return;
      }
      const { convertCommand } = await import('./convert');
      await convertCommand({ iteration: options.iteration });
      state.completed.convert = true;
      await saveState(state);
      console.log('✅ convert 完成（确定性步骤）');
    }

    if (stage === 'analyze') {
      // 闸口二：素材为空
      if (!(await hasAnyMaterial(options.iteration))) {
        console.error(`⛔ 闸口拦截：素材区空空如也。`);
        emitStepDone(`投料后: specprot run --resume -n "${options.iteration}"`);
        return;
      }
      for (const p of platforms) {
        const { analyzeCommand } = await import('./analyze');
        await analyzeCommand({ iteration: options.iteration, platform: p });
      }
      // 产物核验：所有端 REQUIREMENT 已脱离骨架 → 完成；否则等 AI 接力
      const allDone = (await Promise.all(platforms.map((p) => isSkeleton(options.iteration, p)))).every((v) => !v);
      if (allDone) {
        for (const p of platforms) if (!state.completed.analyze.includes(p)) state.completed.analyze.push(p);
        await saveState(state);
        console.log('✅ analyze 完成（端级需求已落盘）');
      } else {
        emitStepDone(`宿主 AI 按上方 prompt 填充各端 REQUIREMENT.md 后: specprot run --resume -n "${options.iteration}"`);
        return;
      }
    }

    if (stage === 'slice') {
      let blocked = false;
      for (const p of platforms) {
        // 闸口三：空骨架
        if (await isSkeleton(options.iteration, p)) {
          console.error(`⛔ 闸口拦截：${p} 端级需求仍是空骨架。`);
          console.error(`   先完成端级分析（宿主 AI 接力填充 REQUIREMENT.md），再 --resume 续跑。`);
          emitStepDone(`端级分析完成后: specprot run --resume -n "${options.iteration}"`);
          return;
        }
        // 闸口四：待确认未清
        if (!options.force && (await hasPendingClarify(options.iteration, p))) {
          console.error(`⛔ 闸口拦截：${p} 端 CLARIFY.md 存在未决待确认项。`);
          console.error(`   产品拍板处理待确认项后 --resume 续跑；确认无碍可 --force 跳过。`);
          emitStepDone(`处理待确认后: specprot run --resume -n "${options.iteration}"`);
          return;
        }
      }
      for (const p of platforms) {
        const { sliceCommand } = await import('./slice');
        await sliceCommand({ iteration: options.iteration, platform: p });
      }
      const allSliced = (await Promise.all(platforms.map((p) => isSliced(options.iteration, p)))).every(Boolean);
      if (allSliced) {
        for (const p of platforms) if (!state.completed.slice.includes(p)) state.completed.slice.push(p);
        await saveState(state);
        console.log('✅ slice 完成（功能单元已落盘）');
      } else {
        emitStepDone(`宿主 AI 按上方 prompt 切分功能单元后: specprot run --resume -n "${options.iteration}"`);
        return;
      }
    }

    if (stage === 'deepen') {
      // 单元深化：OUTLINE 结构契约 → 评审包（AI 接力逐单元推进）
      const units = await collectFeatureUnits(options.iteration, platforms);
      const pending = units.filter((u) => !state.completed.deepen.includes(`${u.platform}/${u.feature}`));
      if (pending.length === 0) {
        console.log('✅ deepen 完成（全部单元已深化）');
      } else {
        for (const u of pending) {
          if (await isUnitDeepened(options.iteration, u.platform as Platform, u.feature)) {
            state.completed.deepen.push(`${u.platform}/${u.feature}`);
            await saveState(state);
            console.log(`   ✔ ${u.platform}/${u.feature} 已深化`);
            continue;
          }
          // 未深化：交 deepen 命令（输出 outline/review prompt 后停，--resume 续跑）
          const { deepenCommand } = await import('./deepen');
          await deepenCommand({ iteration: options.iteration, platform: u.platform, feature: u.feature, phase: 'all' });
          return;
        }
      }
    }

    if (stage === 'adopt') {
      // 收养各端功能单元进正典（幂等：已收养的跳过）
      const features: Array<{ platform: string; feature: string }> = [];
      for (const p of platforms) {
        const fd = getPlatformFeaturesDir(options.iteration, p as Platform);
        if (!(await pathExists(fd))) continue;
        for (const f of await readdir(fd)) {
          if (f === 'INDEX.md' || f.startsWith('.')) continue;
          features.push({ platform: p, feature: f });
        }
      }

      if (features.length === 0) {
        console.log('ℹ️ 未发现功能单元，跳过收养（slice 完成后才有单元可收养）。');
      } else {
        if (mode === 'interactive' && !options.yes) {
          console.log(`待收养功能单元（${features.length} 个）:`);
          for (const f of features) console.log(`   - ${f.platform}/features/${f.feature}`);
          const answer = await ask('全部收养进正典（default 项目）？[回车继续 / 输入 n 取消] ');
          if (answer.toLowerCase() === 'n') {
            emitStepDone(`手动收养: specprot req adopt -i "${options.iteration}" -p <端> -f <单元>`);
            return;
          }
        }
        let adopted = 0;
        for (const f of features) {
          const { adoptFeatureToGlobal } = await import('../core/global-layer');
          const entry = await adoptFeatureToGlobal(options.iteration, f.platform, f.feature);
          console.log(`   ✅ ${f.platform}/features/${f.feature} → ${entry.id}`);
          adopted++;
        }
        state.completed.adopt = true;
        await saveState(state);
        console.log(`✅ adopt 完成（${adopted} 个功能单元已归入正典）`);
      }
    }

    if (stage === 'freeze') {
      // 变更回流 + 交付快照（确定性步骤；风险门禁拦截时返回空路径）
      const { freezeIteration } = await import('../core/global-layer');
      const deliveryDir = await freezeIteration(options.iteration, { force: !!options.force });
      if (!deliveryDir) {
        console.error('   冻结门禁拦截：裁决全部风险、确认全部问题后 --resume 续跑。');
        console.error('   确需跳过门禁: specprot run --resume --force（慎用）。');
        return;
      }
      state.completed.freeze = true;
      await saveState(state);
      console.log(`✅ freeze 完成（变更回流 + 交付快照: ${deliveryDir}）`);
    }
  }

  // ── 5. 收尾 ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log('🎉 流水线到达终点。');
  console.log('');
  console.log('整条产品线已闭环：素材 → 端级需求 → 功能单元 → 深化定稿 → 正典 → 交付快照');
  console.log('   · 变更需求已自动回流版本演进（正典 vX.Y → vX.(Y+1)）');
  console.log('   · 推荐方案已进快照正文，备选方案在 04-交付/备选方案附录.md');
  console.log('   · 交付快照位于 04-交付/，可交接给 SpecCore（doc2spec / unitize）');
  emitStepDone(`流程闭环。新期次: specprot iteration create -n 期次-NEXT -p <端列表>`);
}

/** 收集期次内全部功能单元（多消费点共用：deepen 段 / 门禁检查） */
async function collectFeatureUnits(
  iterationName: string,
  platforms: string[]
): Promise<Array<{ platform: string; feature: string }>> {
  const units: Array<{ platform: string; feature: string }> = [];
  for (const p of platforms) {
    const fd = getPlatformFeaturesDir(iterationName, p as Platform);
    if (!(await pathExists(fd))) continue;
    for (const f of await readdir(fd)) {
      if (f === 'INDEX.md' || f.startsWith('.')) continue;
      units.push({ platform: p, feature: f });
    }
  }
  return units;
}

/** 单元深化完成判定：OUTLINE 四段齐全 + RISK 无待裁决 + CLARIFY 无未决 */
async function isUnitDeepened(iterationName: string, platform: Platform, feature: string): Promise<boolean> {
  const dir = join(getPlatformFeaturesDir(iterationName, platform), feature);
  const outlinePath = join(dir, 'OUTLINE.md');
  if (!(await pathExists(outlinePath))) return false;
  const outline = await readFile(outlinePath, 'utf-8');
  if (checkOutlineSections(outline).length > 0) return false;
  const riskPath = join(dir, 'RISK.md');
  if (!(await pathExists(riskPath))) return false;
  const risk = await readFile(riskPath, 'utf-8');
  if (risk.includes('待裁决')) return false;
  const clarifyPath = join(dir, 'CLARIFY.md');
  if (await pathExists(clarifyPath)) {
    const clarify = await readFile(clarifyPath, 'utf-8');
    if (clarify.includes('未决')) return false;
  }
  return true;
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const input = process.stdin;
    // stdin 已 EOF（管道输入耗尽 / 非交互环境）时按回车放行，避免卡死
    if (input.readableEnded || input.destroyed) {
      console.log(question);
      resolve('');
      return;
    }
    const rl = readline.createInterface({ input, output: process.stdout });
    let settled = false;
    const finish = (v: string) => {
      if (settled) return;
      settled = true;
      rl.close();
      resolve(v);
    };
    rl.question(question, (answer) => finish(answer.trim()));
    // EOF 兜底（真实终端正常输入走 question 回调，此分支仅覆盖流提前结束）
    rl.on('close', () => finish(''));
  });
}
