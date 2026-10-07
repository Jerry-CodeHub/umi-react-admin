import { useChartTheme } from '@/hooks/useChartTheme';
import type { DashboardOverview } from '@/services/types';
import { fromNow } from '@/utils/format';
import { useIntl } from '@umijs/max';
import { Timeline, Typography } from 'antd';

/** 最新动态：重要告警、工单派发与完成，按时间倒序 */
export default function Activities({ data }: { data: DashboardOverview['activities'] }) {
  const intl = useIntl();
  const chart = useChartTheme();

  const describe = (item: DashboardOverview['activities'][number]) => {
    if (item.kind === 'alarm') {
      return intl.formatMessage(
        { id: 'dashboard.activity.alarm' },
        {
          device: item.deviceName,
          level: intl.formatMessage({ id: `alarmLevel.${item.level}` }),
          type: intl.formatMessage({ id: `alarmType.${item.alarmType}` }),
        },
      );
    }
    return intl.formatMessage(
      { id: `dashboard.activity.${item.kind}` },
      { ticket: item.ticketId, assignee: item.assigneeName },
    );
  };
  const dotColor = (item: DashboardOverview['activities'][number]) =>
    item.kind === 'alarm' ? chart.levelColor(item.level!) : chart.color(item.kind === 'ticketDone' ? 'green' : 'blue');

  return (
    <Timeline
      className="pt-2"
      items={data.map((item) => ({
        key: item.id,
        color: dotColor(item),
        children: (
          <div>
            <div className="leading-snug">{describe(item)}</div>
            <Typography.Text type="secondary" className="text-xs">
              {fromNow(item.at, intl.locale)}
            </Typography.Text>
          </div>
        ),
      }))}
    />
  );
}
