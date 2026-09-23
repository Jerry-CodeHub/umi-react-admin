import { userService } from '@/services/demo/userService';
import { getMessage } from '@/utils/antdMessage';
import {
  ActionType,
  FooterToolbar,
  PageContainer,
  ProColumns,
  ProDescriptions,
  ProDescriptionsItemProps,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Drawer } from 'antd';
import React, { useRef, useState } from 'react';
import CreateForm from './components/CreateForm';
import UpdateForm, { FormValueType } from './components/UpdateForm';

const { addUser, queryUserList, deleteUser, modifyUser } = userService;

/**
 * 添加节点
 * @param fields
 */
const handleAdd = async (fields: API.UserInfo) => {
  const hide = getMessage().loading('正在添加');
  try {
    await addUser({ ...fields });
    hide();
    getMessage().success('添加成功');
    return true;
  } catch {
    hide();
    getMessage().error('添加失败请重试！');
    return false;
  }
};

/**
 * 更新节点
 * @param fields
 */
const handleUpdate = async (fields: FormValueType) => {
  const hide = getMessage().loading('正在配置');
  try {
    // 只提交表单实际字段：值为 undefined 的键不进请求体（JSON.stringify 自动丢弃），
    // 杜绝「表单里没有的字段被空串覆盖」（此前 || '' 兜底会清空 nickName/email）
    await modifyUser(
      {
        userId: fields.id || '',
      },
      {
        name: fields.name,
        nickName: fields.nickName,
        email: fields.email,
      },
    );
    hide();

    getMessage().success('配置成功');
    return true;
  } catch {
    hide();
    getMessage().error('配置失败请重试！');
    return false;
  }
};

/**
 *  删除节点
 * @param selectedRows
 */
const handleRemove = async (selectedRows: API.UserInfo[]) => {
  const hide = getMessage().loading('正在删除');
  if (!selectedRows.length) {
    hide();
    return true;
  }

  const userIds = selectedRows.map((row) => row.id).filter(Boolean);
  if (!userIds.length) {
    hide();
    getMessage().warning('未找到可删除的数据');
    return false;
  }

  try {
    await Promise.all(userIds.map((userId) => deleteUser({ userId })));
    hide();
    getMessage().success('删除成功，即将刷新');
    return true;
  } catch {
    hide();
    getMessage().error('删除失败，请重试');
    return false;
  }
};

const TableList: React.FC<unknown> = () => {
  const [createModalVisible, handleModalVisible] = useState<boolean>(false);
  const [updateModalVisible, handleUpdateModalVisible] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState({});
  const actionRef = useRef<ActionType>(undefined);
  const [row, setRow] = useState<API.UserInfo>();
  const [selectedRowsState, setSelectedRows] = useState<API.UserInfo[]>([]);
  const baseColumns: ProColumns<API.UserInfo>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      tooltip: '名称是唯一的 key',
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            setRow(record);
          }}
        >
          {record.name}
        </Button>
      ),
      formItemProps: {
        rules: [
          {
            required: true,
            message: '名称为必填项',
          },
        ],
      },
    },
    {
      title: '昵称',
      dataIndex: 'nickName',
      valueType: 'text',
    },
    {
      title: '性别',
      dataIndex: 'gender',
      hideInForm: true,
      valueEnum: {
        MALE: { text: '男', status: 'MALE' },
        FEMALE: { text: '女', status: 'FEMALE' },
      },
    },
  ];
  const columns: ProColumns<API.UserInfo>[] = [
    ...baseColumns,
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      render: (_, record) => (
        <>
          <Button
            type="link"
            onClick={() => {
              handleUpdateModalVisible(true);
              setEditingUser(record);
            }}
          >
            配置
          </Button>
        </>
      ),
    },
  ];
  const descriptionColumns: ProDescriptionsItemProps<API.UserInfo>[] = [
    { title: '名称', dataIndex: 'name' },
    { title: '昵称', dataIndex: 'nickName', valueType: 'text' },
    {
      title: '性别',
      dataIndex: 'gender',
      valueEnum: {
        MALE: { text: '男', status: 'MALE' },
        FEMALE: { text: '女', status: 'FEMALE' },
      },
    },
  ];

  return (
    <PageContainer
      header={{
        title: 'CRUD 示例',
      }}
    >
      <ProTable<API.UserInfo>
        headerTitle="查询表格"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <Button key="1" type="primary" onClick={() => handleModalVisible(true)}>
            新建
          </Button>,
        ]}
        request={async (params) => {
          try {
            const { data, success } = await queryUserList({ ...params });
            return {
              data: data?.list || [],
              total: data?.total,
              success,
            };
          } catch {
            // 错误提示由全局 errorHandler 统一处理，这里兜底消除 unhandled rejection
            return { data: [], total: 0, success: false };
          }
        }}
        columns={columns}
        rowSelection={{
          onChange: (_, selectedRows) => setSelectedRows(selectedRows),
        }}
      />
      {selectedRowsState?.length > 0 && (
        <FooterToolbar
          extra={
            <div>
              已选择 <strong>{selectedRowsState.length}</strong> 项&nbsp;&nbsp;
            </div>
          }
        >
          <Button
            onClick={async () => {
              await handleRemove(selectedRowsState);
              setSelectedRows([]);
              actionRef.current?.reloadAndRest?.();
            }}
          >
            批量删除
          </Button>
        </FooterToolbar>
      )}
      <CreateForm onCancel={() => handleModalVisible(false)} modalVisible={createModalVisible}>
        <ProTable<API.UserInfo, API.UserInfo>
          onSubmit={async (value) => {
            const success = await handleAdd(value);
            if (success) {
              handleModalVisible(false);
              if (actionRef.current) {
                actionRef.current.reload();
              }
            }
          }}
          rowKey="id"
          type="form"
          columns={columns}
        />
      </CreateForm>
      {editingUser && Object.keys(editingUser).length ? (
        <UpdateForm
          onSubmit={async (value) => {
            const success = await handleUpdate(value);
            if (success) {
              handleUpdateModalVisible(false);
              setEditingUser({});
              if (actionRef.current) {
                actionRef.current.reload();
              }
            }
          }}
          onCancel={() => {
            handleUpdateModalVisible(false);
            setEditingUser({});
          }}
          updateModalVisible={updateModalVisible}
          values={editingUser}
        />
      ) : null}

      <Drawer
        width={600}
        open={!!row}
        onClose={() => {
          setRow(undefined);
        }}
        closable={false}
      >
        {row?.name && (
          <ProDescriptions<API.UserInfo>
            column={2}
            title={row?.name}
            request={async () => {
              try {
                const { data } = await userService.getUserDetail({ userId: row.id });
                return { data: data || row };
              } catch {
                // 详情接口失败（如 404）时回落到行数据，抽屉不留空白
                return { data: row };
              }
            }}
            params={{
              id: row?.name,
            }}
            columns={descriptionColumns}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default TableList;
