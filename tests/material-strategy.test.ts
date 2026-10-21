/**
 * 素材处理策略单测 — v0.5.x 自检修复项回归锚点
 *
 * 覆盖：readMaterialConfig 解析与回退 / listIterationPlatforms 并集
 *       collectMaterials 图片短路·截断标注·refined 强制与开关
 *       scanAndConvert 自定义端扫描·音视频模式·接力清单生命周期
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
// pdf-parse 顶层在 module.parent 为 undefined 时读 test/data 自测文件（vitest 转译环境必崩），
// 单测不涉 PDF 解析，统一拦截为稳定 stub
vi.mock('pdf-parse', () => ({ default: async () => ({ text: '' }) }));
import { mkdtemp, mkdir, writeFile, remove, pathExists } from 'fs-extra';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  readMaterialConfig,
  listIterationPlatforms,
  collectMaterials,
} from '../src/core/workspace-manager';
import { scanAndConvert } from '../src/core/material-converter';

const originalCwd = process.cwd();
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'specprot-test-'));
  process.chdir(root);
});

afterAll(() => {
  process.chdir(originalCwd);
});

/** 建一个带 README 平台行的期次骨架 */
async function makeIteration(name: string, platforms: string[]): Promise<void> {
  await mkdir(join(root, name), { recursive: true });
  const readme = `# ${name}\n\n> 平台: ${platforms.join(', ')}\n> 状态: 🔄 进行中\n`;
  await writeFile(join(root, name, 'README.md'), readme, 'utf-8');
}

describe('readMaterialConfig', () => {
  it('无配置 → 全默认（prompt/prompt/enabled）', async () => {
    await makeIteration('it-a', ['web']);
    const cfg = await readMaterialConfig('it-a');
    expect(cfg).toEqual({ audio: { mode: 'prompt' }, video: { mode: 'prompt' }, refine: { enabled: true } });
  });

  it('ai/local 模式解析生效', async () => {
    await makeIteration('it-b', ['web']);
    await writeFile(join(root, 'it-b', '.specprot.yml'), 'materials:\n  audio:\n    mode: ai\n  video:\n    mode: local\n', 'utf-8');
    const cfg = await readMaterialConfig('it-b');
    expect(cfg.audio.mode).toBe('ai');
    expect(cfg.video.mode).toBe('local');
  });

  it('非法值回退默认 + refine.enabled=false 生效', async () => {
    await makeIteration('it-c', ['web']);
    await writeFile(join(root, 'it-c', '.specprot.yml'), 'materials:\n  audio:\n    mode: bogus\n  refine:\n    enabled: false\n', 'utf-8');
    const cfg = await readMaterialConfig('it-c');
    expect(cfg.audio.mode).toBe('prompt');
    expect(cfg.refine.enabled).toBe(false);
  });

  it('损坏 yaml → 全默认', async () => {
    await makeIteration('it-d', ['web']);
    await writeFile(join(root, 'it-d', '.specprot.yml'), 'materials: [unclosed\n', 'utf-8');
    const cfg = await readMaterialConfig('it-d');
    expect(cfg.audio.mode).toBe('prompt');
  });
});

describe('listIterationPlatforms', () => {
  it('README 平台行 ∪ 素材区实际目录（并集去重，排除 shared/converted/_templates）', async () => {
    await makeIteration('it-e', ['admin-web']);
    await mkdir(join(root, 'it-e', '00-素材', 'admin-web'), { recursive: true });
    await mkdir(join(root, 'it-e', '00-素材', 'h5-mobile'), { recursive: true });
    await mkdir(join(root, 'it-e', '00-素材', 'shared'), { recursive: true });
    await mkdir(join(root, 'it-e', '00-素材', 'converted'), { recursive: true });
    await mkdir(join(root, 'it-e', '00-素材', '_templates'), { recursive: true });
    const list = await listIterationPlatforms('it-e');
    expect(list).toContain('admin-web');
    expect(list).toContain('h5-mobile');
    expect(list).not.toContain('shared');
    expect(list).not.toContain('converted');
    expect(list).not.toContain('_templates');
  });
});

