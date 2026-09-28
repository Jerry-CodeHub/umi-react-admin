import { LEVEL_COLOR } from '@/constants/semantic';
import { useChartTheme } from '@/hooks/useChartTheme';
import type { DashboardOverview } from '@/services/types';
import { Sankey } from '@ant-design/plots';
import { useIntl } from '@umijs/max';

/** 节点 key（level:critical / disposition:ticketed / result:inSla）→ 显示名 */
const NODE_MESSAGE: Record<string, string> = {
  level: 'alarmLevel',
  disposition: 'alarmStatus',
  result: 'ticketResult',
};

/** 近 30 天告警处置流向：级别 → 处置方式 → 工单结果 */
export default function Disposition({ data, height }: { data: DashboardOverview['disposition']; height: number }) {
  const intl = useIntl();
  const chart = useChartTheme();
  const name = (key: string) => {
    const [kind, value] = key.split(':');
    return intl.formatMessage({ id: `${NODE_MESSAGE[kind]}.${value}` });
  };
  // 节点颜色：级别沿用语义色，其余节点按处置结果着色
  const nodeColor: Record<string, string> = {
    'level:critical': chart.color(LEVEL_COLOR.critical),
    'level:major': chart.color(LEVEL_COLOR.major),
    'level:minor': chart.color(LEVEL_COLOR.minor),
    'level:info': chart.color(LEVEL_COLOR.info),
    'disposition:recovered': chart.color('green'),
    'disposition:ticketed': chart.color('purple'),
    'disposition:falsePositive': chart.color('grey'),
    'disposition:pending': chart.color('volcano'),
    'result:inSla': chart.color('green'),
    'result:overdue': chart.color('red'),
    'result:inProgress': chart.color('blue'),
  };
  const colorByName = new Map(Object.entries(nodeColor).map(([key, color]) => [name(key), color]));
  const links = data.map((link) => ({ source: name(link.source), target: name(link.target), value: link.value }));

  return (
    <Sankey
      data={links}
      height={height}
      theme={chart.g2Theme}
      scale={{ color: { domain: [...colorByName.keys()], range: [...colorByName.values()] } }}
      layout={{ nodeAlign: 'justify', nodePadding: 0.03, nodeWidth: 0.012 }}
      // 连线沿用起点节点的颜色，一眼看出每个级别的告警流向哪里
      linkColorField={(link: { source: { key: string } }) => link.source.key}
      style={{
        labelSpacing: 6,
        labelFontSize: 12,
        labelFill: chart.text,
        linkFillOpacity: 0.35,
        nodeLineWidth: 0,
      }}
    />
  );
}
