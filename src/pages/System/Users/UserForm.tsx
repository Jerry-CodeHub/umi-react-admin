import { DEPARTMENT_KEYS, USER_STATUS_KEYS } from '@/constants/enums';
import { ROLE_KEYS } from '@/constants/permissions';
import { useEnums } from '@/hooks/useEnums';
import type { User, UserInput } from '@/services/types';
import { ModalForm, ProFormRadio, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';

const PROTECTED = new Set(['admin', 'guest']);

type UserFormProps = {
  /** undefined 关闭；null 新建；User 编辑 */
  user: User | null | undefined;
  onClose: () => void;
  onSubmit: (values: UserInput) => Promise<void>;
};

export default function UserForm({ user, onClose, onSubmit }: UserFormProps) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const enums = useEnums();
  const editing = !!user;

  return (
    <ModalForm<UserInput>
      title={t(editing ? 'users.edit' : 'users.create')}
      open={user !== undefined}
      width={520}
      initialValues={user ?? { department: 'support', role: 'viewer' }}
      modalProps={{ destroyOnHidden: true, onCancel: onClose }}
      onFinish={async (values) => {
        await onSubmit(values);
        return true;
      }}
    >
      <ProFormText name="name" label={t('users.column.name')} rules={[{ required: true }]} />
      <ProFormText
        name="username"
        label={t('users.column.username')}
        disabled={!!user && PROTECTED.has(user.username)}
        tooltip={user && PROTECTED.has(user.username) ? t('users.protectedHint') : undefined}
        rules={[{ required: true }, { pattern: /^[a-z][a-z0-9._-]{2,31}$/i, message: t('users.usernameRule') }]}
      />
      <ProFormText name="email" label={t('users.column.email')} rules={[{ required: true }, { type: 'email' }]} />
      <ProFormSelect
        name="department"
        label={t('users.column.department')}
        options={enums.options('department', DEPARTMENT_KEYS)}
        rules={[{ required: true }]}
      />
      <ProFormSelect
        name="role"
        label={t('users.column.role')}
        options={enums.options('role', ROLE_KEYS)}
        rules={[{ required: true }]}
      />
      {editing && (
        <ProFormRadio.Group
          name="status"
          label={t('users.column.status')}
          radioType="button"
          options={enums.options('userStatus', USER_STATUS_KEYS)}
        />
      )}
    </ModalForm>
  );
}
