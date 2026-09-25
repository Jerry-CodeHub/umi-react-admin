import { describe, expect, it } from 'vitest';
import { claimAutoReload, isChunkLoadError } from './chunkError';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

describe('isChunkLoadError', () => {
  it('识别 webpack ChunkLoadError 与原生动态 import 失败', () => {
    const webpack = Object.assign(new Error('Loading chunk 123 failed.\n(error: /p__Home.js)'), {
      name: 'ChunkLoadError',
    });
    expect(isChunkLoadError(webpack)).toBe(true);
    expect(isChunkLoadError(new Error('Loading CSS chunk p__Home failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
  });

  it('普通运行时错误不算', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(isChunkLoadError('Loading chunk 1 failed')).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('claimAutoReload', () => {
  it('时间窗内只允许自动刷新一次，过窗后可再次刷新', () => {
    const storage = memoryStorage();
    expect(claimAutoReload(storage, 1_000_000)).toBe(true);
    expect(claimAutoReload(storage, 1_030_000)).toBe(false);
    expect(claimAutoReload(storage, 1_061_000)).toBe(true);
  });

  it('存储不可用时不自动刷新', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
    };
    expect(claimAutoReload(broken)).toBe(false);
  });
});
