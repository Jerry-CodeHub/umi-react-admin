import { AUTH_TOKEN_KEY } from '@/constants';
import { history } from '@umijs/max';
import { Button, Card, Form, Input, message } from 'antd';

const Login: React.FC = () => {
  const [messageApi, contextHolder] = message.useMessage();

  const handleFinish = (values: { name: string }) => {
    localStorage.setItem(AUTH_TOKEN_KEY, `${values.name || 'admin'}-demo-token`);
    messageApi.success('登录成功');
    history.push('/home');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      {contextHolder}
      <Card title="React Admin" className="w-full max-w-sm">
        <Form initialValues={{ name: 'admin' }} layout="vertical" onFinish={handleFinish}>
          <Form.Item label="用户名" name="name" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item>
            <Button block type="primary" htmlType="submit">
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
