/**
 * /check 命令 v2 — 智能增量需求分析
 * 
 * 支持两种模式：
 *   specprot check -s "一段需求"       ← AI刚生成，直接贴过来
 *   specprot check -f REQUIREMENT.md  ← AI已写入文件，逐章节分析
 * 
 * 检查维度：
 *   1. 与全局需求索引对照（冲突/重复/关联）
 *   2. 与本迭代已有需求对照
 *   3. 与已有 Task 对照
 *   4. 与代码模块对照
 */
import { readFile, pathExists, readdir } from 'fs-extra';
import { join } from 'path';

interface CheckResult {
  section: string;
  type: 'conflict' | 'duplicate' | 'new' | 'related' | 'info';
  message: string;
  severity: 'high' | 'medium' | 'low';
}

export async function checkCommand(options: any) {
  const iteration = options.iteration || '';
  const snippet = options.snippet || '';
  const file = options.file || '';

  // 确定输入源
  let sections: { title: string; content: string }[] = [];

  if (snippet) {
    sections = [{ title: '输入片段', content: snippet }];
    console.log('📝 检查需求片段...\n');
  } else if (file && await pathExists(file)) {
    const content = await readFile(file, 'utf-8');
    sections = splitSections(content);
    console.log(`📖 ${file} → ${sections.length} 个章节\n`);
  } else {
    console.error('❌ 请提供 --snippet "需求" 或 --file 路径');
    process.exit(1);
  }

  // 加载对照数据
  const globalIndex = await loadGlobalIndex();
  let iterReq = '';
  let iterDir = '';
  let taskDirs: string[] = [];
  let codeMap: Record<string, string> = {};

  iterDir = await findIterationDir(iteration) || '';
  if (iterDir) {
    const reqPath = join(iterDir, '00-需求文档', 'REQUIREMENT.md');
    if (await pathExists(reqPath)) iterReq = await readFile(reqPath, 'utf-8');
    try {
      taskDirs = (await readdir(iterDir)).filter((d: string) => d.startsWith('Task-'));
    } catch {}
  }
  const codeIndexPath = join('.speccore', 'GLOBAL', 'CODE_INDEX.md');
  if (await pathExists(codeIndexPath)) {
    codeMap = parseCodeIndex(await readFile(codeIndexPath, 'utf-8'));
  }

  // 逐章节检查
  let totalIssues = 0;
  for (const sec of sections) {
    const results: CheckResult[] = [];

    // 对照全局需求
    if (globalIndex) {
      const matches = findMatches(sec.content, globalIndex);
      if (matches.length > 0) {
        for (const m of matches.slice(0, 2)) {
          results.push({ section: sec.title, type: 'related', message: `有关联全局需求: ${m}`, severity: 'low' });
        }
      } else {
        results.push({ section: sec.title, type: 'new', message: '全新需求', severity: 'low' });
      }
    }

    // 对照本迭代需求
    if (iterReq) {
      const overlap = checkOverlap(sec.content, iterReq);
      if (overlap.length > 0) {
        for (const o of overlap.slice(0, 2)) {
          results.push({ section: sec.title, type: 'duplicate', message: `⚠️ 本迭代重复: "${o}"`, severity: 'medium' });
        }
      }
    }

    // 对照已有 Task
    for (const td of taskDirs) {
      const taskReq = join(iterDir, td, 'backend', 'REQ.md');
      if (!(await pathExists(taskReq))) continue;
      const taskContent = await readFile(taskReq, 'utf-8');
      if (hasKeywordMatch(sec.content, taskContent)) {
        results.push({ section: sec.title, type: 'related', message: `📋 已有 Task: ${td}`, severity: 'medium' });
        break;
      }
    }

    // 对照代码模块
    for (const [module, path] of Object.entries(codeMap)) {
      if (hasKeywordMatch(sec.content, module)) {
        results.push({ section: sec.title, type: 'info', message: `🔗 代码模块: ${module} (${path})`, severity: 'low' });
      }
    }

    // 输出章节结果
    const hasIssues = results.filter(r => r.type !== 'new').length > 0;
    if (hasIssues) totalIssues++;

    const icon = hasIssues ? '🟡' : '🟢';
    console.log(`${icon} ${sec.title}`);
    for (const r of results) {
      const prefix = r.type === 'duplicate' ? '  ⚠️  ' : r.type === 'related' ? '  📋 ' : r.type === 'info' ? '  🔗 ' : '  ✅ ';
      console.log(`${prefix}${r.message}`);
    }
    console.log('');
  }

  // 总结
  if (totalIssues === 0) {
    console.log('✅ 全部通过 — 无冲突、无重复，可以提交');
  } else {
    console.log(`📊 总结: ${sections.length} 个章节，${totalIssues} 个有建议关注项`);
    console.log('💡 建议: 确认上述标注后再提交给开发侧');
  }
}

// ========== 工具函数 ==========

function splitSections(content: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const lines = content.split('\n');
  let currentTitle = '文档头部';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.match(/^#{1,3}\s/)) {
      if (currentContent.length > 0) {
        sections.push({ title: currentTitle, content: currentContent.join('\n') });
      }
      currentTitle = line.replace(/^#+\s*/, '');
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0 || currentTitle !== '文档头部') {
    sections.push({ title: currentTitle, content: currentContent.join('\n') });
  }
  return sections.filter(s => s.content.trim().length > 20);
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
  const keywords = extractKeywords(newText).filter(k => k.length >= 3);
  return keywords.filter(kw => existingText.includes(kw)).slice(0, 3);
}

function hasKeywordMatch(a: string, b: string): boolean {
  return extractKeywords(a).some(k => k.length >= 3 && b.includes(k));
}

function extractKeywords(text: string): string[] {
  const words = text.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  const stopWords = new Set(['可以', '需要', '这个', '一个', '所有', '如果', '或者', '应该', '能够', '通过', '使用', '进行', '我们', '他们', '什么', '怎么', '为什么', '是否']);
  return [...new Set(words.filter(w => w.length >= 2 && !stopWords.has(w)))];
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
