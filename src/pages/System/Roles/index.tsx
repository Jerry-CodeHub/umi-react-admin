import DemoPage from '@/components/DemoPage';
import { PERMISSION_KEYS, PERMISSION_TREE, type PermissionNode } from '@/constants/permissions';
import { useApi } from '@/hooks/useApi';
import { useEnums } from '@/hooks/useEnums';
import { listRoles, resetRolePermissions, updateRolePermissions } from '@/services/system';
import type { Role, RoleKey } from '@/services/types';
import { fromNow } from '@/utils/format';
import { LockOutlined, TeamOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Alert, App, Button, Card, Col, List, Row, Skeleton, Space, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useEffect, useMemo, useState } from 'react';

export default function Roles() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const enums = useEnums();
  const { message } = App.useApp();
  const { data: roles, loading, reload } = useApi(listRoles);
  const [activeId, setActiveId] = useState<RoleKey>('lead');
  const [checked, setChecked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const active = roles?.find((role) => role.id === activeId);
  const locked = activeId === 'admin';

  useEffect(() => {
    if (active) setChecked(active.permissions);
  }, [active]);

  const treeData = useMemo<DataNode[]>(() => {
    const toNode = (node: PermissionNode): DataNode => ({
      key: node.key,
      title: t(`permission.${node.key}`),
      disabled: locked,
      children: node.children?.map(toNode),
    });
    return PERMISSION_TREE.map(toNode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intl, locked]);

  const dirty = active && [...checked].sort().join() !== [...active.permissions].sort().join();

  const save = async () => {
    setSaving(true);
    try {
      await updateRolePermissions(
        activeId,
        checked.filter((key) => PERMISSION_KEYS.includes(key)),
      );
      message.success(t('common.saved'));
      reload();
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    await resetRolePermissions(activeId);
    message.success(t('common.saved'));
    reload();
  };

  return (
    <DemoPage descriptionId="page.roles.desc" source="src/pages/System/Roles/index.tsx">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card styles={{ body: { padding: 8 } }}>
            <Skeleton active loading={loading && !roles} className="p-4">
              <List<Role>
                dataSource={roles}
                renderItem={(role) => (
                  <List.Item
                    onClick={() => setActiveId(role.id)}
                    className="cursor-pointer rounded-md px-4!"
                    style={{
                      background: role.id === activeId ? 'var(--ant-control-item-bg-active)' : undefined,
                    }}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          {enums.label('role', role.id)}
                          {role.id === 'admin' && <LockOutlined className="opacity-50" />}
                        </Space>
                      }
                      description={t(`role.${role.id}.desc`)}
                    />
                    <Typography.Text type="secondary" className="whitespace-nowrap text-xs">
                      <TeamOutlined /> {t('roles.members', { count: role.memberCount })}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            </Skeleton>
          </Card>
        </Col>
        <Col xs={24} lg={15}>
          <Card
            title={
              <Space>
                {t('roles.permissions')}
                {active && <Typography.Text type="secondary">{enums.label('role', active.id)}</Typography.Text>}
              </Space>
            }
            extra={
              active && (
                <Typography.Text type="secondary" className="text-xs">
                  {t('roles.updatedAt', { time: fromNow(active.updatedAt, intl.locale) })}
                </Typography.Text>
              )
            }
            actions={
              locked
                ? undefined
                : [
                    <Button key="restore" type="link" onClick={restore}>
                      {t('roles.restoreDefault')}
                    </Button>,
                    <Button key="save" type="primary" disabled={!dirty} loading={saving} onClick={save}>
                      {t('common.save')}
                    </Button>,
                  ]
            }
          >
            {locked && <Alert type="info" showIcon className="mb-4" message={t('roles.adminLocked')} />}
            <Skeleton active loading={!active}>
              <Typography.Paragraph type="secondary">
                {t('roles.selectedCount', {
                  count: checked.filter((key) => PERMISSION_KEYS.includes(key)).length,
                  total: PERMISSION_KEYS.length,
                })}
              </Typography.Paragraph>
              <Tree
                checkable
                defaultExpandAll
                selectable={false}
                treeData={treeData}
                checkedKeys={checked}
                onCheck={(keys) => setChecked((Array.isArray(keys) ? keys : keys.checked) as string[])}
              />
            </Skeleton>
          </Card>
        </Col>
      </Row>
    </DemoPage>
  );
}
