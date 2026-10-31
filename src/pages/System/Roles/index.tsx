import DemoPage from '@/components/DemoPage';
import { PERMISSION_KEYS, PERMISSION_TREE, type PermissionNode } from '@/constants/permissions';
import { useApi } from '@/hooks/useApi';
import { useEnums } from '@/hooks/useEnums';
import { listRoles, resetRolePermissions, updateRolePermissions } from '@/services/system';
import type { Role, RoleKey } from '@/services/types';
import { fromNow } from '@/utils/format';
import { LockOutlined, TeamOutlined } from '@ant-design/icons';
import { useAccess, useIntl, useModel } from '@umijs/max';
import { Alert, App, Button, Card, Col, Listy, Row, Skeleton, Space, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function Roles() {
  const intl = useIntl();
  // useCallback 包一层：treeData 的 useMemo 依赖它，行内函数每次渲染都是新引用会让 memo 失效
  const t = useCallback(
    (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values),
    [intl],
  );
  const enums = useEnums();
  const { message } = App.useApp();
  const { data: roles, loading, reload } = useApi(listRoles);
  const [activeId, setActiveId] = useState<RoleKey>('lead');
  const [checked, setChecked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const active = roles?.find((role) => role.id === activeId);
  const access = useAccess();
  const { initialState } = useModel('@@initialState');
  /**
   * 与服务端同一口径（routes.ts guardRolePermissionWrite）：admin 锁定为全量；
   * 自己所在的角色不能改也不能 reset；只能授予自己持有的权限点（原本就有的可以保留或收回）。
   */
  const ownRole = !!initialState?.roleKey && initialState.roleKey === activeId;
  const locked = activeId === 'admin' || ownRole;
  const grantable = useCallback(
    (key: string) => access.permission(key) || !!active?.permissions.includes(key),
    [access, active],
  );
  const grantLimited = !locked && PERMISSION_KEYS.some((key) => !grantable(key));

  useEffect(() => {
    if (active) setChecked(active.permissions);
  }, [active]);

  const treeData = useMemo<DataNode[]>(() => {
    const toNode = (node: PermissionNode): DataNode => ({
      key: node.key,
      title: t(`permission.${node.key}`),
      disabled: locked,
      // 叶子权限点：调用者自己没有、目标角色也没有的不能勾选（服务端会以 403 拒绝这次授予）
      disableCheckbox: !node.children && !grantable(node.key),
      children: node.children?.map(toNode),
    });
    return PERMISSION_TREE.map(toNode);
  }, [t, locked, grantable]);

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

  // 恢复默认与保存共用 saving 态：无防连点时双击会并发触发两次重置，失败也会留下未处理的 rejection
  const restore = async () => {
    setSaving(true);
    try {
      await resetRolePermissions(activeId);
      message.success(t('common.saved'));
      reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <DemoPage descriptionId="page.roles.desc" source="src/pages/System/Roles/index.tsx">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card styles={{ body: { padding: 8 } }}>
            <Skeleton active loading={loading && !roles} className="p-4">
              <Listy<Role>
                items={roles ?? []}
                rowKey="id"
                styles={{ item: { padding: 0 } }}
                itemRender={(role) => (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={role.id === activeId}
                    onClick={() => setActiveId(role.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setActiveId(role.id);
                      }
                    }}
                    className="cursor-pointer rounded-md px-4 py-3"
                    style={{
                      background: role.id === activeId ? 'var(--ant-control-item-bg-active)' : undefined,
                    }}
                  >
                    {/* 成员数放在标题行右侧：说明文字独占整行，窄屏上不会被挤成两栏交错 */}
                    <div className="flex items-center justify-between gap-2">
                      <Space>
                        {enums.label('role', role.id)}
                        {role.id === 'admin' && <LockOutlined className="opacity-50" />}
                      </Space>
                      <Typography.Text type="secondary" className="whitespace-nowrap text-xs font-normal">
                        <TeamOutlined /> {t('roles.members', { count: role.memberCount })}
                      </Typography.Text>
                    </div>
                    <Typography.Text type="secondary" className="mt-0.5 block">
                      {t(`role.${role.id}.desc`)}
                    </Typography.Text>
                  </div>
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
                    <Button key="restore" type="link" loading={saving} onClick={restore}>
                      {t('roles.restoreDefault')}
                    </Button>,
                    <Button key="save" type="primary" disabled={!dirty} loading={saving} onClick={save}>
                      {t('common.save')}
                    </Button>,
                  ]
            }
          >
            {locked && (
              <Alert
                type="info"
                showIcon
                className="mb-4"
                title={t(activeId === 'admin' ? 'roles.adminLocked' : 'roles.selfLocked')}
              />
            )}
            {grantLimited && <Typography.Paragraph type="secondary">{t('roles.grantLimitHint')}</Typography.Paragraph>}
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
