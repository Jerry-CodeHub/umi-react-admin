import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGACY_REDIRECTS, routes } from '../config/routes';

type Route = (typeof routes)[number];
const flatten = (list: Route[]): Route[] => list.flatMap((r) => [r, ...flatten(r.routes ?? [])]);
const all = flatten(routes);
const pages = all.filter((r) => r.component);
const pagePaths = new Set(pages.map((r) => r.path));

describe('路由表', () => {
  it('每个页面组件文件都存在', () => {
    const missing = pages.filter((r) => {
      const base = new URL(`../src/pages/${r.component!.replace(/^\.\//, '')}`, import.meta.url).pathname;
      return !['.tsx', '/index.tsx'].some((suffix) => existsSync(base + suffix));
    });
    expect(missing.map((r) => r.component)).toEqual([]);
  });

  it('路径不重复，且新路径统一为小写 kebab-case', () => {
    // 分组容器与其内部的默认重定向同路径是 umi 的约定写法，不算重复
    const paths = all.filter((r) => !r.routes).map((r) => r.path);
    expect(paths.filter((p, i) => paths.indexOf(p) !== i)).toEqual([]);
    const legacy = new Set(Object.keys(LEGACY_REDIRECTS));
    const offenders = paths.filter((p) => !legacy.has(p) && p !== '*' && !/^\/[a-z0-9/-]*$/.test(p));
    expect(offenders).toEqual([]);
  });

  it('旧路径全部重定向到存在的页面（外链与书签不失效）', () => {
    const broken = Object.entries(LEGACY_REDIRECTS).filter(([, target]) => !pagePaths.has(target));
    expect(broken).toEqual([]);
  });

  it('分组路径与根路径都重定向到存在的页面', () => {
    const redirects = all.filter((r) => r.redirect && !(r.path in LEGACY_REDIRECTS));
    expect(redirects.filter((r) => !pagePaths.has(r.redirect!))).toEqual([]);
  });

  it('菜单项都有 i18n 键（menu.<父级>.<name>）', async () => {
    const zh = (await import('../src/locales/zh-CN')).default as Record<string, string>;
    const en = (await import('../src/locales/en-US')).default as Record<string, string>;
    const keys: string[] = [];
    const walk = (list: Route[], prefix: string) =>
      list.forEach((r) => {
        if (!r.name || r.hideInMenu) return;
        const key = `${prefix}.${r.name}`;
        keys.push(key);
        walk(r.routes ?? [], key);
      });
    walk(routes, 'menu');
    expect(keys.filter((k) => !zh[k])).toEqual([]);
    expect(keys.filter((k) => !en[k])).toEqual([]);
  });
});
