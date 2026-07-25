/**
 * Page Template Engine — 页面结构模板系统
 * 
 * 产品在 REQUIREMENT.md 中加注释选模板:
 *   <!-- template: search-list -->
 * 
 * 可用模板: search-list, form, dashboard, detail
 */
import { readFile, pathExists } from 'fs-extra';
import { join } from 'path';

const TEMPLATES_DIR = join(__dirname, '..', '..', 'templates');

export type TemplateName = 'search-list' | 'form' | 'dashboard' | 'detail' | 'auto';

/**
 * 从 Markdown 中检测页面模板
 */
export function detectTemplate(markdown: string): TemplateName {
  const match = markdown.match(/<!--\s*template:\s*(\S+)\s*-->/);
  if (match) return match[1] as TemplateName;
  return 'auto';
}

/**
 * 根据内容特征自动推断最合适的模板
 */
export function inferTemplate(section: { title: string; content: string }): TemplateName {
  const text = section.title + section.content;
  if (text.includes('仪表') || text.includes('首页') || text.includes('看板') || text.includes('统计')) return 'dashboard';
  if (text.includes('搜索') || text.includes('列表') || text.includes('查询')) return 'search-list';
  if (text.includes('详情') || text.includes('查看') || text.includes('信息')) return 'detail';
  if (text.includes('表') || text.includes('输入') || text.includes('字段')) return 'form';
  return 'search-list';
}

/**
 * 加载模板文件
 */
export async function loadTemplate(name: TemplateName, designSystem?: any): Promise<string> {
  const templateFile = join(TEMPLATES_DIR, `${name}.html`);
  if (!(await pathExists(templateFile))) {
    // 回退到内联默认模板
    return defaultTemplate(name);
  }
  const html = await readFile(templateFile, 'utf-8');
  return html;
}

/**
 * 填充模板占位符
 */
export function fillTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '—');
  }
  // 清理未填充的占位符
  result = result.replace(/\{\{\w+\}\}/g, '');
  return result;
}

/**
 * 从需求章节生成模板数据
 */
export function buildTemplateData(section: { title: string; fields: any[]; actions: any[]; rules: string[] }): Record<string, string> {
  const data: Record<string, string> = {
    PAGE_TITLE: section.title,
    CREATE_BUTTON: section.actions.find((a: any) => a.type === 'primary')?.label || '新建',
    TOTAL: '0',
    TABLE_HEADERS: section.fields.map((f: any) => `<th>${f.label}</th>`).join('') || '<th>名称</th><th>状态</th><th>时间</th>',
    TABLE_ROWS: '<tr><td colspan="10" style="text-align:center;color:var(--text-secondary)">暂无数据</td></tr>',
    FILTER_OPTIONS: '',
    FORM_FIELDS: section.fields.map((f: any) => {
      const required = f.required ? '<span class="required">*</span>' : '';
      let input = '';
      if (f.type === 'select') input = `<select>${(f.options || ['选项']).map((o: string) => `<option>${o}</option>`).join('')}</select>`;
      else if (f.type === 'date') input = '<input type="date" />';
      else if (f.type === 'textarea') input = '<textarea rows="3"></textarea>';
      else input = `<input type="text" placeholder="${f.placeholder || ''}" />`;
      return `<div class="form-group"><label>${f.label}${required}</label>${input}</div>`;
    }).join(''),
    DETAIL_FIELDS: section.fields.map((f: any) => 
      `<div style="font-weight:500;color:var(--text-secondary)">${f.label}</div><div>—</div>`
    ).join(''),
    STAT_CARDS: '<div class="card-example" style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--primary)">0</div><div style="font-size:13px;color:var(--text-secondary);margin-top:4px">总计</div></div>',
    LIST_TITLE: '列表',
    CHART_TITLE: '趋势',
  };
  return data;
}

function defaultTemplate(name: string): string {
  const templates: Record<string, string> = {
    'search-list': `<div class="page-card"><div class="page-title">{{PAGE_TITLE}}</div><div class="page-body"><div class="search-bar"><input type="text" placeholder="搜索..." /><button class="btn btn-default">搜索</button></div><table><thead>{{TABLE_HEADERS}}</thead><tbody>{{TABLE_ROWS}}</tbody></table></div></div>`,
    'form': `<div class="page-card"><div class="page-title">{{PAGE_TITLE}}</div><div class="page-body"><div class="form-grid">{{FORM_FIELDS}}</div><div class="actions"><button class="btn btn-primary">提交</button></div></div></div>`,
    'dashboard': `<div class="page-card"><div class="page-title">{{PAGE_TITLE}}</div><div class="page-body">{{STAT_CARDS}}<div class="card-example">{{CHART_TITLE}}</div></div></div>`,
    'detail': `<div class="page-card"><div class="page-title">{{PAGE_TITLE}}</div><div class="page-body">{{DETAIL_FIELDS}}<div class="actions"><button class="btn btn-default">返回</button></div></div></div>`,
  };
  return templates[name] || templates['search-list'];
}
