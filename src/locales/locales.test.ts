import { describe, expect, it } from 'vitest';
import enUS from './en-US';
import zhCN from './zh-CN';

describe('多语言文案', () => {
  it('中英文键集完全一致', () => {
    const zh = Object.keys(zhCN).sort();
    const en = Object.keys(enUS).sort();
    expect(en.filter((k) => !zh.includes(k))).toEqual([]);
    expect(zh.filter((k) => !en.includes(k))).toEqual([]);
  });

  it('英文文案里没有中文，也没有空值', () => {
    const offenders = Object.entries(enUS).filter(([, v]) => !v || /[一-龥]/.test(v));
    expect(offenders).toEqual([]);
  });

  it('占位符在两种语言里一致', () => {
    const vars = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const zh = zhCN as Record<string, string>;
    const mismatched = Object.entries(enUS as Record<string, string>).filter(
      ([key, value]) => vars(value).join() !== vars(zh[key] ?? '').join(),
    );
    expect(mismatched).toEqual([]);
  });
});
