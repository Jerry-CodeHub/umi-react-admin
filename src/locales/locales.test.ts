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

  it('文案里只有简单占位符，没有会被 ICU 当成语法的花括号 / 标签', () => {
    // react-intl 按 ICU MessageFormat 解析：`{a.b}`、`<Tag>` 会解析失败，界面回退成原文并报错。
    // 代码片段经 {code} 之类的占位符传入，不直接写进文案
    const broken = [zhCN, enUS].flatMap((messages) =>
      Object.entries(messages as Record<string, string>).filter(([, value]) => {
        const rest = value.replace(/\{\w+\}/g, '');
        return /[{}]/.test(rest) || /<\/?[A-Za-z]/.test(rest);
      }),
    );
    expect(broken).toEqual([]);
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
