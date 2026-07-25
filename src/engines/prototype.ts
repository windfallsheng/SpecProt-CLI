/**
 * Prototype Engine — 从需求描述生成可交互 HTML 原型
 * 
 * 输入：自然语言需求描述（Markdown）
 * 输出：独立的 HTML 文件（包含设计系统样式）
 */

import { readFile, writeFile } from 'fs-extra';
import { join } from 'path';

interface PageSection {
  title: string;
  fields: FieldDef[];
  actions: ActionDef[];
  rules: string[];
}

interface FieldDef {
  label: string;
  type: 'text' | 'select' | 'date' | 'datetime' | 'textarea' | 'number';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface ActionDef {
  label: string;
  type: 'primary' | 'danger' | 'default';
  position: 'top' | 'bottom' | 'inline';
}

interface PrototypeSpec {
  title: string;
  pages: PageSection[];
}

/**
 * 解析 REQUIREMENT.md，生成 PrototypeSpec
 * 当前版本：基于规则提取，后续接入 LLM
 */
export function parseRequirement(markdown: string): PrototypeSpec {
  const sections: PageSection[] = [];

  // 从 Markdown 提取页面结构
  const lines = markdown.split('\n');
  let currentSection: PageSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // 匹配二级标题 → 新页面
    if (trimmed.startsWith('## ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        title: trimmed.replace('## ', ''),
        fields: [],
        actions: [],
        rules: [],
      };
      continue;
    }

    if (!currentSection) continue;

    // 匹配字段定义：| 字段 | 类型 | 必填 | 说明 |
    if (trimmed.startsWith('|') && trimmed.includes('必填') === false) {
      const cols = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 3 && cols[0] !== '字段' && cols[0] !== '---') {
        const field: FieldDef = {
          label: cols[0],
          type: inferType(cols[1] || ''),
          required: cols[2] === '是' || cols[2] === 'Y',
          placeholder: cols[3] ? `请输入${cols[0]}` : undefined,
        };
        // 推断 select 选项
        if (field.type === 'select' && cols[3]) {
          field.options = cols[3].split(/[,;，；]/).map(o => o.trim());
        }
        currentSection.fields.push(field);
      }
    }

    // 匹配操作按钮：**操作**：新增、删除
    if (trimmed.includes('**操作**') || trimmed.includes('**按钮**')) {
      const actions = trimmed
        .replace(/^\*+操作\*+[：:]/, '')
        .replace(/^\*+按钮\*+[：:]/, '')
        .split(/[,;，；、]/)
        .map(a => a.trim())
        .filter(Boolean);
      currentSection.actions = actions.map(a => ({
        label: a,
        type: a.includes('删除') || a.includes('取消') ? 'danger' as const
          : a.includes('搜索') || a.includes('查询') ? 'default' as const
          : 'primary' as const,
        position: a.includes('搜索') ? 'top' as const : 'bottom' as const,
      }));
    }

    // 匹配业务规则：- 规则内容
    if (trimmed.startsWith('- ') && !trimmed.startsWith('- -')) {
      const rule = trimmed.replace('- ', '');
      if (!rule.startsWith('字段') && !rule.startsWith('类型')) {
        currentSection.rules.push(rule);
      }
    }
  }

  if (currentSection) sections.push(currentSection);

  return {
    title: extractTitle(markdown) || '未命名原型',
    pages: sections.length > 0 ? sections : defaultSections(),
  };
}

function inferType(typeStr: string): FieldDef['type'] {
  const t = typeStr.toLowerCase();
  if (t.includes('select') || t.includes('下拉') || t.includes('选择')) return 'select';
  if (t.includes('date') || t.includes('日期') || t.includes('时间')) return 'date';
  if (t.includes('text') || t.includes('文本') || t.includes('备注')) return 'textarea';
  if (t.includes('number') || t.includes('数字') || t.includes('整数')) return 'number';
  return 'text';
}

