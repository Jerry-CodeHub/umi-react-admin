import { useIntl } from '@umijs/max';
import { Button, Card, Result, Skeleton } from 'antd';
import type { ReactNode } from 'react';

type ChartCardProps = {
  title: ReactNode;
  extra?: ReactNode;
  /** 图表区高度（像素，不含内边距），加载与出错时占位同高，避免布局跳动 */
  height: number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  children?: ReactNode;
};

const BODY_PADDING = 12;

/** 图表卡片：标题 + 固定高度的图表区，内置加载骨架与出错重试 */
export default function ChartCard({ title, extra, height, loading, error, onRetry, children }: ChartCardProps) {
  const intl = useIntl();
  let body = children;
  if (loading) {
    body = <Skeleton active paragraph={{ rows: Math.max(3, Math.round(height / 60)) }} />;
  } else if (error) {
    body = (
      <Result
        status="warning"
        title={intl.formatMessage({ id: 'common.loadFailed' })}
        extra={onRetry && <Button onClick={onRetry}>{intl.formatMessage({ id: 'common.retry' })}</Button>}
      />
    );
  }
  return (
    <Card
      title={title}
      extra={extra}
      className="h-full"
      styles={{ body: { height: height + BODY_PADDING * 2, padding: `${BODY_PADDING}px 16px`, overflow: 'hidden' } }}
    >
      {body}
    </Card>
  );
}
