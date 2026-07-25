/**
 * 代码工程扫描器 — 从本地代码仓库提取设计系统
 * 
 * 扫描目标:
 *   .css / .scss / .less  → CSS 变量、颜色值
 *   tailwind.config.*      → Tailwind 主题配置
 *   theme.ts / theme.js    → Ant Design / Element 主题覆盖
 *   .vue / .tsx / .jsx    → style 标签、内联样式
 *   DESIGN_SYSTEM.yaml     → 已有的设计系统
 */
import { readFile, pathExists, readdir, statSync } from 'fs-extra';
import { join, extname } from 'path';

interface ScanResult {
  colors: Map<string, number>;   // 颜色 → 出现次数
  fonts: Map<string, number>;
  radii: Map<string, number>;
  framework: string | null;
  sourceFiles: string[];
}

export async function scanProject(dir: string): Promise<Record<string, any>> {
  const result: ScanResult = {
    colors: new Map(),
    fonts: new Map(),
    radii: new Map(),
    framework: null,
    sourceFiles: [],
  };

  console.log(`🔍 扫描: ${dir}\n`);
  await walkDir(dir, result);

  // 输出扫描摘要
  const totalFiles = result.sourceFiles.length;
  console.log(`   ${totalFiles} 个样式文件`);

  // 取出现频率最高的颜色
  const topColors = [...result.colors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const topFonts = [...result.fonts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const topRadii = [...result.radii.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  // 智能推断主色：出现最多的非灰度色
  const primary = inferColor(topColors, 'primary');
  const danger = inferColor(topColors, 'danger');
  const bg = inferColor(topColors, 'background');
  const text = inferColor(topColors, 'text');
  const font = topFonts[0]?.[0] || 'system-ui, sans-serif';
  const radius = topRadii[0]?.[0] || '8px';

  console.log(`   🎨 主色: ${primary} (${topColors[0]?.[1] || 0}次)`);
  console.log(`   🔴 警示色: ${danger}`);
  console.log(`   📝 字体: ${font}`);
  console.log(`   🏗  框架: ${result.framework || '未检测到'}\n`);

  return {
    source: `project://${dir} (${totalFiles} files)`,
    framework: result.framework,
    colors: {
      primary,
      danger,
      success: '#52c41a',
      warning: '#faad14',
      background: bg,
      text,
      textSecondary: '#666666',
      border: '#e8e8e8',
    },
    typography: {
      fontFamily: font,
      fontSize: '14px',
      headingSize: '18px',
    },
    spacing: { base: '8px', small: '4px', medium: '16px', large: '24px' },
    components: {
      borderRadius: radius,
      buttonRadius: radius,
      buttonPadding: '8px 20px',
      cardShadow: '0 2px 8px rgba(0,0,0,0.08)',
      inputHeight: '36px',
    },
  };
}

async function walkDir(dir: string, result: ScanResult, depth = 0) {
  if (depth > 5) return;
  if (!(await pathExists(dir))) return;

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    
    // 跳过 node_modules / dist / .git
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === '.speccore') continue;

    try {
      const stat = await statSync(fullPath);
      
      if (stat.isDirectory()) {
        await walkDir(fullPath, result, depth + 1);
      } else {
        const ext = extname(entry).toLowerCase();
        
        // CSS 文件
        if (['.css', '.scss', '.less', '.styl'].includes(ext)) {
          const content = await readFile(fullPath, 'utf-8');
          extractFromCSS(content, result);
          result.sourceFiles.push(fullPath);
        }
        // Tailwind 配置
        else if (entry.includes('tailwind.config')) {
          const content = await readFile(fullPath, 'utf-8');
          result.framework = 'tailwind';
          extractFromTailwind(content, result);
          result.sourceFiles.push(fullPath);
        }
        // 主题配置
        else if (entry.includes('theme') && (ext === '.ts' || ext === '.js')) {
          const content = await readFile(fullPath, 'utf-8');
          if (content.includes('primary') || content.includes('token') || content.includes('color')) {
            extractFromThemeFile(content, result);
            result.sourceFiles.push(fullPath);
          }
        }
        // Vue 单文件组件
        else if (ext === '.vue') {
          const content = await readFile(fullPath, 'utf-8');
          const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/g);
          if (styleMatch) {
            for (const s of styleMatch) {
              extractFromCSS(s, result);
            }
            result.sourceFiles.push(fullPath);
          }
        }
        // 检测框架
        else if (entry === 'package.json') {
          const content = await readFile(fullPath, 'utf-8');
          if (content.includes('antd') || content.includes('ant-design')) result.framework = 'antd';
          else if (content.includes('element-plus') || content.includes('element-ui')) result.framework = 'element';
          else if (content.includes('@mui/material')) result.framework = 'material';
          else if (content.includes('tailwindcss')) result.framework = 'tailwind';
        }
      }
    } catch {
      // 权限/读取错误，跳过
    }
  }
}

