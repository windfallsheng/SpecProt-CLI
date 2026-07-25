/**
 * /review 命令 — 生成需求评审报告
 * 
 * 产品确认后，specprot commit 自动写入 REQUIREMENT.md + 关联图表
 */
import { readFile, writeFile, pathExists, readdir, ensureDir } from 'fs-extra';
import { join } from 'path';

export async function reviewCommand(options: any) {
  const iteration = options.iteration || '';
  const file = options.file || '';

  // 确定需求源
  let iterDir = '';
  let reqPath = '';
  let outputDir = '';

  if (iteration) {
    iterDir = await findIterationDir(iteration) || `期次-${iteration}`;
    reqPath = join(iterDir, '00-需求文档', 'REQUIREMENT.md');
    outputDir = join(iterDir, '00-需求文档');
  } else {
    reqPath = join('00-需求文档', 'REQUIREMENT.md');
    outputDir = '00-需求文档';
  }
  if (file) reqPath = file;

  if (!(await pathExists(reqPath))) {
    console.error(`❌ 需求文件不存在: ${reqPath}`);
    process.exit(1);
  }

  const content = await readFile(reqPath, 'utf-8');
  const sections = splitSections(content);

  // 收集分析数据
  const globalIndex = await loadGlobalIndex();
  let existingReq = '';
  let taskDirs: string[] = [];
  let codeMap: Record<string, string> = {};

  if (iterDir) {
    const erPath = join(iterDir, '00-需求文档', 'REQUIREMENT.md');
    if (await pathExists(erPath)) existingReq = await readFile(erPath, 'utf-8');
    try { taskDirs = (await readdir(iterDir)).filter((d: string) => d.startsWith('Task-')); } catch {}
  }
  if (await pathExists(join('.speccore', 'GLOBAL', 'CODE_INDEX.md'))) {
    codeMap = parseCodeIndex(await readFile(join('.speccore', 'GLOBAL', 'CODE_INDEX.md'), 'utf-8'));
  }

  // 生成报告
  const now = new Date().toLocaleString('zh-CN');
  let report = `# 需求评审报告\n\n`;
  report += `> 生成时间: ${now}${iteration ? ` · 期次: ${iteration}` : ''}\n\n`;
  report += `---\n\n`;

  // 概要
  let conflicts = 0, relateds = 0, suggestions: string[] = [];
  const sectionResults: any[] = [];

  for (const sec of sections) {
    const result: any = { title: sec.title, items: [], status: 'green' };

    // 关联检查
    if (globalIndex) {
      const matches = findMatches(sec.content, globalIndex);
      if (matches.length > 0) {
        result.status = 'yellow';
        for (const m of matches.slice(0, 2)) {
          result.items.push({ icon: '📋', text: `有关联全局需求: ${m}` });
          relateds++;
        }
      }
    }

    // 重复检查
    if (existingReq) {
      const overlap = checkOverlap(sec.content, existingReq);
      if (overlap.length > 0) {
        result.status = 'yellow';
        for (const o of overlap.slice(0, 2)) {
          result.items.push({ icon: '⚠️', text: `与本迭代已有需求重叠: ${o}` });
          conflicts++;
        }
      }
    }

    // Task 关联
    for (const td of taskDirs) {
      const treq = join(iterDir, td, 'backend', 'REQ.md');
      if (await pathExists(treq) && hasKeywordMatch(sec.content, await readFile(treq, 'utf-8'))) {
        result.items.push({ icon: '📋', text: `已有 Task: ${td}` });
        relateds++; break;
      }
    }

    // 代码模块
    for (const [module, path] of Object.entries(codeMap)) {
      if (hasKeywordMatch(sec.content, module)) {
        result.items.push({ icon: '🔗', text: `相关代码模块: ${module} (${path})` });
      }
    }

    // 原型/图表链接
    const prototypePath = join(iterDir, '01-原型', 'prototype.html');
    if (await pathExists(prototypePath)) {
      result.items.push({ icon: '🎨', text: `原型预览: 01-原型/prototype.html` });
    }

    if (result.items.length === 0) {
      result.items.push({ icon: '✅', text: '全新需求，无冲突' });
    }

    sectionResults.push(result);
  }

  // 写概要
  const total = sections.length;
  report += `## 📊 概要\n\n`;
  report += `| 指标 | 数值 |\n| :--- | :--- |\n`;
  report += `| 章节数 | ${total} |\n`;
  report += `| 重叠项 | ${conflicts} |\n`;
  report += `| 关联项 | ${relateds} |\n`;
  report += `| 状态 | ${conflicts > 0 ? '🟡 有重叠需确认' : '🟢 无冲突'}`;
  report += ` |\n\n---\n\n`;

  // 逐章分析
  report += `## 📋 逐章分析\n\n`;
  for (const r of sectionResults) {
    const icon = r.status === 'green' ? '🟢' : '🟡';
    report += `### ${icon} ${r.title}\n\n`;
    for (const item of r.items) {
      report += `- ${item.icon} ${item.text}\n`;
    }
    report += '\n';
  }

  // 建议补充
  for (const sec of sections) {
    const ac = sec.content.includes('验收标准') || sec.content.includes('AC');
    if (!ac) suggestions.push(`建议为「${sec.title}」补充验收标准`);
    if (!sec.content.includes('异常') && !sec.content.includes('失败') && !sec.content.includes('错误')) {
      suggestions.push(`建议为「${sec.title}」补充异常场景`);
    }
  }

  if (suggestions.length > 0) {
    report += `---\n\n## 💡 建议补充\n\n`;
    for (const s of suggestions.slice(0, 6)) {
      report += `- [ ] ${s}\n`;
    }
    report += '\n';
  }

  // 下一步
  report += `---\n\n## ✅ 确认清单\n\n`;
  report += `请逐项确认后，执行 \`specprot commit\` 自动归档：\n\n`;
  report += `- [ ] 所有冲突/重叠已确认处理方式\n`;
  report += `- [ ] 建议补充项已处理或标记为后续\n`;
  report += `- [ ] 原型预览已确认\n`;
  report += `- [ ] 图表无误\n`;
  report += `\n> 💡 确认后: \`specprot commit${iteration ? ' -i ' + iteration : ''}\` 自动写入 REQUIREMENT.md + 关联图表和原型\n`;

  // 写入
  await ensureDir(outputDir);
  const reviewPath = join(outputDir, 'REVIEW.md');
  await writeFile(reviewPath, report, 'utf-8');

  console.log(`\n✅ 评审报告已生成: ${reviewPath}`);
  console.log(`   ${total} 个章节 · ${conflicts} 重叠 · ${relateds} 关联`);
  console.log(`\n💡 产品确认后: specprot commit${iteration ? ' -i ' + iteration : ''}`);
}

