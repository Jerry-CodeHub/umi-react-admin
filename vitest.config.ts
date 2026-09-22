import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    // 不收录 mock/：umi 会把 mock 目录下的所有 ts/js 当 mock 加载，测试文件不能放那里（见 config/mock.ts）
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // 覆盖率只对已测域设阈，随覆盖面扩大逐步扩 include（阶段6起步集）
      include: [
        'src/utils/MapCompute/geoHash.ts',
        'src/utils/Auth/userInfo.ts',
        'src/utils/BizError.ts',
        'src/utils/requestConfig.ts',
        'src/services/demo/userQuery.ts',
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});
