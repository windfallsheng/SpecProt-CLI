/**
 * /design 命令 — 六种方式提取设计系统
 */
import { writeFile, pathExists, readFile } from 'fs-extra';
import { join } from 'path';
import { execSync } from 'child_process';

export async function designCommand(options: any) {
  // 默认落全局层（.speccore/GLOBAL/）——风格资产的权威居所；--output 可自定义
  const { ensureGlobalLayer } = await import('../core/global-layer');
  await ensureGlobalLayer();
  const globalDs = join('.speccore', 'GLOBAL', 'DESIGN_SYSTEM.yaml');
  const output = options.output || globalDs;
  const styleGuide = options.output ? 'STYLE_GUIDE.html' : join('.speccore', 'GLOBAL', 'STYLE_GUIDE.html');

  async function writeAndGuide(yamlPath: string) {
    const { renderStyleGuide } = await import('../engines/style-guide');
    await renderStyleGuide(yamlPath, styleGuide);
  }

  // 重新生成样式指南（不修改 DESIGN_SYSTEM.yaml）
  if (options.update) {
    const yamlFile = typeof options.update === 'string' ? options.update : 'DESIGN_SYSTEM.yaml';
    if (!(await pathExists(yamlFile))) {
      console.error(`❌ 文件不存在: ${yamlFile}`);
      process.exit(1);
    }
    await writeAndGuide(yamlFile);
    console.log('💡 修改 DESIGN_SYSTEM.yaml 后，执行此命令同步视觉指南');
    return;
  }

  // 方式 1: 扫描本地工程
  if (options.scan) {
    const { scanProject } = await import('./scan');
    const r: any = await scanProject(options.scan);
    const yaml = renderDesignSystemYAML(r);
    await writeFile(output, yaml, 'utf-8');
    console.log(`✅ 设计系统: 从工程提取 → ${output}`);
    console.log(`   🎨 ${r.colors.primary} · 🏗 ${r.framework || '未检测到框架'}`);
    await writeAndGuide(output);
    return;
  }

  // 方式 2: 预设模板
  if (options.preset) {
    const ds = getPreset(options.preset);
    if (!ds) { console.error(`❌ 未知预设: ${options.preset}`); process.exit(1); }
    const yaml = renderDesignSystemYAML(ds);
    await writeFile(output, yaml, 'utf-8');
    console.log(`✅ 设计系统: ${options.preset} → ${output}`);
    await writeAndGuide(output);
    return;
  }

  // 方式 3: 本地文件
  if (options.file) {
    if (!(await pathExists(options.file))) { console.error(`❌ 文件不存在: ${options.file}`); process.exit(1); }
    const content = await readFile(options.file, 'utf-8');
    const ds = extractDesignSystem(content, `file://${options.file}`);
    const yaml = renderDesignSystemYAML(ds);
    await writeFile(output, yaml, 'utf-8');
    console.log(`✅ 从文件提取: ${options.file} → ${output}`);
    await writeAndGuide(output);
    return;
  }

  // 方式 4: URL 抓取
  if (options.url) {
    console.log(`🌐 抓取: ${options.url}\n`);
    let html = '';
    try {
      let cmd = `curl -sL --max-time 15 '${options.url}'`;
      if (options.cookie) { cmd += ` -H 'Cookie: ${options.cookie}'`; }
      if (options.header) { cmd += ` ${options.header.split(',').map((h: string) => `-H '${h.trim()}'`).join(' ')}`; }
      html = execSync(cmd, { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 });
    } catch {
      console.error('❌ 无法访问该网址（可能需要登录或页面是纯 JS 渲染）');
      process.exit(1);
    }
    if (html.length < 500 || html.includes('<div id="app">') || html.includes('<div id="root">')) {
      console.warn('⚠️  SPA 页面，curl 抓取不完整');
    }
    const ds = extractDesignSystem(html, options.url);
    const yaml = renderDesignSystemYAML(ds);
    await writeFile(output, yaml, 'utf-8');
    console.log(`✅ 设计系统: ${options.url} → ${output}`);
    await writeAndGuide(output);
    return;
  }

  // 无参数 → 帮助
  console.log('🎨 设计系统 — 六种方式:\n');
  console.log('  specprot design --scan=src/         扫描本地工程');
  console.log('  specprot design --preset=antd       预设模板 (antd/element/tailwind/material/minimal)');
  console.log('  specprot design --url=https://...   抓取线上页面');
  console.log('  specprot design --url=... --cookie= 登录态页面');
  console.log('  specprot design --file=style.css    本地 CSS/HTML 文件');
  console.log('  specprot design                     默认配置');
}

