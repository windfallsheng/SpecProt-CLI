/**
 * 素材转换器 — 确定性格式转换（v0.2.0）
 *
 * 分界原则：格式转换是确定性的（CLI 干），内容提炼是语义性的（AI 干）。
 *   docx/pdf/xlsx → markdown 文本：确定性转换，产物进 converted/{端}/（与素材端目录对应）
 *   录音文件 → 提示转写（CLI 不做 ASR），转写文本由用户放入素材区
 *   图片 → 不转文本，建立素材索引（AI 生成原型时按需查看原图）
 *
 * 原始素材只读，转换产物进 converted/——对应 SpecCore sources/ 只读纪律。
 */

import { readFile, writeFile, pathExists, readdir, ensureDir, stat } from 'fs-extra';
import { join, extname, basename } from 'path';
import mammoth from 'mammoth';
// @ts-ignore — pdf-parse 无类型定义
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import {
  getMaterialPlatformDir,
  getConvertedDir,
  Platform,
} from './workspace-manager';

// ============================================================
// 类型定义
// ============================================================

export interface ConvertResult {
  file: string;        // 源文件相对路径
  output: string;      // 产物相对路径
  kind: 'docx' | 'pdf' | 'xlsx' | 'skipped';
  size: number;        // 产物字节数
}

export interface ConvertSummary {
  total: number;
  converted: ConvertResult[];
  skipped: string[];   // 无法转换的文件（录音/图片/未知格式）
  images: string[];    // 图片清单（建立索引）
}

// ============================================================
// 单文件转换
// ============================================================

/** docx → 纯文本 */
async function convertDocx(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value.trim();
}

/** pdf → 纯文本 */
async function convertPdf(filePath: string): Promise<string> {
  const buf = await readFile(filePath);
  const result = await pdfParse(buf);
  return (result.text || '').trim();
}

/** xlsx → markdown 表格（逐 sheet） */
async function convertXlsx(filePath: string): Promise<string> {
  const workbook = XLSX.readFile(filePath);
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    if (rows.length === 0) continue;

    parts.push(`## ${sheetName}\n`);
    const mdRows = rows.map((row) =>
      `| ${row.map((cell) => String(cell ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`
    );
    parts.push(mdRows[0]);
    parts.push(`| ${mdRows[0].split('|').filter((c) => c.trim() !== '').map(() => '---').join(' | ')} |`);
    parts.push(mdRows.slice(1).join('\n'));
    parts.push('');
  }

  return parts.join('\n').trim();
}

/** 按扩展名分发转换 */
async function convertFile(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case '.docx':
      return convertDocx(filePath);
    case '.pdf':
      return convertPdf(filePath);
    case '.xlsx':
    case '.xls':
      return convertXlsx(filePath);
    default:
      throw new Error(`不支持转换的格式: ${ext || '无扩展名'}`);
  }
}

// ============================================================
// 批量扫描转换
// ============================================================

const CONVERTIBLE = /\.(docx|pdf|xlsx|xls)$/i;
const IMAGE = /\.(png|jpg|jpeg|gif|bmp|webp)$/i;
const AUDIO = /\.(mp3|m4a|wav|wma|aac|flac|amr)$/i;

/**
 * 扫描素材区（端子目录 + shared/），转换 docx/pdf/xlsx 进 converted/，建立图片索引
 */
export async function scanAndConvert(
  iterationName: string,
  targetPlatform?: Platform | 'shared'
): Promise<ConvertSummary> {
  const summary: ConvertSummary = { total: 0, converted: [], skipped: [], images: [] };

  const scanDirs: Array<{ dir: string }> = [];
  if (targetPlatform && targetPlatform !== 'shared') {
    scanDirs.push({ dir: targetPlatform });
  } else {
    for (const d of ['web', 'h5', 'miniapp', 'backend']) scanDirs.push({ dir: d });
  }
  scanDirs.push({ dir: 'shared' });

  const convertedDir = getConvertedDir(iterationName);
  await ensureDir(convertedDir);

  for (const { dir } of scanDirs) {
    const srcDir = getMaterialPlatformDir(iterationName, dir as Platform | 'shared');
    if (!(await pathExists(srcDir))) continue;

    for (const file of await readdir(srcDir)) {
      const srcPath = join(srcDir, file);
      const st = await stat(srcPath);
      if (st.isDirectory()) continue;
      summary.total++;

      if (CONVERTIBLE.test(file)) {
        const relPath = `${dir}/${file}`;
        try {
          const text = await convertFile(srcPath);
          const outName = `${basename(file, extname(file))}.md`;
          const outDir = join(convertedDir, dir);
          await ensureDir(outDir);
          const outPath = join(outDir, outName);
          await writeFile(outPath, text, 'utf-8');
          summary.converted.push({
            file: relPath,
            output: `converted/${dir}/${outName}`,
            kind: extname(file).slice(1).toLowerCase() as ConvertResult['kind'],
            size: text.length,
          });
        } catch (e) {
          summary.skipped.push(`${dir}/${file}（转换失败: ${(e as Error).message}）`);
        }
      } else if (IMAGE.test(file)) {
        summary.images.push(`${dir}/${file}`);
      } else if (AUDIO.test(file)) {
        summary.skipped.push(`${dir}/${file}（录音——请用转写工具转为文本后放入素材区）`);
      } else {
        // txt/md 无需转换，collectMaterials 直接读取
        summary.skipped.push(`${dir}/${file}（无需转换）`);
      }
    }
  }

  return summary;
}

/** 建立图片索引（供 AI 生成原型时按需查看） */
export async function buildImageIndex(iterationName: string, images: string[]): Promise<string> {
  const lines = [
    '# 图片素材索引',
    '',
    '> 以下图片按路径列出。AI 生成原型/需求时，请用 Read 工具按需查看原图。',
    '',
  ];
  if (images.length === 0) {
    lines.push('（无图片素材）');
  } else {
    for (const img of images) {
      lines.push(`- \`00-素材/${img}\``);
    }
  }
  const content = lines.join('\n') + '\n';
  const idxPath = join(getConvertedDir(iterationName), 'images-index.md');
  await writeFile(idxPath, content, 'utf-8');
  return idxPath;
}
