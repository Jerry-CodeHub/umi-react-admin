import { history, useIntl } from '@umijs/max';
import { Button, Result } from 'antd';

export default () => {
  const intl = useIntl();
  return (
    <Result
      status="404"
      title="404"
      subTitle={intl.formatMessage({ id: 'page.404.subTitle' })}
      extra={
        <Button
          onClick={() => {
            history.push('/');
          }}
        >
          {intl.formatMessage({ id: 'page.backHome' })}
        </Button>
      }
    />
  );
};
