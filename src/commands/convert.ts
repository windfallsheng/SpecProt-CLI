/**
 * 素材转换命令 — task convert
 *
 * 确定性格式转换：docx/pdf/xlsx → md（产物进 converted/，一字不差）
 * 音频/视频 → 按 .specprot.yml 策略（prompt 提示 / ai 生成接力清单 _pending-ai.md）
 * 图片 → 建立索引（不转文本）
 * 提炼稿 → 宿主 AI 按清单接力写入 converted/{端}/_refined/（分析优先依据）
 */

import { scanAndConvert, buildImageIndex } from '../core/material-converter';
import { listIterationPlatforms, Platform } from '../core/workspace-manager';

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
  console.log(`📊 共 ${summary.total} 个文件: ${summary.converted.length} 转换 / ${summary.skipped.length} 跳过 / ${summary.pendingAI.length} 待 AI 处理`);
  if (summary.skipped.some((s) => s.includes('录音') || s.includes('视频'))) {
    console.log('');
    console.log('💡 prompt 模式下的音视频不自动转写。想要 AI 直读/本地转写，请在期次根目录配置 .specprot.yml（见 docs/command-reference.md）。');
  }
  if (summary.pendingAI.length > 0) {
    console.log('');
    console.log(`🤖 待 AI 处理 ${summary.pendingAI.length} 个音视频文件，清单: 00-素材/converted/_pending-ai.md`);
    console.log('📌 宿主 AI 指令：按清单处理协议逐个处理（转写 → 提炼 → 落盘 converted/{端}/_refined/），完成后删除清单再推进分析。');
  }
  console.log('');
  const platforms = await listIterationPlatforms(options.iteration);
  console.log('💡 下一步: specprot analyze -i "' + options.iteration + '" -p ' + (platforms[0] || '<端>'));
  console.log('');
  console.log('[SPECPROT_STEP_DONE]');
  console.log('[SPECPROT_NEXT_STEP] ' + (summary.pendingAI.length > 0
    ? '宿主 AI 按 00-素材/converted/_pending-ai.md 处理音视频后: specprot analyze -i "' + options.iteration + '" -p <端>（或 specprot run --resume -i "' + options.iteration + '"）'
    : 'specprot analyze -i "' + options.iteration + '" -p <端>（或 specprot run --resume -i "' + options.iteration + '"）'));
}
