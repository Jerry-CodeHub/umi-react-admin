import type { User, UserInput } from '@/services/types';
import { createUser, deleteUser, listUsers, updateUser } from '@/services/users';
import {
  ActionType,
  ModalForm,
  PageContainer,
  ProColumns,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { App, Button, Popconfirm } from 'antd';
import { useRef, useState } from 'react';

// 过渡版本：接口已切到新的用户服务；完整的用户管理页见后续阶段（src/pages/System/Users）
const departmentEnum = {
  ops1: '运维一部',
  ops2: '运维二部',
  ops3: '运维三部',
  analytics: '数据分析组',
  platform: '平台研发组',
  security: '安全合规组',
  support: '客服中心',
};
const roleEnum = { admin: '系统管理员', lead: '值班长', operator: '运维工程师', analyst: '数据分析员', viewer: '访客' };
const statusEnum = {
  active: { text: '正常', status: 'Success' },
  disabled: { text: '停用', status: 'Default' },
  locked: { text: '锁定', status: 'Error' },
};

export default function TableList() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);
  const [editing, setEditing] = useState<User | null | undefined>(undefined);

  const columns: ProColumns<User>[] = [
    { title: '工号', dataIndex: 'id', search: false, width: 90 },
    { title: '姓名', dataIndex: 'name', search: false },
    { title: '登录名', dataIndex: 'username', search: false },
    { title: '关键字', dataIndex: 'keyword', hideInTable: true },
    { title: '部门', dataIndex: 'department', valueEnum: departmentEnum },
    { title: '角色', dataIndex: 'role', valueEnum: roleEnum },
    { title: '状态', dataIndex: 'status', valueEnum: statusEnum },
    { title: '邮箱', dataIndex: 'email', search: false },
    { title: '最近登录', dataIndex: 'lastLoginAt', valueType: 'fromNow', search: false, sorter: true },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <Button key="edit" type="link" size="small" onClick={() => setEditing(record)}>
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除该用户？"
          onConfirm={async () => {
            await deleteUser(record.id);
            message.success('已删除');
            actionRef.current?.reload();
          }}
        >
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<User>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort) => {
          const [sortField, sortOrder] = Object.entries(sort ?? {})[0] ?? [];
          const page = await listUsers({ ...params, sortField, sortOrder: sortOrder ?? undefined });
          return { data: page.list, total: page.total, success: true };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={() => setEditing(null)}>
            新建
          </Button>,
        ]}
      />
      <ModalForm<UserInput>
        title={editing ? '编辑用户' : '新建用户'}
        open={editing !== undefined}
        initialValues={editing ?? { department: 'support', role: 'viewer' }}
        modalProps={{ destroyOnHidden: true, onCancel: () => setEditing(undefined) }}
        onFinish={async (values) => {
          if (editing) {
            await updateUser(editing.id, values);
          } else {
            await createUser(values);
          }
          message.success('已保存');
          setEditing(undefined);
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormText name="name" label="姓名" rules={[{ required: true }]} />
        <ProFormText name="username" label="登录名" rules={[{ required: true }]} />
        <ProFormText name="email" label="邮箱" rules={[{ required: true, type: 'email' }]} />
        <ProFormSelect name="department" label="部门" valueEnum={departmentEnum} />
        <ProFormSelect name="role" label="角色" valueEnum={roleEnum} />
      </ModalForm>
    </PageContainer>
  );
}
