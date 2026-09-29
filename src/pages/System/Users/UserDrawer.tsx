import UserAvatar from '@/components/UserAvatar';
import { USER_STATUS_BADGE } from '@/constants/semantic';
import { useApi } from '@/hooks/useApi';
import { useEnums } from '@/hooks/useEnums';
import type { User } from '@/services/types';
import { listUserLogs } from '@/services/users';
import { formatDateTime, fromNow } from '@/utils/format';
import { useIntl } from '@umijs/max';
import { Badge, Descriptions, Drawer, Empty, Skeleton, Tag, Timeline, Typography } from 'antd';

/** 用户详情：基本信息 + 最近操作记录（来自操作日志接口） */
export default function UserDrawer({ user, onClose }: { user?: User; onClose: () => void }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const enums = useEnums();
  const { data, loading } = useApi(() => (user ? listUserLogs(user.id) : Promise.resolve(undefined)), [user?.id]);

  return (
    <Drawer open={!!user} onClose={onClose} width={520} title={t('users.detail')} destroyOnHidden>
      {user && (
        <>
          <UserAvatar name={user.name} description={user.email} size={48} />
          <Descriptions column={1} size="small" className="mt-6" bordered>
            <Descriptions.Item label={t('users.column.id')}>{user.id}</Descriptions.Item>
            <Descriptions.Item label={t('users.column.username')}>{user.username}</Descriptions.Item>
            <Descriptions.Item label={t('users.column.department')}>
              {enums.label('department', user.department)}
            </Descriptions.Item>
            <Descriptions.Item label={t('users.column.role')}>
              <Tag>{enums.label('role', user.role)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('users.column.status')}>
              <Badge status={USER_STATUS_BADGE[user.status]} text={enums.label('userStatus', user.status)} />
            </Descriptions.Item>
            <Descriptions.Item label={t('users.column.phone')}>{user.phone || t('common.none')}</Descriptions.Item>
            <Descriptions.Item label={t('users.column.lastLogin')}>
              {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : t('common.none')}
            </Descriptions.Item>
            <Descriptions.Item label={t('users.column.lastLoginIp')}>
              {user.lastLoginIp ?? t('common.none')}
            </Descriptions.Item>
            <Descriptions.Item label={t('users.column.createdAt')}>
              {formatDateTime(user.createdAt, 'YYYY-MM-DD')}
            </Descriptions.Item>
          </Descriptions>
          <Typography.Title level={5} className="mt-8">
            {t('users.recentActivity')}
          </Typography.Title>
          <Skeleton active loading={loading}>
            {data?.list.length ? (
              <Timeline
                items={data.list.map((log) => ({
                  key: log.id,
                  color: log.result === 'success' ? 'green' : 'red',
                  children: (
                    <div>
                      <span>{enums.label('logAction', log.action)}</span>
                      {log.target && <Typography.Text type="secondary"> · {log.target}</Typography.Text>}
                      <div className="text-xs opacity-60">
                        {fromNow(log.createdAt, intl.locale)} · {log.ip}
                      </div>
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('users.noActivity')} />
            )}
          </Skeleton>
        </>
      )}
    </Drawer>
  );
}
