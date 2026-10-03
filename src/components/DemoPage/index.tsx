import { GithubOutlined } from '@ant-design/icons';
import { PageContainer, type PageContainerProps } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Button, Space, Typography } from 'antd';

const REPO_BLOB = 'https://github.com/Jerry-CodeHub/umi-react-admin/blob/master/';

type DemoPageProps = Omit<PageContainerProps, 'content'> & {
  /** 页面说明的 i18n 键（显示在标题下方） */
  descriptionId?: string;
  /** 本页核心源码的仓库相对路径，渲染「查看源码」按钮 */
  source?: string;
};

/**
 * 演示页统一外壳：标题与面包屑取自路由菜单，下方一句话说明，右上角「查看源码」直达仓库对应文件。
 * 各页不再各自包 ProCard + shadow-2xl，间距与层级统一由 PageContainer 承担。
 */
export default function DemoPage({ descriptionId, source, extra, children, ...rest }: DemoPageProps) {
  const intl = useIntl();
  const sourceButton = source ? (
    <Button
      key="source"
      data-tour="source"
      icon={<GithubOutlined />}
      href={REPO_BLOB + source}
      target="_blank"
      rel="noopener noreferrer"
    >
      {intl.formatMessage({ id: 'common.viewSource' })}
    </Button>
  ) : null;
  return (
    <PageContainer
      content={
        descriptionId ? (
          <Typography.Text type="secondary">{intl.formatMessage({ id: descriptionId })}</Typography.Text>
        ) : undefined
      }
      extra={
        extra || sourceButton ? (
          <Space wrap>
            {extra}
            {sourceButton}
          </Space>
        ) : undefined
      }
      {...rest}
    >
      {children}
    </PageContainer>
  );
}
