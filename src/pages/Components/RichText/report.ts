import type { CalendarEvent, DashboardOverview } from '@/services/types';
import { formatDateTime, formatNumber, formatPercent } from '@/utils/format';

type Translate = (id: string, values?: Record<string, string | number>) => string;

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * 按当前演示数据生成一份运维周报（HTML），作为富文本编辑器的初稿。
 * 所有插值都经过转义；编辑后的回显另由 DOMPurify 消毒。
 */
export const buildWeeklyReport = (
  overview: DashboardOverview,
  plans: CalendarEvent[],
  t: Translate,
  locale: string,
) => {
  const { kpi } = overview;
  const now = new Date(overview.generatedAt);
  const from = formatDateTime(new Date(now.getTime() - 6 * 86_400_000), 'MM-DD');
  const to = formatDateTime(now, 'MM-DD');
  const pct = (value: number) => formatPercent(value, locale);
  const signed = (value: number, text: string) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${text}`;

  const total = overview.alarmTypes.reduce((sum, row) => sum + row.count, 0);
  const topTypes = [...overview.alarmTypes].sort((a, b) => b.count - a.count).slice(0, 3);
  const rows: [string, string, string][] = [
    [
      t('dashboard.kpi.devices'),
      `${kpi.devicesOnline} / ${kpi.devicesTotal} (${pct(kpi.devicesOnline / kpi.devicesTotal)})`,
      t('common.none'),
    ],
    [
      t('dashboard.kpi.sla'),
      pct(kpi.slaRate),
      signed(
        kpi.slaRate - kpi.slaRatePrev,
        `${formatNumber(Math.abs(kpi.slaRate - kpi.slaRatePrev) * 100, locale, { maximumFractionDigits: 1 })} pp`,
      ),
    ],
    [
      t('dashboard.kpi.response'),
      `${kpi.avgResponseMinutes} ${t('dashboard.kpi.minutes')}`,
      signed(
        kpi.avgResponseMinutes - kpi.avgResponseMinutesPrev,
        `${Math.abs(kpi.avgResponseMinutes - kpi.avgResponseMinutesPrev)} ${t('dashboard.kpi.minutes')}`,
      ),
    ],
  ];

  return [
    `<h2>${escape(t('richText.report.title', { from, to }))}</h2>`,
    `<p>${escape(
      t('richText.report.summary', {
        online: kpi.devicesOnline,
        total: kpi.devicesTotal,
        rate: pct(kpi.devicesOnline / kpi.devicesTotal),
        sla: pct(kpi.slaRate),
        response: kpi.avgResponseMinutes,
      }),
    )}</p>`,
    `<h3>${escape(t('richText.report.kpi'))}</h3>`,
    '<table style="border-collapse: collapse; width: 100%;" border="1"><thead><tr>',
    [t('richText.report.metric'), t('richText.report.value'), t('richText.report.change')]
      .map((cell) => `<th style="padding: 6px 10px; text-align: left;">${escape(cell)}</th>`)
      .join(''),
    '</tr></thead><tbody>',
    rows
      .map((row) => `<tr>${row.map((cell) => `<td style="padding: 6px 10px;">${escape(cell)}</td>`).join('')}</tr>`)
      .join(''),
    '</tbody></table>',
    `<h3>${escape(t('richText.report.topTypes'))}</h3>`,
    '<ol>',
    topTypes
      .map(
        (row) =>
          `<li>${escape(
            t('richText.report.typeLine', {
              type: t(`alarmType.${row.type}`),
              count: row.count,
              share: pct(total ? row.count / total : 0),
            }),
          )}</li>`,
      )
      .join(''),
    '</ol>',
    `<h3>${escape(t('richText.report.plan'))}</h3>`,
    plans.length
      ? `<ul>${plans
          .map((event) => `<li>${escape(formatDateTime(event.start, 'MM-DD'))} · ${escape(event.title)}</li>`)
          .join('')}</ul>`
      : `<p>${escape(t('richText.report.noPlan'))}</p>`,
    `<p><em>${escape(t('richText.report.footer'))}</em></p>`,
  ].join('');
};
