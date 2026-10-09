/**
 * resolve — 风险裁决命令（清零冻结门禁）
 *
 * 产品对单元内 RISK.md 的「待裁决」与 CLARIFY.md 的「未决」逐条裁决。
 * freeze 门禁扫描的就是这两个词，裁决即清零。
 *
 * 用法:
 *   specprot resolve -i 期次 -p 端 -f 单元                        # 列出全部待裁决项
 *   specprot resolve -i 期次 -p 端 -f 单元 --item 2 --decision accept
 *   specprot resolve -i 期次 -p 端 -f 单元 --item 2 --decision reject --note 下期再做
 */
import { join } from 'path';
import { pathExists, readFile, writeFile } from 'fs-extra';
import { getPlatformFeaturesDir } from '../core/workspace-manager';

export interface ResolveOptions {
  iteration?: string;
  platform?: string;
  feature?: string;
  item?: number;
  decision?: 'accept' | 'reject';
  note?: string;
}

/** 待裁决项: file 定位文件, lineIndex 行号, kind 类别 */
interface PendingItem {
  file: 'RISK.md' | 'CLARIFY.md';
  lineIndex: number;
  kind: 'RISK' | 'CLARIFY';
}

export async function resolveCommand(options: ResolveOptions): Promise<void> {
  if (!options.iteration || !options.platform || !options.feature) {
    console.error('❌ 期次名、端名、单元名是必需的。');
    console.error('   示例: specprot resolve -i 期次-XXX -p web -f 预订功能');
    return;
  }

  const unitDir = join(getPlatformFeaturesDir(options.iteration, options.platform), options.feature);
  const riskPath = join(unitDir, 'RISK.md');
  const clarifyPath = join(unitDir, 'CLARIFY.md');

  const riskContent = (await pathExists(riskPath)) ? await readFile(riskPath, 'utf-8') : '';
  const clarifyContent = (await pathExists(clarifyPath)) ? await readFile(clarifyPath, 'utf-8') : '';

  // 收集待裁决项（行号定位，同内容多行也互不干扰）
  const items: PendingItem[] = [];
  riskContent.split('\n').forEach((line, i) => {
    if (line.includes('待裁决')) items.push({ file: 'RISK.md', lineIndex: i, kind: 'RISK' });
  });
  clarifyContent.split('\n').forEach((line, i) => {
    if (line.includes('未决')) items.push({ file: 'CLARIFY.md', lineIndex: i, kind: 'CLARIFY' });
  });

  if (items.length === 0) {
    console.log(`✅ ${options.platform}/features/${options.feature} 没有待裁决项，冻结门禁已清零。`);
    return;
  }

  // 仅列出
  if (options.item === undefined) {
    console.log(`📋 ${options.platform}/features/${options.feature} 待裁决项 (${items.length}):\n`);
    items.forEach((it, n) => {
      const src = it.file === 'RISK.md' ? riskContent : clarifyContent;
      const line = src.split('\n')[it.lineIndex].trim();
      console.log(`  ${n + 1}. [${it.kind}] ${line.length > 90 ? line.slice(0, 90) + '…' : line}`);
    });
    console.log('');
    console.log('裁决: specprot resolve -i 期次 -p 端 -f 单元 --item <序号> --decision accept|reject [--note 理由]');
    return;
  }

  // 裁决
  if (options.item < 1 || options.item > items.length) {
    console.error(`❌ 序号越界: 共 ${items.length} 项，收到 ${options.item}。`);
    return;
  }
  if (options.decision !== 'accept' && options.decision !== 'reject') {
    console.error('❌ --decision 只接受 accept / reject。');
    return;
  }

  const target = items[options.item - 1];
  const filePath = target.file === 'RISK.md' ? riskPath : clarifyPath;
  const lines = (target.file === 'RISK.md' ? riskContent : clarifyContent).split('\n');
  const oldLine = lines[target.lineIndex];

  let newLine: string;
  if (target.kind === 'RISK') {
    const verdict = options.decision === 'accept' ? '✅ 已接受' : '⛔ 已拒绝';
    newLine = oldLine.replace('待裁决', options.note ? `${verdict} — ${options.note}` : verdict);
  } else {
    // CLARIFY 未决 → 已决（reject 视为不采纳，不再追问）
    const verdict = options.decision === 'accept' ? '已决' : '已决（不采纳）';
    newLine = oldLine.replace('未决', options.note ? `${verdict} — ${options.note}` : verdict);
  }

  lines[target.lineIndex] = newLine;
  await writeFile(filePath, lines.join('\n'));

  console.log(`✅ 第 ${options.item} 项已裁决: [${target.kind}] ${newLine.trim().slice(0, 60)}`);

  // 裁决后编号会重排，立即重读文件打印最新清单，避免连续操作按旧编号打错对象
  const remainRisk = (await readFile(riskPath, 'utf-8')).split('\n').filter((l) => l.includes('待裁决'));
  const remainClarify = (await readFile(clarifyPath, 'utf-8')).split('\n').filter((l) => l.includes('未决'));
  const remainCount = remainRisk.length + remainClarify.length;
  if (remainCount > 0) {
    console.log(`⏳ 还剩 ${remainCount} 项（编号已重排，按新编号继续）:`);
    let n = 1;
    for (const l of remainRisk) console.log(`  ${n++}. [RISK] ${l.trim().slice(0, 80)}`);
    for (const l of remainClarify) console.log(`  ${n++}. [CLARIFY] ${l.trim().slice(0, 80)}`);
  } else {
    console.log(`🎉 全部清零，可冻结: specprot iteration freeze -n ${options.iteration}`);
  }
}
