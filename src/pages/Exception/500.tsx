import { history, useIntl } from '@umijs/max';
import { Button, Result } from 'antd';

export default () => {
  const intl = useIntl();
  return (
    <Result
      status="500"
      title="500"
      subTitle={intl.formatMessage({ id: 'page.500.subTitle' })}
      extra={
        <Button type="primary" onClick={() => history.push('/')}>
          {intl.formatMessage({ id: 'page.backHome' })}
        </Button>
      }
    />
  );
};