// ========== 设计系统类型 ==========

interface DesignSystem {
  source: string;
  framework?: string;
  colors: Record<string, string>;
  typography: { fontFamily: string; fontSize: string; headingSize: string };
  spacing: { base: string; small: string; medium: string; large: string };
  components: { borderRadius: string; buttonRadius: string; buttonPadding: string; cardShadow: string; inputHeight: string };
}

// ========== 渲染 YAML ==========

function renderDesignSystemYAML(ds: any): string {
  const YAML = require('js-yaml');
  const header = `# 设计系统 — 自动提取
# 来源: ${ds.source || 'unknown'}${ds.framework ? ` (${ds.framework})` : ''}
#
# 修改此文件后执行 specprot prototype 即可生效
`;
  const obj = {
    colors: ds.colors || {},
    typography: ds.typography || {},
    spacing: ds.spacing || {},
    components: ds.components || {},
  };
  return header + '\n' + YAML.dump(obj, { indent: 2, lineWidth: 120 });
}

// ========== 预设模板 ==========

function getPreset(name: string): DesignSystem | null {
  const presets: Record<string, DesignSystem> = {
    antd: mkDS('Ant Design 5', '#1677ff', '#ff4d4f', '#f5f5f5', '#000000d9', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', '6px'),
    element: mkDS('Element Plus', '#409eff', '#f56c6c', '#f2f3f5', '#303133', '"Helvetica Neue", "PingFang SC", sans-serif', '4px'),
    tailwind: mkDS('Tailwind CSS', '#3b82f6', '#ef4444', '#f9fafb', '#111827', 'ui-sans-serif, system-ui, sans-serif', '0.5rem'),
    material: mkDS('Material Design 3', '#6750a4', '#ba1a1a', '#fef7ff', '#1d1b20', '"Roboto", "Noto Sans SC", sans-serif', '12px'),
    minimal: mkDS('Minimal', '#000', '#e00', '#fff', '#111', 'system-ui, sans-serif', '4px'),
  };
  return presets[name] || null;
}

function mkDS(source: string, primary: string, danger: string, bg: string, text: string, font: string, radius: string): DesignSystem {
  return {
    source, framework: source,
    colors: { primary, danger, success: '#52c41a', warning: '#faad14', background: bg, text, textSecondary: '#666', border: '#e8e8e8' },
    typography: { fontFamily: font, fontSize: '14px', headingSize: '18px' },
    spacing: { base: '8px', small: '4px', medium: '16px', large: '24px' },
    components: { borderRadius: radius, buttonRadius: radius, buttonPadding: '8px 20px', cardShadow: '0 2px 8px rgba(0,0,0,0.08)', inputHeight: '36px' },
  };
}

// ========== URL/文件提取 ==========

function extractDesignSystem(html: string, source: string): DesignSystem {
  const ds: DesignSystem = mkDS(source, '#1677ff', '#ff4d4f', '#f5f5f5', '#333', '-apple-system, sans-serif', '8px');

  const cssVarMatch = html.match(/--[a-zA-Z-]+\s*:\s*[^;]+/g) || [];
  for (const m of cssVarMatch) {
    const [key, val] = m.split(':').map(s => s.trim());
    const value = val.replace(/[;!]/g, '').trim();
    if (key.includes('primary')) ds.colors.primary = value;
    else if (key.includes('danger') || key.includes('error')) ds.colors.danger = value;
    else if (key.includes('bg') || key.includes('background')) ds.colors.background = value;
    else if (key.includes('text')) ds.colors.text = value;
  }

  const fontMatch = html.match(/font-family\s*:\s*([^;]+)/i);
  if (fontMatch) ds.typography.fontFamily = fontMatch[1].trim();

  const radiusMatch = html.match(/border-radius\s*:\s*([^;]+)/i);
  if (radiusMatch) ds.components.borderRadius = radiusMatch[1].trim();

  // 框架检测
  if (html.includes('antd') || html.includes('ant-design')) { ds.colors.primary = '#1677ff'; ds.source += ' (Ant Design)'; }
  else if (html.includes('element-plus') || html.includes('element-ui')) { ds.colors.primary = '#409eff'; ds.source += ' (Element)'; }
  else if (html.includes('tailwind')) { ds.colors.primary = '#3b82f6'; ds.source += ' (Tailwind)'; }

  return ds;
}
