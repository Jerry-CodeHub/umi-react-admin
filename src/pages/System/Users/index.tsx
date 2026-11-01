import DemoPage from '@/components/DemoPage';
import UserAvatar from '@/components/UserAvatar';
import { DEPARTMENT_KEYS, USER_STATUS_KEYS } from '@/constants/enums';
import { canManageAccount, ROLE_KEYS } from '@/constants/permissions';
import { useEnums } from '@/hooks/useEnums';
import { useResponsiveTable } from '@/hooks/useResponsiveTable';
import type { User, UserBatchAction, UserCreateInput } from '@/services/types';
import { assignUserRole, batchUsers, createUser, deleteUser, listUsers, updateUser } from '@/services/users';
import { formatDateTime, fromNow } from '@/utils/format';
import { DownOutlined, LockOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { history, useIntl, useModel } from '@umijs/max';
import { App, Button, Dropdown, Grid, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import TableMeasureRowContext from 'antd/es/table/TableMeasureRowContext';
import { cloneElement, isValidElement, useContext, useRef, useState, type ReactElement, type ReactNode } from 'react';
import UserDrawer from './UserDrawer';
import UserForm from './UserForm';

const PROTECTED = new Set(['admin', 'guest']);

/**
 * 无障碍（Q5）：rc-table 的「测量行」会把每列的 title 克隆一份量宽，而 rowSelection 的选择列 title 是
 * antd 的「全选」复选框，于是 `<tr aria-hidden="true" class="ant-table-measure-row">` 里出现可 Tab 聚焦的
 * `<input type="checkbox">`（axe aria-hidden-focus，serious）。antd 6 在测量行里提供
 * TableMeasureRowContext（外部为 false），据此只在测量行内把复选框置为 disabled：disabled 元素不参与
 * Tab 序列，盒子尺寸不变（列宽测量与对齐不受影响），表头里的全选复选框仍是可交互的原件。
 */
const MeasureRowSafeTitle = ({ children }: { children: ReactNode }) => {
  const inMeasureRow = useContext(TableMeasureRowContext);
  if (!inMeasureRow || !isValidElement(children)) return <>{children}</>;
  return <>{cloneElement(children as ReactElement<{ disabled?: boolean }>, { disabled: true })}</>;
};

export default function Users() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const enums = useEnums();
  const { message, modal } = App.useApp();
  const { initialState } = useModel('@@initialState');
  /**
   * admin / lead 账号只由管理员角色维护（canManageAccount，与演示后端同一个函数）：
   * 委派角色看到这些行时编辑 / 停用 / 启用 / 删除置灰、不能勾选进批量，避免走完确认框才被 403。
   */
  const manageable = (user: User) => canManageAccount(initialState, user);
  const actionRef = useRef<ActionType>(undefined);
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const [viewing, setViewing] = useState<User>();
  const table = useResponsiveTable();
  // 手机上只留「用户 + 状态 + 操作」三列（审计 U02：其余字段靠详情抽屉看，操作不再要横滚去找）
  const { md } = Grid.useBreakpoint();

  const reload = () => actionRef.current?.reload();

  const toggleStatus = async (user: User) => {
    await updateUser(user.id, { status: user.status === 'active' ? 'disabled' : 'active' });
    message.success(t('common.saved'));
    reload();
  };

  // 批量启用/停用按钮直接挂 onClick（antd 丢弃返回的 promise）：失败必须就地 catch（modal.confirm
  // 的删除路径由 onOk 的加载契约兜底，无需处理）
  const runBatch = async (ids: string[], action: UserBatchAction, clear: () => void) => {
    try {
      const count = await batchUsers(ids, action);
      message.success(t('users.batchDone', { count }));
      clear();
      reload();
    } catch {
      // 错误提示由请求层统一弹出
    }
  };

  const columns: ProColumns<User>[] = [
    {
      title: t('users.keyword'),
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: t('users.keywordPlaceholder') },
    },
    {
      title: t('users.column.user'),
      dataIndex: 'name',
      search: false,
      width: 220,
      // 点姓名/邮箱看字段摘要（详情抽屉）：与设备页一致的链接样式，手机上这是主要入口
      render: (_, user) => (
        <Typography.Link onClick={() => setViewing(user)}>
          <UserAvatar name={user.name} description={user.email} />
        </Typography.Link>
      ),
    },
    { title: t('users.column.id'), dataIndex: 'id', search: false, width: 90, sorter: true, responsive: ['md'] },
    {
      title: t('users.column.department'),
      dataIndex: 'department',
      valueEnum: enums.valueEnum('department', DEPARTMENT_KEYS),
      width: 130,
      responsive: ['md'],
    },
    {
      title: t('users.column.role'),
      dataIndex: 'role',
      valueEnum: enums.valueEnum('role', ROLE_KEYS),
      width: 120,
      responsive: ['md'],
      render: (_, user) => (
        <Space size={4}>
          <Tag color={user.role === 'admin' ? 'blue' : undefined}>{enums.label('role', user.role)}</Tag>
          {!manageable(user) && (
            <Tooltip title={t('users.accountScopeHint')}>
              <LockOutlined aria-label={t('users.accountScopeHint')} className="opacity-60" />
            </Tooltip>
          )}
        </Space>
      ),
    },
    { title: t('users.column.phone'), dataIndex: 'phone', search: false, width: 130, responsive: ['xxl'] },
    {
      title: t('users.column.status'),
      dataIndex: 'status',
      width: 100,
      valueEnum: enums.valueEnum('userStatus', USER_STATUS_KEYS, (key) => ({
        status: { active: 'Success', disabled: 'Default', locked: 'Error' }[key],
      })),
    },
    {
      title: t('users.column.lastLogin'),
      dataIndex: 'lastLoginAt',
      search: false,
      sorter: true,
      width: 130,
      responsive: ['md'],
      render: (_, user) =>
        user.lastLoginAt ? (
          <Tooltip title={formatDateTime(user.lastLoginAt)}>{fromNow(user.lastLoginAt, intl.locale)}</Tooltip>
        ) : (
          t('common.none')
        ),
    },
    {
      title: t('users.column.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      sorter: true,
      width: 120,
      responsive: ['xxl'],
      render: (_, user) => formatDateTime(user.createdAt, 'YYYY-MM-DD'),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      // 英文「Edit / Disable / Delete」比中文宽，按英文留足，避免最后一个按钮被截断；
      // 手机上收成一个「···」菜单（md 以下），不用横向滚动去找操作列
      width: md ? 210 : 56,
      fixed: table.fixedRight,
      render: (_, user) => {
        // scopeLocked：调用者无权维护这一行（admin / lead 账号且自己不是管理员角色），连编辑与启用一起置灰
        const scopeLocked = !manageable(user);
        const locked = scopeLocked || PROTECTED.has(user.username);
        if (!md) {
          return [
            <Dropdown
              key="more"
              trigger={['click']}
              menu={{
                items: [
                  { key: 'edit', label: t('common.edit'), disabled: scopeLocked },
                  user.status === 'active'
                    ? { key: 'toggle', label: t('common.disable'), disabled: locked }
                    : { key: 'toggle', label: t('common.enable'), disabled: scopeLocked },
                  { key: 'delete', label: t('common.delete'), danger: true, disabled: locked },
                ],
                // 手机菜单里没有 Popconfirm 的落点，停用 / 删除改用 modal.confirm（与批量操作一致）
                onClick: ({ key }) => {
                  if (key === 'edit') {
                    setEditing(user);
                  } else if (key === 'toggle') {
                    if (user.status !== 'active') toggleStatus(user);
                    else
                      modal.confirm({
                        title: t('users.disableConfirm', { name: user.name }),
                        onOk: () => toggleStatus(user),
                      });
                  } else if (key === 'delete') {
                    modal.confirm({
                      title: t('users.deleteConfirm', { name: user.name }),
                      okButtonProps: { danger: true },
                      onOk: async () => {
                        await deleteUser(user.id);
                        message.success(t('common.deleted'));
                        reload();
                      },
                    });
                  }
                },
              }}
            >
              <Button type="text" size="small" icon={<MoreOutlined />} aria-label={t('common.actions')} />
            </Dropdown>,
          ];
        }
        return [
          <Button key="edit" type="link" size="small" disabled={scopeLocked} onClick={() => setEditing(user)}>
            {t('common.edit')}
          </Button>,
          user.status === 'active' ? (
            <Popconfirm
              key="toggle"
              title={t('users.disableConfirm', { name: user.name })}
              disabled={locked}
              onConfirm={() => toggleStatus(user)}
            >
              <Button type="link" size="small" disabled={locked}>
                {t('common.disable')}
              </Button>
            </Popconfirm>
          ) : (
            <Button key="toggle" type="link" size="small" disabled={scopeLocked} onClick={() => toggleStatus(user)}>
              {t('common.enable')}
            </Button>
          ),
          <Popconfirm
            key="delete"
            title={t('users.deleteConfirm', { name: user.name })}
            disabled={locked}
            onConfirm={async () => {
              await deleteUser(user.id);
              message.success(t('common.deleted'));
              reload();
            }}
          >
            <Button type="link" size="small" danger disabled={locked}>
              {t('common.delete')}
            </Button>
          </Popconfirm>,
        ];
      },
    },
  ];

  /**
   * 提交分两步（审查 F1）：资料走 updateUser（载荷里没有 role），
   * 角色只在真的变化时走 assignUserRole——那是需要 system.user.role.assign 的独立入口。
   * 新建时角色随创建载荷提交（服务端同样要求该权限）。
   */
  const handleSubmit = async (values: UserCreateInput) => {
    const { role, ...profile } = values;
    if (editing) {
      await updateUser(editing.id, profile);
      if (role && role !== editing.role) await assignUserRole(editing.id, role);
    } else {
      await createUser(values);
    }
    message.success(t('common.saved'));
    setEditing(undefined);
    reload();
  };

  return (
    <DemoPage descriptionId="page.users.desc" source="src/pages/System/Users/index.tsx">
      <ProTable<User>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        scroll={table.scroll}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 10, showSizeChanger: true }}
        rowSelection={{
          columnTitle: (checkbox) => <MeasureRowSafeTitle>{checkbox}</MeasureRowSafeTitle>,
          // 批量接口对混入的 admin / lead 账号整批 403：无权维护的行不进入勾选
          getCheckboxProps: (user) => ({ disabled: !manageable(user) }),
        }}
        tableAlertOptionRender={({ selectedRowKeys, onCleanSelected }) => {
          const ids = selectedRowKeys as string[];
          return (
            <Space>
              <Button size="small" onClick={() => runBatch(ids, 'enable', onCleanSelected)}>
                {t('users.batchEnable')}
              </Button>
              <Button size="small" onClick={() => runBatch(ids, 'disable', onCleanSelected)}>
                {t('users.batchDisable')}
              </Button>
              <Button
                size="small"
                danger
                onClick={() =>
                  modal.confirm({
                    title: t('users.batchDeleteConfirm', { count: ids.length }),
                    okButtonProps: { danger: true },
                    onOk: () => runBatch(ids, 'delete', onCleanSelected),
                  })
                }
              >
                {t('users.batchDelete')}
              </Button>
            </Space>
          );
        }}
        request={async (params, sort) => {
          const [sortField, order] = Object.entries(sort ?? {})[0] ?? [];
          const page = await listUsers({ ...params, sortField, sortOrder: order ?? undefined });
          return { data: page.list, total: page.total, success: true };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>
            {t('users.create')}
          </Button>,
          <Dropdown
            key="more"
            trigger={['click']}
            menu={{
              items: [{ key: 'excel', label: t('menu.document.excel') }],
              onClick: () => history.push('/document/excel'),
            }}
          >
            <Button>
              {t('users.more')} <DownOutlined />
            </Button>
          </Dropdown>,
        ]}
      />
      <UserForm user={editing} onClose={() => setEditing(undefined)} onSubmit={handleSubmit} />
      <UserDrawer user={viewing} onClose={() => setViewing(undefined)} />
    </DemoPage>
  );
}
