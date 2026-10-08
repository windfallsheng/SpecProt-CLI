/**
 * /prototype 命令 — 从需求文档生成 HTML 原型
 *
 * 支持两种入口：
 *   期次层: specprot prototype -i Q1 [-p web] → 读取 期次-Q1/{端}/REQUIREMENT.md
 *           → 输出 期次-Q1/{端}/assets/prototypes/（冻结时随交付镜像走）
 *   任意文档: specprot prototype -f REQUIREMENT.md → 输出默认 prototypes/（-o 覆盖）
 */
import { readFile, writeFile, ensureDir, pathExists, readdir } from 'fs-extra';
import { join } from 'path';
import { parseRequirement, renderHTML } from '../engines/prototype';
import { platformNamesFrom } from '../core/workspace-manager';

export async function prototypeCommand(options: any) {
  const iteration = options.iteration || '';
  let reqFile: string;
  let outputDir: string;

  // 确定工作目录
  if (iteration) {
    // 期次层：自动查找迭代目录，端名 = --platform 或期次平台行第一个端
    const iterDir = await findIterationDir(iteration);
    if (!iterDir) {
      console.error(`❌ 未找到期次目录: 期次-${iteration}`);
      process.exit(1);
    }
    const platform = options.platform || await firstPlatform(iterDir);
    if (!platform) {
      console.error(`❌ 期次未声明端名（README 平台行为空）。`);
      console.error(`   请用 -p 指定端名: specprot prototype -i ${iteration} -p web`);
      process.exit(1);
    }
    reqFile = join(iterDir, platform, 'REQUIREMENT.md');
    outputDir = join(iterDir, platform, 'assets', 'prototypes');
    console.log(`📍 期次: ${iteration} / ${platform}`);
  } else {
    // 任意文档入口：必须 -f 指定需求文档
    if (!options.file) {
      console.error('❌ 未指定需求文档。请用 -f 指定: specprot prototype -f REQUIREMENT.md');
      console.error('   或指定期次读取期次内端级需求: specprot prototype -i 期次-2026-Q3');
      process.exit(1);
    }
    reqFile = options.file;
    outputDir = options.output || 'prototypes';
    console.log('📍 单文档模式');
  }

  // 支持 --file 覆盖
  if (options.file) {
    reqFile = options.file;
  }
  if (options.output) {
    outputDir = options.output;
  }

  // 1. 读取需求文档
  if (!(await pathExists(reqFile))) {
    console.error(`❌ 需求文件不存在: ${reqFile}`);
    if (iteration) {
      console.log('💡 先在期次目录下写 REQUIREMENT.md，或使用全局层的 speccore import');
    }
    process.exit(1);
  }

  console.log(`📖 需求文档: ${reqFile}`);
  const markdown = await readFile(reqFile, 'utf-8');

  // 2. 尝试加载设计系统
  const designSystem = await loadDesignSystem();

  // 3. 解析 → 生成原型规格
  console.log('🔍 解析需求结构...');
  const spec = parseRequirement(markdown);

  // 4. 渲染 HTML（传入设计系统）
  console.log(`🎨 生成原型 (${spec.pages.length} 个页面)...`);
  const html = renderHTML(spec, designSystem);

  // 5. 写入文件
  await ensureDir(outputDir);
  const filename = join(outputDir, 'prototype.html');
  await writeFile(filename, html, 'utf-8');

  console.log('');
  console.log(`✅ 原型已生成: ${filename}`);
  console.log(`   ${spec.pages.length} 个页面 · ${spec.pages.reduce((sum, p) => sum + p.fields.length, 0)} 个字段`);
  if (designSystem) {
    console.log(`   🎨 设计系统: DESIGN_SYSTEM.yaml 已应用`);
  }
  console.log('');
  console.log('💡 用浏览器打开 prototype.html 即可预览');
  if (iteration) {
    console.log(`💡 评审通过后: speccore iteration split --iteration=${iteration}`);
  }
}

/**
 * 期次平台行第一个端名（`> 平台: web(网页端), backend` → 'web'）
 */
async function firstPlatform(iterDir: string): Promise<string | null> {
  const readmePath = join(iterDir, 'README.md');
  if (!(await pathExists(readmePath))) return null;
  const content = await readFile(readmePath, 'utf-8');
  const m = content.match(/>\s*平台[:：]\s*(.+)/);
  if (!m) return null;
  const names = platformNamesFrom(m[1]);
  return names.length > 0 ? names[0] : null;
}

/**
 * 查找期次目录（ID 或名称匹配）
 */
async function findIterationDir(iteration: string): Promise<string | null> {
  // 直接匹配
  const directDir = `期次-${iteration}`;
  if (await pathExists(directDir)) return directDir;

  // 模糊匹配
  const entries = await readdir('.');
  for (const entry of entries) {
    if (entry.startsWith('期次-') && entry.includes(iteration)) {
      return entry;
    }
  }
  return null;
}

/**
 * 加载全局设计系统（优先级：期次级 > 全局级 > 默认）
 */
async function loadDesignSystem(): Promise<any | null> {
  const paths = [
    '.speccore/GLOBAL/DESIGN_SYSTEM.yaml',
    '.speccore/DESIGN_SYSTEM.yaml',
    '.speccore/config/design-system.yaml',
    'DESIGN_SYSTEM.yaml',
  ];

  for (const p of paths) {
    if (await pathExists(p)) {
      try {
        const yaml = require('js-yaml');
        const content = await readFile(p, 'utf-8');
        return yaml.load(content);
      } catch {
        // 不是 YAML，跳过
      }
    }
  }
  return null;
}
