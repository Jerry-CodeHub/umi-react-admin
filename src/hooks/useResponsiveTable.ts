import { Grid } from 'antd';

/**
 * 列表页表格的响应式取舍：
 * - 宽度按列宽之和（max-content）：容器放得下就不出现横向滚动，放不下才滚动；
 *   此前写死 scroll.x = 1300，1440 宽屏上也要横向滚动，靠后的列被固定操作列盖住
 * - 固定列只在 md 及以上生效：手机宽度下「勾选列 + 固定操作列」会占满视口，中间的数据列被挤得看不见
 */
export const useResponsiveTable = () => {
  const { md } = Grid.useBreakpoint();
  return {
    scroll: { x: 'max-content' as const },
    fixedRight: md ? ('right' as const) : undefined,
  };
};