// ========== 工具函数 ==========

function splitSections(content: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const lines = content.split('\n');
  let currentTitle = '概述';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.match(/^#{1,3}\s/) && !currentContent.length) {
      currentTitle = line.replace(/^#+\s*/, '');
      continue;
    }
    if (line.match(/^#{1,3}\s/)) {
      sections.push({ title: currentTitle, content: currentContent.join('\n') });
      currentTitle = line.replace(/^#+\s*/, '');
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  sections.push({ title: currentTitle, content: currentContent.join('\n') });
  return sections.filter(s => s.content.trim().length > 20);
}

function extractKeywords(text: string): string[] {
  const words = text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
  const stopWords = new Set(['可以', '需要', '这个', '一个', '所有', '如果', '或者', '应该', '能够', '通过', '使用', '进行', '我们', '他们', '什么', '怎么']);
  return [...new Set(words.filter(w => w.length >= 2 && !stopWords.has(w)))];
}

function findMatches(text: string, index: string): string[] {
  const results: string[] = [];
  const keywords = extractKeywords(text);
  for (const line of index.split('\n')) {
    if (!line.startsWith('|') || line.includes('---')) continue;
    for (const kw of keywords) {
      if (line.includes(kw) && kw.length >= 3) {
        const name = line.split('|').map(c => c.trim()).filter(Boolean)[2] || '';
        if (name && !results.includes(name)) results.push(name);
      }
    }
  }
  return results.slice(0, 3);
}

function checkOverlap(newText: string, existingText: string): string[] {
  return extractKeywords(newText).filter(k => k.length >= 3 && existingText.includes(k)).slice(0, 3);
}

function hasKeywordMatch(a: string, b: string): boolean {
  return extractKeywords(a).some(k => k.length >= 3 && b.includes(k));
}

async function loadGlobalIndex(): Promise<string | null> {
  const path = join('.speccore', 'GLOBAL', 'INDEX.md');
  if (await pathExists(path)) return readFile(path, 'utf-8');
  return null;
}

function parseCodeIndex(content: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length >= 2 && cols[0] !== '工程' && cols[0] !== '---') {
      map[cols[0]] = cols[1] || '';
    }
  }
  return map;
}

async function findIterationDir(iteration: string): Promise<string | null> {
  if (!iteration) return null;
  const direct = `期次-${iteration}`;
  if (await pathExists(direct)) return direct;
  const entries = await readdir('.');
  for (const e of entries) {
    if (e.startsWith('期次-') && e.includes(iteration)) return e;
  }
  return null;
}