describe('collectMaterials', () => {
  it('图片短路为占位符，不读二进制（防乱码污染 prompt）', async () => {
    await makeIteration('it-f', ['web']);
    const dir = join(root, 'it-f', '00-素材', 'web');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '原型图.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe, 0x00, 0x80]), 'binary');
    const ctx = await collectMaterials('it-f', 'web');
    const img = ctx.sources.find((s) => s.file.includes('原型图.png'));
    expect(img).toBeTruthy();
    expect(img!.content).toContain('图片素材');
    expect(img!.type).toBe('screenshot');
  });

  it('超长文本截断并标注', async () => {
    await makeIteration('it-g', ['web']);
    const dir = join(root, 'it-g', '00-素材', 'web');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '长文档.md'), 'x'.repeat(6000), 'utf-8');
    const ctx = await collectMaterials('it-g', 'web');
    const doc = ctx.sources.find((s) => s.file.includes('长文档.md'));
    expect(doc).toBeTruthy();
    expect(doc!.content).toContain('内容截断');
    expect(doc!.content).toContain('6000');
  });

  it('_refined 文件强制 refined 类型（文件名含「讨论」不被启发式覆盖）', async () => {
    await makeIteration('it-h', ['web']);
    const dir = join(root, 'it-h', '00-素材', 'converted', 'web', '_refined');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '会议讨论.md'), '# 干货\n', 'utf-8');
    const ctx = await collectMaterials('it-h', 'web');
    const refined = ctx.sources.filter((s) => s.type === 'refined');
    expect(refined).toHaveLength(1);
    expect(refined[0].file).toContain('_refined');
  });

  it('refine.enabled=false 时跳过 _refined（死配置复活为真开关）', async () => {
    await makeIteration('it-i', ['web']);
    await writeFile(join(root, 'it-i', '.specprot.yml'), 'materials:\n  refine:\n    enabled: false\n', 'utf-8');
    const dir = join(root, 'it-i', '00-素材', 'converted', 'web', '_refined');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '会议讨论.md'), '# 干货\n', 'utf-8');
    const ctx = await collectMaterials('it-i', 'web');
    expect(ctx.sources.filter((s) => s.type === 'refined')).toHaveLength(0);
  });
});

describe('scanAndConvert', () => {
  it('自定义端名（admin-web）素材被扫描（不依赖硬编码平台列表）', async () => {
    await makeIteration('it-j', ['admin-web']);
    const dir = join(root, 'it-j', '00-素材', 'admin-web');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '说明.md'), '原始素材', 'utf-8');
    const summary = await scanAndConvert('it-j');
    expect(summary.total).toBeGreaterThan(0);
  });

  it('prompt 模式音视频进 skipped；ai 模式进 pendingAI 并生成清单；素材清空后清单删除', async () => {
    await makeIteration('it-k', ['web']);
    const dir = join(root, 'it-k', '00-素材', 'web');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '评审录音.mp3'), 'FAKE', 'utf-8');

    let summary = await scanAndConvert('it-k');
    expect(summary.skipped.some((s) => s.includes('评审录音.mp3'))).toBe(true);

    await writeFile(join(root, 'it-k', '.specprot.yml'), 'materials:\n  audio:\n    mode: ai\n', 'utf-8');
    summary = await scanAndConvert('it-k');
    expect(summary.pendingAI).toHaveLength(1);
    expect(await pathExists(join(root, 'it-k', '00-素材', 'converted', '_pending-ai.md'))).toBe(true);

    await remove(join(dir, '评审录音.mp3'));
    await scanAndConvert('it-k');
    expect(await pathExists(join(root, 'it-k', '00-素材', 'converted', '_pending-ai.md'))).toBe(false);
  });

  it('frames/ 子目录关键帧收录进图片索引', async () => {
    await makeIteration('it-l', ['web']);
    const dir = join(root, 'it-l', '00-素材', 'web', 'frames');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'kf-001.png'), 'FAKE', 'utf-8');
    const summary = await scanAndConvert('it-l');
    expect(summary.images.some((i) => i.includes('frames/kf-001.png'))).toBe(true);
  });
});
