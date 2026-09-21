import { AUTH_TOKEN_KEY } from '@/constants';
import { logout } from '@/services/auth';
import { GithubOutlined, GlobalOutlined, SkinOutlined, UserOutlined } from '@ant-design/icons';
import { history, setLocale, useIntl, useModel } from '@umijs/max';
import { Avatar, Button, Divider, Popover, message } from 'antd';
import { useEffect, useState } from 'react';

const safeLocalStorage = {
  getItem: (key: string) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null),
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  },
};

const RightContent = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const intl = useIntl();
  const { initialState, setInitialState } = useModel('@@initialState');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [localeType, setLocaleType] = useState(safeLocalStorage.getItem('umi_locale') || 'zh-CN');

  useEffect(() => {
    if (!safeLocalStorage.getItem('umi_locale')) {
      setLocale('zh-CN');
    }
  }, []);
  const localeTypeData = [
    {
      label: '中文',
      value: 'zh-CN',
    },
    {
      label: 'English',
      value: 'en-US',
    },
  ];

  const themeType = [
    {
      label: intl.formatMessage({ id: 'undertone' }),
      icons: 'GlobalOutlined',
      value: 'defaultAlgorithm',
    },
    {
      label: intl.formatMessage({ id: 'DarkColor' }),
      icons: 'GlobalOutlined',
      value: 'darkAlgorithm',
    },
  ];

  return (
    <>
      {contextHolder}
      <Popover
        title=""
        trigger="hover"
        placement="bottom"
        className="flex items-center justify-center mr-5 "
        content={
          <div
            className="w-24 px-2 py-1 text-center rounded-md cursor-pointer hover:bg-zinc-200"
            onClick={async () => {
              try {
                await logout();
              } catch {
                // best-effort：退出接口失败不阻断本地登出
              }
              safeLocalStorage.removeItem(AUTH_TOKEN_KEY);
              await setInitialState(undefined);
              messageApi.success(intl.formatMessage({ id: 'Logout' }));
              history.push('/login');
            }}
          >
            {intl.formatMessage({ id: 'Logout' })}
          </div>
        }
      >
        <Avatar
          className="flex items-center justify-center"
          icon={<UserOutlined style={{ fontSize: 20 }} />}
          size={28}
        />
        <div className="ml-2">{initialState?.nickName ?? 'Admin'}</div>
      </Popover>

      <Divider className="mx-5 h-7" type="vertical" />

      <Popover
        trigger="hover"
        placement="bottom"
        className="mr-5 text-2xl"
        content={
          <div>
            {themeType.map((item, index) => (
              <div
                className="w-24 px-2 py-1 text-center rounded-md cursor-pointer hover:bg-zinc-200"
                key={index}
                onClick={() => {
                  messageApi.info(intl.formatMessage({ id: 'solution' }));
                }}
              >
                {item.label}
              </div>
            ))}
          </div>
        }
      >
        <Button className="flex items-center justify-center" icon={<SkinOutlined />} />
      </Popover>

      <Popover
        className="mr-5 text-2xl"
        trigger="hover"
        placement="bottom"
        content={
          <div>
            {localeTypeData.map((item, index) => (
              <div
                className="w-24 px-2 py-1 text-center rounded-md cursor-pointer hover:bg-zinc-200"
                onClick={() => {
                  setLocale(item.value);
                  setLocaleType(item.value);
                }}
                key={index}
              >
                {item.label}
              </div>
            ))}
          </div>
        }
      >
        <Button className="flex items-center justify-center" icon={<GlobalOutlined />} />
      </Popover>

      <Button
        className="mr-6"
        icon={<GithubOutlined />}
        onClick={() => {
          window.open('https://github.com/Jerry-CodeHub/umi-react-admin');
        }}
      />
    </>
  );
};

export default RightContent;
