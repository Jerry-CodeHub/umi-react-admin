import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { App, Button, Upload } from 'antd';
import { useState } from 'react';

import { ExcelStyle } from './Excel.style';

type ExcelField = 'name' | 'nickName' | 'gender' | 'email';

interface ExcelRow extends Partial<Record<ExcelField, string>> {
  /** 表格行 key：名称可能重复，不能拿来当 rowKey */
  key: string;
  name: string;
}

const sampleRows: ExcelRow[] = [
  { key: 'sample-0', name: 'Umi', nickName: 'U', gender: 'MALE', email: 'umi@example.com' },
  { key: 'sample-1', name: 'Fish', nickName: 'B', gender: 'FEMALE', email: 'fish@example.com' },
];

const columns: ProColumns<ExcelRow>[] = [
  { title: '名称', dataIndex: 'name' },
  { title: '昵称', dataIndex: 'nickName' },
  {
    title: '性别',
    dataIndex: 'gender',
    valueEnum: { MALE: { text: '男' }, FEMALE: { text: '女' } },
  },
  { title: '邮箱', dataIndex: 'email' },
];

const headerMap: Record<string, ExcelField> = {
  名称: 'name',
  昵称: 'nickName',
  性别: 'gender',
  邮箱: 'email',
};

export default function Excel() {
  const [rows, setRows] = useState<ExcelRow[]>(sampleRows);
  // App 上下文中的 message：随主题算法（暗色）渲染，静态 message 无法消费动态主题
  const { message } = App.useApp();

  /** 导出：exceljs 生成 .xlsx（动态 import，路由级分包不进首屏） */
  const handleExport = async () => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('用户');
    sheet.columns = [
      { header: '名称', key: 'name', width: 20 },
      { header: '昵称', key: 'nickName', width: 20 },
      { header: '性别', key: 'gender', width: 12 },
      { header: '邮箱', key: 'email', width: 32 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach(({ key: _key, ...row }) => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'users.xlsx';
    // 挂到文档再点击、下一轮事件循环再释放 URL：部分浏览器在同步 revoke 时会中断下载
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    message.success('导出成功');
  };

  /** 导入：解析首个工作表，按表头映射回显 */
  const handleImport = async (file: File) => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch {
      message.error('文件解析失败，请确认是有效的 .xlsx 文件');
      return false;
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      message.warning('工作簿中没有工作表');
      return false;
    }

    // 读取表头行，建立列号 → 字段映射（顺序无关）。
    // 一律取 cell.text（单元格显示文本）：邮箱在 Excel 里常被自动转成超链接，富文本、公式单元格的
    // value 都是对象，String(value) 会得到 "[object Object]"
    const columnField = new Map<number, ExcelField>();
    sheet.getRow(1).eachCell((cell, colNumber) => {
      const field = headerMap[cell.text.trim()];
      if (field) {
        columnField.set(colNumber, field);
      }
    });

    const parsed: ExcelRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      const record: ExcelRow = { key: `row-${rowNumber}`, name: '' };
      columnField.forEach((field, colNumber) => {
        record[field] = row.getCell(colNumber).text.trim();
      });
      if (record.name) {
        parsed.push(record);
      }
    });

    setRows(parsed);
    message.success(`已导入 ${parsed.length} 行`);
    return false; // 阻止 Upload 默认上传行为
  };

  return (
    <ExcelStyle>
      <PageContainer header={{ title: 'Excel' }}>
        <ProCard className="shadow-2xl" headerBordered>
          <div className="mb-4 flex gap-3">
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出 .xlsx
            </Button>
            <Upload accept=".xlsx" beforeUpload={handleImport} showUploadList={false}>
              <Button icon={<UploadOutlined />}>导入 .xlsx</Button>
            </Upload>
          </div>
          <ProTable<ExcelRow>
            rowKey="key"
            search={false}
            toolBarRender={false}
            dataSource={rows}
            columns={columns}
            pagination={{ pageSize: 10 }}
          />
        </ProCard>
      </PageContainer>
    </ExcelStyle>
  );
}
