/**
 * 素材转换命令 — task convert（v0.2.0）
 *
 * 确定性格式转换：docx/pdf/xlsx → md（产物进 converted/）
 * 录音 → 提示转写；图片 → 建立索引（不转文本）
 */

import { scanAndConvert, buildImageIndex } from '../core/material-converter';
import { Platform } from '../core/workspace-manager';

export interface ConvertOptions {
  iteration: string;
  platform?: string;
}

export async function convertCommand(options: ConvertOptions): Promise<void> {
  if (!options.iteration) {
    console.error('❌ 期次名称是必需的。');
    console.error('   示例: specprot convert -i 期次-2026-Q3');
    return;
  }

  const platform = options.platform as Platform | undefined;

  console.log(`🔧 扫描素材并转换 (${options.iteration})...\n`);

  const summary = await scanAndConvert(options.iteration, platform);

  for (const c of summary.converted) {
    console.log(`   ✅ ${c.file} → ${c.output} (${c.size} 字符)`);
  }
  for (const sk of summary.skipped) {
    console.log(`   ⏭️  ${sk}`);
  }
  if (summary.images.length > 0) {
    const idxPath = await buildImageIndex(options.iteration, summary.images);
    console.log(`   🖼️  图片索引: ${idxPath} (${summary.images.length} 张)`);
  }

  console.log('');
  console.log(`📊 共 ${summary.total} 个文件: ${summary.converted.length} 转换 / ${summary.skipped.length} 跳过`);
  if (summary.skipped.some((s) => s.includes('录音'))) {
    console.log('');
    console.log('💡 录音文件请先用转写工具转为文本，放入对应端素材目录后重新分析。');
  }
  console.log('');
  console.log('💡 下一步: specprot analyze -i "' + options.iteration + '" -p web');
  console.log('');
  console.log('[SPECPROT_STEP_DONE]');
  console.log('[SPECPROT_NEXT_STEP] specprot analyze -i "' + options.iteration + '" -p <端>（或 specprot run --resume -i "' + options.iteration + '"）');
}
