/**
 * Style Guide Renderer — 将 DESIGN_SYSTEM.yaml 渲染为产品可读的 HTML
 */
import { readFile, writeFile, pathExists } from 'fs-extra';

export async function renderStyleGuide(yamlPath: string, outputPath: string) {
  let ds: any;
  
  if (await pathExists(yamlPath)) {
    const YAML = require('js-yaml');
    const content = await readFile(yamlPath, 'utf-8');
    ds = YAML.load(content);
  } else {
    ds = defaultDesignSystem();
  }

  const html = generateStyleGuideHTML(ds);
  await writeFile(outputPath, html, 'utf-8');
  console.log(`✅ 样式指南: ${outputPath}`);
}

function defaultDesignSystem() {
  return {
    source: '默认',
    colors: { primary: '#1677ff', danger: '#ff4d4f', success: '#52c41a', warning: '#faad14',
      background: '#f5f5f5', text: '#333', textSecondary: '#666', border: '#e8e8e8' },
    typography: { fontFamily: 'system-ui', fontSize: '14px', headingSize: '18px' },
    spacing: { base: '8px', small: '4px', medium: '16px', large: '24px' },
    components: { borderRadius: '8px', buttonRadius: '6px', buttonPadding: '8px 20px',
      cardShadow: '0 2px 8px rgba(0,0,0,0.08)', inputHeight: '36px' },
  };
}

function generateStyleGuideHTML(ds: any): string {
  const c = ds.colors;
  const t = ds.typography;
  const s = ds.spacing;
  const cp = ds.components;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>样式指南 — SpecProt</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:${t.fontFamily};font-size:${t.fontSize};color:${c.text};background:${c.background};padding:24px}
h1{font-size:24px;margin-bottom:4px}
h2{font-size:${t.headingSize};margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid ${c.primary}}
h3{font-size:15px;margin:16px 0 8px}
.subtitle{color:${c.textSecondary};font-size:13px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.swatch{border-radius:${cp.borderRadius};overflow:hidden;box-shadow:${cp.cardShadow};background:#fff}
.swatch-color{height:80px}
.swatch-info{padding:10px 12px}
.swatch-name{font-size:12px;font-weight:600}
.swatch-value{font-size:11px;color:${c.textSecondary};margin-top:2px;font-family:monospace}
.btn-row{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
.btn{padding:${cp.buttonPadding};border-radius:${cp.buttonRadius};font-size:14px;cursor:default;font-family:inherit;border:1px solid ${c.border}}
.btn-primary{background:${c.primary};color:#fff;border-color:${c.primary}}
.btn-danger{background:${c.danger};color:#fff;border-color:${c.danger}}
.btn-default{background:#fff;color:${c.text}}
.btn-success{background:${c.success};color:#fff}
.btn-warning{background:${c.warning};color:#fff}
.input-row{display:flex;gap:10px;margin:8px 0}
input,select{border:1px solid ${c.border};border-radius:${cp.borderRadius};padding:6px 12px;font-size:14px;height:${cp.inputHeight};font-family:inherit}
.card-example{background:#fff;border-radius:${cp.borderRadius};box-shadow:${cp.cardShadow};padding:${s.medium};margin:8px 0}
.spacing-example{display:flex;gap:4px;margin:8px 0}
.spacing-block{background:${c.primary};opacity:.15;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:${c.textSecondary}}
.radius-row{display:flex;gap:12px;align-items:center}
.radius-box{width:60px;height:60px;background:${c.primary};opacity:.3;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff}
</style></head>
<body>
<h1>🎨 样式指南</h1>
<p class="subtitle">来源: ${ds.source} · 生成: ${new Date().toLocaleDateString('zh-CN')}</p>

<h2>🎨 颜色</h2>
<div class="grid">
  ${colorSwatch('主色', c.primary)}
  ${colorSwatch('警示', c.danger)}
  ${colorSwatch('成功', c.success)}
  ${colorSwatch('警告', c.warning)}
  ${colorSwatch('背景', c.background)}
  ${colorSwatch('文字', c.text)}
  ${colorSwatch('次要文字', c.textSecondary)}
  ${colorSwatch('边框', c.border)}
</div>

<h2>🔘 按钮</h2>
<div class="btn-row">
  <button class="btn btn-primary">主按钮</button>
  <button class="btn btn-danger">危险按钮</button>
  <button class="btn btn-default">默认按钮</button>
</div>
<p style="font-size:12px;color:${c.textSecondary};margin-top:4px">padding: ${cp.buttonPadding} · 圆角: ${cp.buttonRadius}</p>

<div class="btn-row" style="margin-top:12px">
  <button class="btn btn-success">成功按钮</button>
  <button class="btn btn-warning">警告按钮</button>
</div>

<h2>📝 输入框</h2>
<div class="input-row">
  <input type="text" placeholder="文本输入框" style="width:200px">
  <select><option>下拉选择</option></select>
</div>
<p style="font-size:12px;color:${c.textSecondary};margin-top:4px">高度: ${cp.inputHeight} · 圆角: ${cp.borderRadius}</p>

<h2>📐 圆角 & 阴影</h2>
<div class="radius-row">
  <div class="radius-box" style="border-radius:${cp.borderRadius}">${cp.borderRadius}</div>
  <div class="radius-box" style="border-radius:${cp.buttonRadius}">按钮<br>${cp.buttonRadius}</div>
</div>
<div class="card-example" style="margin-top:12px">
  <strong>卡片示例</strong>
  <p style="font-size:12px;color:${c.textSecondary};margin-top:4px">圆角: ${cp.borderRadius} · 阴影: ${cp.cardShadow} · 内边距: ${s.medium}</p>
</div>

<h2>📏 间距</h2>
<div class="spacing-example">
  <div class="spacing-block" style="width:${s.small};height:20px"></div>
  <div class="spacing-block" style="width:${s.base};height:20px"></div>
  <div class="spacing-block" style="width:${s.medium};height:20px"></div>
  <div class="spacing-block" style="width:${s.large};height:20px"></div>
</div>
<p style="font-size:12px;color:${c.textSecondary}">小${s.small} · 基础${s.base} · 中${s.medium} · 大${s.large}</p>

<h2>🔤 字体</h2>
<p style="font-family:${t.fontFamily}">字体: ${t.fontFamily}</p>
<p style="font-size:${t.headingSize};font-weight:600;margin-top:8px">标题字号: ${t.headingSize}</p>
<p style="font-size:${t.fontSize};margin-top:4px">正文字号: ${t.fontSize}</p>

<p class="subtitle" style="margin-top:32px;text-align:center">此文件由 SpecProt 自动生成 · 仅供产品团队参考 · 底层数据见 DESIGN_SYSTEM.yaml</p>
</body></html>`;
}

function colorSwatch(name: string, hex: string): string {
  return `<div class="swatch"><div class="swatch-color" style="background:${hex}"></div><div class="swatch-info"><div class="swatch-name">${name}</div><div class="swatch-value">${hex}</div></div></div>`;
}
