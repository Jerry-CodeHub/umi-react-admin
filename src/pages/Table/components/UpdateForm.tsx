import { ModalForm, ProFormText } from '@ant-design/pro-components';
import React from 'react';

/**
 * 编辑用户表单。
 * 此前为模板遗留的三步「规则配置」StepsForm（desc/target/template 等字段与
 * UserInfo 模型完全无关），现按实际数据模型收敛为单步表单。
 */
export type FormValueType = Partial<API.UserInfo>;

export interface UpdateFormProps {
  onCancel: (flag?: boolean, formVals?: FormValueType) => void;
  onSubmit: (values: FormValueType) => Promise<void>;
  updateModalVisible: boolean;
  values: Partial<API.UserInfo>;
}

const UpdateForm: React.FC<UpdateFormProps> = (props) => (
  <ModalForm<API.UserInfo>
    key={props.values.id ?? 'new'}
    width={480}
    title="编辑用户"
    open={props.updateModalVisible}
    modalProps={{ destroyOnHidden: true, onCancel: () => props.onCancel() }}
    initialValues={{
      id: props.values.id,
      name: props.values.name,
      nickName: props.values.nickName,
      email: props.values.email,
    }}
    onFinish={async (formValues) => {
      await props.onSubmit(formValues);
      // 关闭时机交由父组件在提交成功后控制
      return false;
    }}
  >
    <ProFormText hidden name="id" />
    <ProFormText name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
    <ProFormText name="nickName" label="昵称" />
    <ProFormText name="email" label="邮箱" rules={[{ type: 'email', message: '请输入合法邮箱' }]} />
  </ModalForm>
);

export default UpdateForm;
