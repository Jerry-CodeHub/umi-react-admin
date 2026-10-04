import { useIntl, useLocation } from '@umijs/max';
import { Tour, type TourProps } from 'antd';
import { useEffect, useState } from 'react';

const SEEN_KEY = 'umi-react-admin:tour-seen';
/** 头像菜单「功能导览」派发这个事件重新打开 */
export const OPEN_TOUR_EVENT = 'umi-react-admin:open-tour';

const target = (selector: string) => () => document.querySelector<HTMLElement>(selector) as HTMLElement;

/**
 * 首次登录后的四步导览：菜单分组 → 主题与语言 → 账户菜单（重置演示数据）→ 查看源码。
 * 只在工作台自动出现一次；之后可从头像菜单重新打开。
 */
export default function GuideTour() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(SEEN_KEY);
    } catch {
      // 存储不可用时不自动弹出，避免每次进入都打扰
    }
    // 等布局与页面渲染完成再定位目标元素
    const timer = !seen && location.pathname === '/dashboard' ? setTimeout(() => setOpen(true), 1200) : undefined;
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_TOUR_EVENT, reopen);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(OPEN_TOUR_EVENT, reopen);
    };
  }, [location.pathname]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // 同上
    }
  };

  const steps: TourProps['steps'] = [
    {
      title: t('tour.nav.title'),
      description: t('tour.nav.desc'),
      target: target('[data-tour="nav"], .ant-menu-horizontal'),
    },
    { title: t('tour.theme.title'), description: t('tour.theme.desc'), target: target('[data-tour="theme"]') },
    { title: t('tour.account.title'), description: t('tour.account.desc'), target: target('[data-tour="account"]') },
    { title: t('tour.source.title'), description: t('tour.source.desc'), target: target('[data-tour="source"]') },
  ];

  return (
    <Tour
      open={open}
      // 第一步的目标（顶部菜单）贴着视口上沿：默认 6px 纵向留白会让遮罩矩形高度为负、控制台报错
      gap={{ offset: [6, 4] }}
      onClose={close}
      onFinish={close}
      steps={steps}
      indicatorsRender={(current, total) => `${current + 1} / ${total}`}
    />
  );
}
