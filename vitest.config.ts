import { defineConfig } from 'vitest/config';

/**
 * 素材策略单测需切换 process.cwd()（CLI 以 cwd 为期次定位锚点），
 * threads 池的 worker 线程禁 chdir → 用 forks 进程池。
 */
export default defineConfig({
  test: {
    pool: 'forks',
  },
});
