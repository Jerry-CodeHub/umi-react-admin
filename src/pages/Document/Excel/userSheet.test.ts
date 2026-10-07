import en from '@/locales/en-US';
import zh from '@/locales/zh-CN';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildUsersWorkbook, parseUsersWorkbook } from './userSheet';

const translator = (messages: Record<string, string>) => (id: string, values?: Record<string, string | number>) =>
  (messages[id] ?? id).replace(/\{(\w+)\}/g, (_, key: string) => String(values?.[key] ?? ''));
const tZh = translator(zh as Record<string, string>);
const tEn = translator(en as Record<string, string>);

describe('用户表导入导出', () => {
  it('英文界面导出的文件，在中文界面能完整导回（表头与枚举值双语识别）', () => {
    const workbook = buildUsersWorkbook(
      ExcelJS,
      [{ name: 'Test', username: 'test.user', email: 'test@example.com', department: 'ops2', role: 'lead' }],
      tEn,
      'Users',
    );
    const rows = parseUsersWorkbook(workbook, new Set(), tZh);
    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].input).toEqual({
      name: 'Test',
      username: 'test.user',
      email: 'test@example.com',
      department: 'ops2',
      role: 'lead',
    });
  });

  it('逐行校验：必填、邮箱、登录名格式、已存在、文件内重复、枚举取值', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('s');
    sheet.addRow(['姓名', '登录名', '邮箱', '部门', '角色']);
    sheet.addRow(['', 'ok.name', 'a@example.com', '运维一部', '访客']);
    sheet.addRow(['A', '1bad', 'not-an-email', '不存在的部门', 'admin']);
    sheet.addRow(['B', 'admin', 'b@example.com', 'ops1', 'viewer']);
    sheet.addRow(['C', 'dup.name', 'c@example.com', 'ops1', 'viewer']);
    sheet.addRow(['D', 'dup.name', 'd@example.com', 'ops1', 'viewer']);
    sheet.addRow(['', '', '', '', '']);
    const rows = parseUsersWorkbook(workbook, new Set(['admin']), tZh);
    expect(rows.map((r) => r.row)).toEqual([2, 3, 4, 5, 6]);
    expect(rows[0].errors).toEqual(['姓名必填']);
    expect(rows[1].errors).toEqual(['邮箱格式不正确', '登录名不合法', '部门取值无效']);
    expect(rows[2].errors).toEqual(['登录名已存在']);
    expect(rows[3].errors).toEqual(['登录名与文件中其它行重复']);
    expect(rows.every((r) => !r.input)).toBe(true);
  });
});
