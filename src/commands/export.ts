/**
 * 导出命令 — 本迭代需求文档 → Word(.docx) / HTML / PDF
 *
 * 数据源: {期次}/04-交付/sources/*.md — freeze 导出的定稿快照
 * （导出与转换是两个独立步骤: 先 freeze 导出，再 export 转格式）
 *
 * 转换引擎: pandoc（与 SpecCore spec2doc 同源）
 *   - docx / html: pandoc 直接转
 *   - pdf: docx 中转后经 LibreOffice 转（需 brew install --cask libreoffice）
 *
 * 端归属: 需求文件中的「来源功能单元」行 → 其次「所属端」行
 *   - 按端导出（-p）时据此过滤
 *   - 无端归属的需求归入「未归属端/」
 *
 * 素材附录: 04-交付/converted/{端}/ 的素材转换产物按端合并，
 *   随需求文档一并转格式（输出「素材附录-{端}.{ext}」）
 */

import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { ensureDir, pathExists, readFile, readdir, remove, writeFile } from 'fs-extra';
import { getIterationDir, extractReqPlatform } from '../core/global-layer';

/** 支持的目标格式 → pandoc writer */
const WRITER_MAP: Record<string, string> = {
  docx: 'docx',
  html: 'html5',
  pdf: 'pdf',
};

export interface ExportOptions {
  iteration?: string;
  platforms?: string;
  format?: string;
  output?: string;
}

/** 需求正文中的端归属（与 freeze 快照/回流同口径: 来源功能单元 → 所属端） */
function platformOf(content: string): string {
  return extractReqPlatform(content);
}

