import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCsp } from '../config/csp';

const root = new URL('..', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), 'utf8');

/**
 * 三条产线的 CSP 必须同源（config/csp.ts）。2026-09-22 的安全头 PR 在三处手写同一份清单，
 * 漏了 media-src blob:，音频可视页在 GitHub Pages 与 Vercel 上无法播放——这里把漂移挡在 CI。
 */
describe('CSP 三产线一致性', () => {
  it('vercel.json 的 CSP 响应头与 config/csp.ts 一致', () => {
    const vercel = JSON.parse(read('vercel.json')) as {
      headers: { headers: { key: string; value: string }[] }[];
    };
    const csp = vercel.headers
      .flatMap((rule) => rule.headers)
      .find((header) => header.key === 'Content-Security-Policy')?.value;
    expect(csp).toBe(buildCsp());
  });

  it('nginx/security-headers.conf 的 CSP 与 config/csp.ts 一致', () => {
    const matched = /add_header Content-Security-Policy(?:-Report-Only)? "([^"]+)"/.exec(
      read('nginx/security-headers.conf'),
    );
    expect(matched?.[1]).toBe(buildCsp());
  });

  it('meta 版剔除浏览器不支持的 frame-ancestors', () => {
    expect(buildCsp({ meta: true })).not.toContain('frame-ancestors');
    expect(buildCsp()).toContain("frame-ancestors 'self'");
  });
});
