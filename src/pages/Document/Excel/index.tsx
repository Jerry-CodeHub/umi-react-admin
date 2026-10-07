import DemoPage from '@/components/DemoPage';
import type { User } from '@/services/types';
import { createUser, listUsers } from '@/services/users';
import { DownloadOutlined, FileExcelOutlined, InboxOutlined } from '@ant-design/icons';
import { Link, useIntl } from '@umijs/max';
import { Alert, App, Button, Card, Space, Spin, Table, Tag, Typography, Upload } from 'antd';
import { useState } from 'react';
import { FIELDS, buildUsersWorkbook, downloadWorkbook, parseUsersWorkbook, type ParsedRow } from './userSheet';

/** exceljs 体积较大，只在点击导入 / 导出时加载 */
const loadExcel = () => import('exceljs');

const fetchAllUsers = async () => (await listUsers({ pageSize: 200 })).list;

const TEMPLATE_ROWS: Pick<User, (typeof FIELDS)[number]>[] = [
  { name: 'Sample A', username: 'sample.a', email: 'sample.a@example.com', department: 'ops1', role: 'operator' },
  { name: 'Sample B', username: 'sample.b', email: 'sample.b@example.com', department: 'analytics', role: 'analyst' },
];

export default function Excel() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const [busy, setBusy] = useState<'export' | 'import' | 'save'>();
  const [rows, setRows] = useState<ParsedRow[]>();

  const handleExport = async () => {
    setBusy('export');
    try {
      const [ExcelJS, users] = await Promise.all([loadExcel(), fetchAllUsers()]);
      await downloadWorkbook(buildUsersWorkbook(ExcelJS, users, t, t('excel.exportTitle')), 'users.xlsx');
      message.success(t('excel.exported', { count: users.length }));
    } finally {
      setBusy(undefined);
    }
  };

  const handleTemplate = async () => {
    const ExcelJS = await loadExcel();
    await downloadWorkbook(
      buildUsersWorkbook(ExcelJS, TEMPLATE_ROWS, t, t('excel.exportTitle')),
      'users-template.xlsx',
    );
  };

  const handleImport = async (file: File) => {
    setBusy('import');
    try {
      const [ExcelJS, users] = await Promise.all([loadExcel(), fetchAllUsers()]);
      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.load(await file.arrayBuffer());
      } catch {
        message.error(t('excel.parseFailed'));
        return false;
      }
      if (!workbook.worksheets[0]) {
        message.warning(t('excel.noSheet'));
        return false;
      }
      setRows(parseUsersWorkbook(workbook, new Set(users.map((u) => u.username.toLowerCase())), t));
    } finally {
      setBusy(undefined);
    }
    return false; // 阻止 Upload 默认上传行为
  };

  const valid = rows?.filter((row) => row.input) ?? [];

  const handleSave = async () => {
    setBusy('save');
    try {
      for (const row of valid) {
        await createUser(row.input!);
      }
      message.success(t('excel.imported', { count: valid.length }));
      setRows(undefined);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <DemoPage
      descriptionId="page.excel.desc"
      source="src/pages/Document/Excel/userSheet.ts"
      extra={
        <>
          <Button icon={<DownloadOutlined />} loading={busy === 'export'} onClick={handleExport}>
            {t('excel.export')}
          </Button>
          <Button icon={<FileExcelOutlined />} onClick={handleTemplate}>
            {t('excel.template')}
          </Button>
        </>
      }
    >
      {!rows ? (
        // 空状态即导入入口：拖拽区本身就是主操作，并说明需要哪些列
        <Card>
          <Spin spinning={busy === 'import'}>
            <Upload.Dragger accept=".xlsx" beforeUpload={handleImport} showUploadList={false}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">{t('excel.dropTitle')}</p>
              <p className="ant-upload-hint mx-auto max-w-xl px-4">
                {t('excel.dropHint', { fields: FIELDS.map((field) => t(`users.column.${field}`)).join(' / ') })}
              </p>
            </Upload.Dragger>
          </Spin>
        </Card>
      ) : (
        <Card
          title={t('excel.previewTitle')}
          extra={
            <Button type="primary" disabled={!valid.length} loading={busy === 'save'} onClick={handleSave}>
              {t('excel.importValid', { count: valid.length })}
            </Button>
          }
        >
          <Alert
            className="mb-4"
            showIcon
            type={valid.length === rows.length ? 'success' : 'warning'}
            message={t('excel.summary', {
              total: rows.length,
              valid: valid.length,
              invalid: rows.length - valid.length,
            })}
            action={<Link to="/system/users">{t('menu.system.users')}</Link>}
          />
          <Table<ParsedRow>
            rowKey="key"
            size="small"
            scroll={{ x: 900 }}
            pagination={{ pageSize: 10 }}
            dataSource={rows}
            columns={[
              { title: t('excel.column.row'), dataIndex: 'row', width: 70 },
              ...FIELDS.map((field) => ({
                title: t(`users.column.${field}`),
                key: field,
                render: (_: unknown, row: ParsedRow) =>
                  row.values[field] || <Typography.Text type="secondary">—</Typography.Text>,
              })),
              {
                title: t('excel.column.check'),
                key: 'check',
                width: 260,
                render: (_: unknown, row: ParsedRow) =>
                  row.errors.length ? (
                    <Space size={[4, 4]} wrap>
                      {row.errors.map((error) => (
                        <Tag key={error} color="red">
                          {error}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <Tag color="green">{t('excel.valid')}</Tag>
                  ),
              },
            ]}
          />
        </Card>
      )}
    </DemoPage>
  );
}