function extractFromCSS(css: string, result: ScanResult) {
  // 提取颜色: #xxx, rgb(), hsl(), var(--xxx)
  const colorMatches = css.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g) || [];
  for (const c of colorMatches) {
    const normalized = normalizeColor(c);
    result.colors.set(normalized, (result.colors.get(normalized) || 0) + 1);
  }

  // 提取 CSS 变量
  const varMatches = css.match(/--[\w-]+:\s*([^;]+)/g) || [];
  for (const v of varMatches) {
    const val = v.split(':')[1]?.trim();
    if (val?.match(/#[0-9a-fA-F]{3,8}/)) {
      result.colors.set(normalizeColor(val), (result.colors.get(normalizeColor(val)) || 0) + 5);
    }
  }

  // 提取字体
  const fontMatches = css.match(/font-family:\s*([^;]+)/gi) || [];
  for (const f of fontMatches) {
    const font = f.replace(/font-family:\s*/i, '').trim().replace(/['"]/g, '');
    result.fonts.set(font, (result.fonts.get(font) || 0) + 1);
  }

  // 提取圆角
  const radiusMatches = css.match(/border-radius:\s*([^;]+)/gi) || [];
  for (const r of radiusMatches) {
    const val = r.replace(/border-radius:\s*/i, '').trim();
    result.radii.set(val, (result.radii.get(val) || 0) + 1);
  }
}

function extractFromTailwind(content: string, result: ScanResult) {
  // 提取 tailwind 主题颜色
  const colorBlocks = content.match(/colors:\s*\{[^}]+\}/g) || [];
  for (const block of colorBlocks) {
    const hexMatches = block.match(/#[0-9a-fA-F]{6}/g) || [];
    for (const h of hexMatches) {
      result.colors.set(h, (result.colors.get(h) || 0) + 10); // 加权
    }
  }
}

function extractFromThemeFile(content: string, result: ScanResult) {
  // 提取主题 token 中的颜色
  const tokenMatches = content.match(/color[A-Z]\w+:\s*['"](#[0-9a-fA-F]{6})['"]/g) || [];
  for (const t of tokenMatches) {
    const hex = t.match(/#[0-9a-fA-F]{6}/);
    if (hex) result.colors.set(hex[0], (result.colors.get(hex[0]) || 0) + 20); // 高权重
  }
}

function normalizeColor(color: string): string {
  // 统一为 6 位 hex
  if (color.startsWith('#') && color.length === 4) {
    return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
  }
  if (color.startsWith('#')) return color.toLowerCase();
  if (color.startsWith('rgb')) {
    const nums = color.match(/\d+/g);
    if (nums && nums.length >= 3) {
      return '#' + nums.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    }
  }
  return color;
}

function inferColor(colors: [string, number][], role: string): string {
  // 过滤灰度色
  const nonGray = colors.filter(([c]) => {
    if (!c.startsWith('#')) return false;
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const diff = Math.max(r, g, b) - Math.min(r, g, b);
    if (role === 'background') return diff < 30 && (r + g + b) / 3 > 200; // 浅色背景
    if (role === 'text') return diff < 30 && (r + g + b) / 3 < 80;       // 深色文字
    if (role === 'danger') return r > 180 && g < 100 && b < 100;          // 红色系
    return diff > 60; // 有色彩倾向的颜色
  });

  const candidates = nonGray.length > 0 ? nonGray : colors;
  if (candidates.length === 0) return role === 'danger' ? '#ff4d4f' : '#1677ff';
  
  // 返回频率最高的
  return candidates[0][0];
}
