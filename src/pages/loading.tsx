// 路由切换时的全局加载占位（umi 按页分包）：形状贴近真实页面（标题 + 说明 + 内容卡片），减少跳动
import { Card, Skeleton } from 'antd';

export default () => (
  <div className="px-6 py-4">
    <Skeleton.Input active size="small" style={{ width: 160 }} />
    <Skeleton active title={false} paragraph={{ rows: 1, width: '40%' }} className="mt-3" />
    <Card className="mt-4">
      <Skeleton active paragraph={{ rows: 8 }} />
    </Card>
  </div>
);
