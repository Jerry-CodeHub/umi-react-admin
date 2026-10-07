import { CATEGORY_COLORS, LEVEL_COLOR, type PresetColor } from '@/constants/semantic';
import type { AlarmLevel } from '@/services/types';
import { useModel } from '@umijs/max';
import { theme } from 'antd';
import { createContext, useContext, useMemo } from 'react';

/** 局部强制主题（如导出 PDF 的报告页始终按浅色纸面渲染）；不提供时跟随应用主题 */
export const ChartThemeOverride = createContext<'light' | 'dark' | undefined>(undefined);

/**
 * 图表主题与语义色：G2 用 classic / classicDark 跟随应用主题，D3 等手绘图表直接取色值。
 * 此前图表写死 #000 / #333 描边与文字，暗色模式下坐标轴、图例、标签看不见。
 */
export const useChartTheme = () => {
  const { initialState } = useModel('@@initialState');
  const { token } = theme.useToken();
  const override = useContext(ChartThemeOverride);
  const dark = override ? override === 'dark' : initialState?.theme === 'realDark';

  return useMemo(() => {
    const color = (name: PresetColor) => (name === 'grey' ? token.colorTextQuaternary : token[name]);
    /**
     * 告警级别在图表里的颜色：提示级数量最多，用满饱和的主蓝会在堆叠图里压过严重 / 重要，
     * 所以降一档（浅色主题更浅、暗色主题更暗），让视线先落在红橙色上。表格 Tag 仍用 LEVEL_COLOR
     */
    const levelColor = (level: AlarmLevel) =>
      level === 'info' ? (dark ? token.blue5 : token.blue4) : color(LEVEL_COLOR[level]);
    return {
      dark,
      /** @ant-design/plots 的 theme 属性 */
      g2Theme: dark ? 'classicDark' : 'classic',
      token,
      color,
      levelColor,
      categories: CATEGORY_COLORS.map(color),
      text: token.colorText,
      textSecondary: token.colorTextSecondary,
      border: token.colorBorderSecondary,
      background: token.colorBgContainer,
    };
  }, [dark, token]);
};
