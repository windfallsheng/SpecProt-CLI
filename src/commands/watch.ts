/**
 * /watch 命令 — 文件监控 + 智能建议
 * 
 * 产品保存 REQUIREMENT.md 时自动:
 *   1. 增量检查（冲突/重复）
 *   2. 推荐相关图表
 *   3. 推荐参考原型
 *   4. 提示缺失内容
 */
import { watch, readFile, pathExists, readdir } from 'fs-extra';
import { join } from 'path';

export async function watchCommand(options: any) {
  const iteration = options.iteration || '';
  const file = options.file || (iteration ? `期次-${iteration}/00-需求文档/REQUIREMENT.md` : '00-需求文档/REQUIREMENT.md');

  if (!(await pathExists(file))) {
    console.error(`❌ 文件不存在: ${file}`);
    console.log('💡 先创建需求文件再监控');
    process.exit(1);
  }

  console.log(`👀 监控: ${file}`);
  console.log('   保存文件后自动检查...\n');
  console.log('   Ctrl+C 停止\n');

  // 首次检查
  await checkAndSuggest(file, iteration);

  // 监听变化
  let debounce: NodeJS.Timeout | null = null;
  watch(file, async () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(async () => {
      console.log(`\n📝 ${new Date().toLocaleTimeString('zh-CN')} — 检测到保存\n`);
      await checkAndSuggest(file, iteration);
      console.log('─'.repeat(50));
    }, 1000);
  });

  // 保持进程
  await new Promise(() => {});
}

async function checkAndSuggest(file: string, iteration: string) {
  const content = await readFile(file, 'utf-8');
  const sections = content.split(/\n(?=#{1,3}\s)/);
  const newContent = sections[sections.length - 1] || content;

  // 1. 快速检查
  const issues: string[] = [];

  if (!content.includes('验收标准') && !content.includes('AC')) {
    issues.push('⚠️  缺少验收标准');
  }
  if (!content.includes('异常') && !content.includes('错误') && !content.includes('失败')) {
    issues.push('💡 建议补充异常场景');
  }

  const hasTable = content.includes('| 字段 |');
  const hasActions = content.includes('**操作**');
  const hasSearch = content.includes('搜索') || content.includes('查询') || content.includes('筛选');

  // 2. 推荐操作
  const recs: string[] = [];

  if (hasTable && hasActions) {
    recs.push('🎨 specprot prototype → 生成原型预览');
  }
  if (hasSearch && hasTable) {
    recs.push('📊 specprot review → 生成评审报告');
  }
  if (content.length > 500) {
    recs.push('🔍 specprot check → 对照已有需求分析');
  }

  // 3. 检查是否有已有原型/图表可参考
  const iterDir = await findIterationDir(iteration);
  if (iterDir) {
    const protoPath = join(iterDir, '01-原型', 'prototype.html');
    if (await pathExists(protoPath)) {
      recs.push('📂 已有原型: ' + protoPath);
    }
  }

  // 4. 输出
  if (issues.length > 0) {
    console.log('📋 建议补充:');
    issues.forEach(i => console.log('  ' + i));
  }

  if (recs.length > 0) {
    console.log('\n💡 推荐操作:');
    recs.forEach(r => console.log('  ' + r));
  }

  if (issues.length === 0 && recs.length === 0) {
    console.log('✅ 看起来不错，继续写');
  }
}

async function findIterationDir(iteration: string): Promise<string | null> {
  if (!iteration) return null;
  const direct = `期次-${iteration}`;
  if (await pathExists(direct)) return direct;
  try {
    const entries = await readdir('.');
    for (const e of entries) {
      if (e.startsWith('期次-') && e.includes(iteration)) return e;
    }
  } catch {}
  return null;
}
