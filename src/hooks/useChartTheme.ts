import { CATEGORY_COLORS, type PresetColor } from '@/constants/semantic';
import { useModel } from '@umijs/max';
import { theme } from 'antd';
import { useMemo } from 'react';

/**
 * 图表主题与语义色：G2 用 classic / classicDark 跟随应用主题，D3 等手绘图表直接取色值。
 * 此前图表写死 #000 / #333 描边与文字，暗色模式下坐标轴、图例、标签看不见。
 */
export const useChartTheme = () => {
  const { initialState } = useModel('@@initialState');
  const { token } = theme.useToken();
  const dark = initialState?.theme === 'realDark';

  return useMemo(() => {
    const color = (name: PresetColor) => (name === 'grey' ? token.colorTextQuaternary : token[name]);
    return {
      dark,
      /** @ant-design/plots 的 theme 属性 */
      g2Theme: dark ? 'classicDark' : 'classic',
      token,
      color,
      categories: CATEGORY_COLORS.map(color),
      text: token.colorText,
      textSecondary: token.colorTextSecondary,
      border: token.colorBorderSecondary,
      background: token.colorBgContainer,
    };
  }, [dark, token]);
};
