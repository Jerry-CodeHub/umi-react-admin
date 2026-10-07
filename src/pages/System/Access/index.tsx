import DemoPage from '@/components/DemoPage';
import UserAvatar from '@/components/UserAvatar';
import { AUTH_TOKEN_KEY } from '@/constants';
import { useApi } from '@/hooks/useApi';
import { useEnums } from '@/hooks/useEnums';
import { login } from '@/services/auth';
import { listDevices } from '@/services/ops';
import { CheckCircleFilled, LockFilled, SwapOutlined } from '@ant-design/icons';
import { Access, Link, useAccess, useIntl, useModel } from '@umijs/max';
import { Alert, Button, Card, Col, List, Row, Space, Table, Tag, Typography, theme } from 'antd';

/** 前端脱敏演示：坐标只保留一位小数（约 10 公里精度）。真实系统必须在服务端脱敏，这里只演示呈现效果 */
const maskCoord = (value: number) => `${value.toFixed(1)}***`;

const ADMIN_ROUTES = [
  { path: '/system/users', menu: 'menu.system.users' },
  { path: '/system/roles', menu: 'menu.system.roles' },
  { path: '/system/logs', menu: 'menu.system.logs' },
];

export default function AccessDemo() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  /** 文案里嵌一段代码（代码不翻译，也不写进文案：ICU 会把花括号 / 尖括号当语法解析） */
  const withCode = (id: string, code: string) =>
    intl.formatMessage({ id }, { code: <Typography.Text code>{code}</Typography.Text> });
  const enums = useEnums();
  const access = useAccess();
  const { token } = theme.useToken();
  const { initialState } = useModel('@@initialState');
  const isAdmin = access.canSeeAdmin;
  // 数据级：设备列表对所有身份开放，但精确坐标只有管理员可见
  const { data: sample } = useApi(() => listDevices({ pageSize: 5 }).then((page) => page.list));

  /** 切换身份：用另一个体验账号重新登录，整页刷新让路由、菜单、权限全部按新身份生效 */
  const switchIdentity = async () => {
    const { token: next } = await login({ name: isAdmin ? 'guest' : 'admin', password: 'demo' });
    localStorage.setItem(AUTH_TOKEN_KEY, next);
    window.location.reload();
  };

  const rows = (sample ?? []).map((device) => ({
    key: device.id,
    name: device.name,
    coords: isAdmin
      ? `${device.lng.toFixed(4)}, ${device.lat.toFixed(4)}`
      : `${maskCoord(device.lng)}, ${maskCoord(device.lat)}`,
  }));

  return (
    <DemoPage descriptionId="page.access.desc" source="src/pages/System/Access/index.tsx">
      <Space direction="vertical" size={16} className="w-full">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Space size={16}>
              <UserAvatar name={initialState?.nickName || initialState?.name || ''} size={44} />
              <div>
                <Tag color={isAdmin ? 'blue' : 'default'}>{enums.label('role', isAdmin ? 'admin' : 'viewer')}</Tag>
                <Typography.Text type="secondary">
                  {t(isAdmin ? 'access.identity.admin' : 'access.identity.user')}
                </Typography.Text>
              </div>
            </Space>
            <Button type="primary" icon={<SwapOutlined />} onClick={switchIdentity}>
              {t(isAdmin ? 'access.switchToGuest' : 'access.switchToAdmin')}
            </Button>
          </div>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card title={t('access.route.title')} className="h-full">
              <Typography.Paragraph type="secondary">
                {withCode('access.route.desc', "access: 'canSeeAdmin'")}
              </Typography.Paragraph>
              <List
                dataSource={ADMIN_ROUTES}
                renderItem={(route) => (
                  <List.Item
                    extra={
                      isAdmin ? (
                        <Tag icon={<CheckCircleFilled />} color="success">
                          {t('access.route.allowed')}
                        </Tag>
                      ) : (
                        <Tag icon={<LockFilled />}>{t('access.route.denied')}</Tag>
                      )
                    }
                  >
                    <Link to={route.path}>{t(route.menu)}</Link>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title={t('access.button.title')} className="h-full">
              <Typography.Paragraph type="secondary">
                {withCode('access.button.desc', '<Access accessible={…}>')}
              </Typography.Paragraph>
              <Space wrap>
                <Button>{t('access.button.export')}</Button>
                <Access accessible={isAdmin}>
                  <Button danger>{t('access.button.deleteUser')}</Button>
                </Access>
                <Access accessible={isAdmin} fallback={<Button disabled>{t('access.button.resetPassword')}</Button>}>
                  <Button>{t('access.button.resetPassword')}</Button>
                </Access>
              </Space>
              {!isAdmin && (
                <Typography.Paragraph type="secondary" className="mt-3 text-xs">
                  {t('access.button.deleteUser')} {t('access.button.hiddenHint')}
                </Typography.Paragraph>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title={t('access.data.title')} className="h-full">
              <Typography.Paragraph type="secondary">{t('access.data.desc')}</Typography.Paragraph>
              <Table
                size="small"
                pagination={false}
                dataSource={rows}
                columns={[
                  { title: t('screenshot.device'), dataIndex: 'name' },
                  {
                    title: t('access.data.coords'),
                    dataIndex: 'coords',
                    render: (value: string) => (
                      <Typography.Text code style={{ color: isAdmin ? undefined : token.colorTextTertiary }}>
                        {value}
                      </Typography.Text>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
        <Alert type="info" showIcon message={t('access.note')} />
      </Space>
    </DemoPage>
  );
}
