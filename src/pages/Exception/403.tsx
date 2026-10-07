import { history, useIntl } from '@umijs/max';
import { Button, Result } from 'antd';

export default () => {
  const intl = useIntl();
  return (
    <Result
      status="403"
      title="403"
      subTitle={intl.formatMessage({ id: 'page.403.subTitle' })}
      extra={
        <Button
          onClick={() => {
            history.push('/');
          }}
          type="primary"
        >
          {intl.formatMessage({ id: 'page.backHome' })}
        </Button>
      }
    />
  );
};