function extractTitle(markdown: string): string {
  const match = markdown.match(/^# (.+)$/m);
  return match ? match[1] : '';
}

function defaultSections(): PageSection[] {
  return [{
    title: '默认页面',
    fields: [
      { label: '名称', type: 'text', required: true, placeholder: '请输入' },
    ],
    actions: [
      { label: '提交', type: 'primary', position: 'bottom' },
    ],
    rules: ['所有字段必填'],
  }];
}

/**
 * 根据 PrototypeSpec 生成 HTML
 */
export function renderHTML(spec: PrototypeSpec, designSystem?: any): string {
  // 应用设计系统颜色（如果有）
  const ds = designSystem || {};
  const primary = ds.colors?.primary || '#1677ff';
  const danger = ds.colors?.danger || '#ff4d4f';
  const bg = ds.colors?.background || '#f5f5f5';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.title} — SpecProt 原型</title>
  <style>
    :root {
      --primary: ${primary};
      --danger: ${danger};
      --bg: ${bg};
      --card-bg: #fff;
      --text: #333;
      --text-secondary: #666;
      --border: #e8e8e8;
      --radius: 8px;
      --shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    .header { background: var(--primary); color: #fff; padding: 16px 24px; font-size: 18px; font-weight: 600; }
    .header .subtitle { font-size: 12px; opacity: 0.8; margin-top: 4px; }
    .container { max-width: 960px; margin: 24px auto; padding: 0 16px; }
    .page-card { background: var(--card-bg); border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 20px; overflow: hidden; }
    .page-title { padding: 16px 24px; font-size: 16px; font-weight: 600; border-bottom: 1px solid var(--border); background: #fafafa; }
    .page-body { padding: 24px; }
    .search-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .search-bar input, .search-bar select { flex: 1; min-width: 120px; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
    .form-group label .required { color: var(--danger); margin-left: 2px; }
    input, select, textarea {
      padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;
      font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.2s;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(22,119,255,0.1); }
    textarea { resize: vertical; min-height: 80px; }
    .actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); flex-wrap: wrap; }
    .btn { padding: 8px 20px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; cursor: pointer; transition: all 0.2s; font-family: inherit; }
    .btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
    .btn-primary:hover { background: #4096ff; }
    .btn-danger { background: #fff; color: var(--danger); border-color: var(--danger); }
    .btn-danger:hover { background: #fff1f0; }
    .btn-default { background: #fff; color: var(--text); }
    .btn-default:hover { border-color: var(--primary); color: var(--primary); }
    .rules { margin-top: 16px; padding: 12px 16px; background: #fffbe6; border-radius: 6px; border-left: 3px solid #faad14; }
    .rules h4 { font-size: 12px; color: #d48806; margin-bottom: 6px; text-transform: uppercase; }
    .rules ul { list-style: none; font-size: 13px; color: var(--text-secondary); }
    .rules ul li::before { content: "• "; color: #faad14; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; }
    th { background: #fafafa; font-weight: 600; color: var(--text-secondary); }
    tr:hover td { background: #e6f4ff; }
    .action-inline { display: inline-flex; gap: 6px; }
    .action-inline .btn { padding: 4px 12px; font-size: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
    .badge-required { background: #fff1f0; color: var(--danger); }
    .badge-select { background: #e6f4ff; color: var(--primary); }
    .badge-input { background: #f0f0f0; color: var(--text-secondary); }
    .footer-bar { text-align: center; padding: 12px; font-size: 12px; color: #999; margin-top: 16px; }
    .footer-bar a { color: var(--primary); text-decoration: none; }
  </style>
</head>
<body>
  <div class="header">
    ${spec.title}
    <div class="subtitle">SpecProt 自动生成 · ${new Date().toLocaleDateString('zh-CN')}</div>
  </div>

  <div class="container">
    ${spec.pages.map(page => renderPage(page)).join('\n')}
  </div>

  <div class="footer-bar">
    此原型由 <a href="#">SpecProt</a> 自动生成 · 仅供产品评审使用 · 非生产代码
  </div>
</body>
</html>`;
}

function renderPage(page: PageSection): string {
  const hasSearch = page.actions.some(a => a.position === 'top');

  return `
  <div class="page-card">
    <div class="page-title">${page.title}</div>
    <div class="page-body">
      ${hasSearch ? renderSearchBar(page) : ''}
      ${page.fields.length > 0 ? renderForm(page.fields) : ''}
      ${page.actions.length > 0 ? renderActions(page.actions.filter(a => a.position !== 'top')) : ''}
      ${page.rules.length > 0 ? renderRules(page.rules) : ''}
    </div>
  </div>`;
}

function renderSearchBar(page: PageSection): string {
  const searchActions = page.actions.filter(a => a.position === 'top');
  return `
  <div class="search-bar">
    <input type="text" placeholder="搜索${page.title || ''}..." />
    <select><option>全部</option></select>
    ${searchActions.map(a => `<button class="btn btn-default" onclick="return false">${a.label}</button>`).join('')}
  </div>`;
}

function renderForm(fields: FieldDef[]): string {
  return `
  <div class="form-grid">
    ${fields.map(f => `
    <div class="form-group">
      <label>${f.label}${f.required ? '<span class="required">*</span>' : ''}</label>
      ${renderField(f)}
    </div>`).join('\n')}
  </div>`;
}

function renderField(field: FieldDef): string {
  switch (field.type) {
    case 'select':
      return `<select>${(field.options || ['选项一', '选项二']).map(o => `<option>${o}</option>`).join('')}</select>`;
    case 'date':
      return '<input type="date" />';
    case 'datetime':
      return '<input type="datetime-local" />';
    case 'textarea':
      return `<textarea placeholder="${field.placeholder || ''}"></textarea>`;
    case 'number':
      return `<input type="number" placeholder="${field.placeholder || ''}" />`;
    default:
      return `<input type="text" placeholder="${field.placeholder || ''}" />`;
  }
}

function renderActions(actions: ActionDef[]): string {
  const bottomActions = actions.filter(a => a.position !== 'top');
  if (bottomActions.length === 0) {
    const inlineActions = actions.filter(a => a.position === 'inline');
    return inlineActions.length > 0
      ? `<div class="action-inline">${inlineActions.map(a => `<button class="btn btn-${a.type}" onclick="return false">${a.label}</button>`).join('')}</div>`
      : '';
  }
  return `
  <div class="actions">
    ${bottomActions.map(a => `<button class="btn btn-${a.type}" onclick="return false">${a.label}</button>`).join('\n')}
  </div>`;
}

function renderRules(rules: string[]): string {
  return `
  <div class="rules">
    <h4>⚠ 业务规则</h4>
    <ul>
      ${rules.map(r => `<li>${r}</li>`).join('\n')}
    </ul>
  </div>`;
}