function hasTool(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function exportCommand(options: ExportOptions): Promise<void> {
  const iteration = options.iteration;
  if (!iteration) {
    console.error('❌ 请指定期次名称: specprot export -i 期次名 -f docx,html');
    return;
  }
  const iterDir = getIterationDir(iteration);
  const onlyPlatforms = options.platforms
    ? options.platforms.split(',').map((p) => p.trim()).filter(Boolean)
    : [];
  const formats = (options.format || 'docx')
    .split(',')
    .map((f) => f.trim())
    .filter((f) => Boolean(f) && Boolean(WRITER_MAP[f]));

  // ── 收集源需求（只读已导出的交付快照；导出是 freeze 的活，转换是这里的活） ──
  const sourcesDir = join(iterDir, '04-交付', 'sources');
  const sources: { file: string; content: string }[] = [];
  if (await pathExists(sourcesDir)) {
    for (const f of await readdir(sourcesDir)) {
      if (!f.endsWith('.md') || f === 'README.md' || f === '备选方案附录.md') continue;
      sources.push({ file: f, content: await readFile(join(sourcesDir, f), 'utf-8') });
    }
  }
  if (sources.length === 0) {
    console.error(`❌ 期次「${iteration}」还没有导出的需求。请先导出: specprot iteration freeze -n ${iteration}`);
    return;
  }

  // ── 按端归组 ──
  const byPlatform = new Map<string, typeof sources>();
  let skipped = 0;
  for (const s of sources) {
    const pf = platformOf(s.content) || '未归属端';
    if (onlyPlatforms.length > 0 && !onlyPlatforms.includes(pf)) {
      skipped++;
      continue;
    }
    if (!byPlatform.has(pf)) byPlatform.set(pf, []);
    byPlatform.get(pf)!.push(s);
  }
  if (byPlatform.size === 0) {
    console.error(`❌ 指定端 ${onlyPlatforms.join(', ')} 在本迭代没有需求`);
    return;
  }

  // ── 引擎检测 ──
  if (!hasTool('pandoc')) {
    console.error('❌ 未检测到 pandoc（转换引擎）');
    console.error('   macOS: brew install pandoc   Linux: sudo apt install pandoc');
    return;
  }
  if (formats.includes('pdf') && !hasTool('soffice')) {
    console.error('⚠️  PDF 导出需要 LibreOffice（未检测到 soffice）');
    console.error('   macOS: brew install --cask libreoffice');
    console.error('   本次跳过 pdf，仅导出其余格式');
    formats.splice(formats.indexOf('pdf'), 1);
  }
  if (formats.length === 0) return;

  // ── 转换 ──
  const outBase = options.output || join(iterDir, 'exports');
  const tmpDir = join(tmpdir(), `specprot-export-${Date.now()}`);
  await ensureDir(tmpDir);
  const done: string[] = [];

  // ── 素材附录收集（converted 按端合并，随需求文档一并转格式） ──
  const appendix = new Map<string, string>();
  const convertedBase = join(iterDir, '04-交付', 'converted');
  for (const pf of byPlatform.keys()) {
    if (pf === '未归属端') continue;
    const convDir = join(convertedBase, pf);
    if (!(await pathExists(convDir))) continue;
    let body = '';
    for (const f of (await readdir(convDir)).sort()) {
      if (!f.endsWith('.md') || f === 'README.md') continue;
      body += `\n\n---\n\n## 素材: ${f.replace(/\.md$/, '')}\n\n${await readFile(join(convDir, f), 'utf-8')}`;
    }
    if (body) appendix.set(pf, `# 素材原文附录 — ${pf}\n\n> 由 04-交付/converted/${pf}/ 合并，随需求文档一并转格式。\n${body}`);
  }

  /** 单文件转换（三种格式共用） */
  const convertOne = async (fmt: string, tmpMd: string, pfDir: string, stem: string): Promise<void> => {
    if (fmt === 'docx') {
      execSync(`pandoc -f gfm -t docx -o "${join(pfDir, `${stem}.docx`)}" "${tmpMd}"`, { stdio: 'pipe' });
    } else if (fmt === 'html') {
      execSync(`pandoc -f gfm -t html5 -s -o "${join(pfDir, `${stem}.html`)}" "${tmpMd}"`, { stdio: 'pipe' });
    } else if (fmt === 'pdf') {
      const tmpDocx = join(tmpDir, `${stem}.docx`);
      execSync(`pandoc -f gfm -t docx -o "${tmpDocx}" "${tmpMd}"`, { stdio: 'pipe' });
      execSync(`soffice --headless --convert-to pdf --outdir "${pfDir}" "${tmpDocx}"`, { stdio: 'pipe' });
    }
  };

  try {
    for (const fmt of formats) {
      const fmtDir = join(outBase, fmt);
      await ensureDir(fmtDir);
      for (const [pf, list] of byPlatform) {
        const pfDir = join(fmtDir, pf);
        await ensureDir(pfDir);
        for (const s of list) {
          const stem = s.file.replace(/\.md$/, '');
          const tmpMd = join(tmpDir, s.file);
          await writeFile(tmpMd, s.content);
          try {
            await convertOne(fmt, tmpMd, pfDir, stem);
            done.push(`${fmt}/${pf}/${stem}.${fmt === 'html' ? 'html' : fmt}`);
          } catch (err) {
            console.error(`⚠️ 转换失败 ${s.file}: ${(err as Error).message?.slice(0, 200)}`);
          }
        }
        // 素材原文附录（converted 合并件）随需求一并转格式
        const apx = appendix.get(pf);
        if (apx) {
          const stem = `素材附录-${pf}`;
          const tmpMd = join(tmpDir, `${stem}.md`);
          await writeFile(tmpMd, apx);
          try {
            await convertOne(fmt, tmpMd, pfDir, stem);
            done.push(`${fmt}/${pf}/${stem}.${fmt === 'html' ? 'html' : fmt}`);
          } catch (err) {
            console.error(`⚠️ 转换失败 ${stem}.md: ${(err as Error).message?.slice(0, 200)}`);
          }
        }
      }
    }
  } finally {
    await remove(tmpDir);
  }

  console.log('✅ 导出完成');
  console.log(`📁 ${outBase}/`);
  for (const d of done) console.log(`   ${d}`);
  if (skipped > 0) console.log(`   （按端过滤跳过 ${skipped} 个非选中端需求）`);
}
