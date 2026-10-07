import { useChartTheme } from '@/hooks/useChartTheme';
import { useIntl } from '@umijs/max';
import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import { KEY_BANDS, type ModelCoverage } from './bands';

const MARGIN = { top: 56, right: 24, bottom: 44, left: 120 };
/** 最小绘制宽度：再窄对数轴刻度与频段标注会重叠 */
const MIN_WIDTH = 720;
const ROW_HEIGHT = 44;

/** 以 MHz 为单位的频率标签：≥1000 显示 GHz */
const formatMHz = (value: number) => (value >= 1000 ? `${value / 1000} GHz` : `${value} MHz`);

/**
 * D3 绘制的频谱覆盖图：对数频率轴 + 每个型号一条覆盖带 + 重点频段半透明叠加。
 * 宽度随容器变化（ResizeObserver），颜色取当前主题。
 */
export default function CoverageChart({ models }: { models: ModelCoverage[] }) {
  const intl = useIntl();
  const chart = useChartTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    // 低于 MIN_WIDTH 时按最小宽度绘制、容器横向滚动：对数轴刻度与频段标注在手机宽度下会互相重叠
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(MIN_WIDTH, Math.floor(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || width === 0) return;
    const height = MARGIN.top + models.length * ROW_HEIGHT + MARGIN.bottom;
    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    const x = d3
      .scaleLog()
      .domain([20, 6000])
      .range([MARGIN.left, width - MARGIN.right]);
    const y = d3
      .scaleBand<string>()
      .domain(models.map((m) => m.model))
      .range([MARGIN.top, MARGIN.top + models.length * ROW_HEIGHT])
      .padding(0.35);

    // 重点频段：竖向半透明色带 + 顶部标签（窄频段标签错开两行，避免重叠）
    const bands = svg.append('g');
    KEY_BANDS.forEach((band, index) => {
      const x0 = x(band.range[0]);
      const x1 = x(band.range[1]);
      const color = chart.categories[index % chart.categories.length];
      bands
        .append('rect')
        .attr('x', x0)
        .attr('width', Math.max(2, x1 - x0))
        .attr('y', MARGIN.top - 8)
        .attr('height', models.length * ROW_HEIGHT + 8)
        .attr('fill', color)
        .attr('fill-opacity', 0.16)
        .append('title')
        .text(`${intl.formatMessage({ id: `spectrum.band.${band.key}` })}: ${band.range[0]}–${band.range[1]} MHz`);
      bands
        .append('text')
        .attr('x', (x0 + x1) / 2)
        .attr('y', MARGIN.top - (index % 2 ? 14 : 30))
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('fill', color)
        .text(intl.formatMessage({ id: `spectrum.band.${band.key}` }));
    });

    // 型号覆盖带
    const rows = svg.append('g');
    models.forEach((model) => {
      const top = y(model.model)!;
      rows
        .append('rect')
        .attr('x', x(model.band[0]))
        .attr('width', x(model.band[1]) - x(model.band[0]))
        .attr('y', top)
        .attr('height', y.bandwidth())
        .attr('rx', 4)
        .attr('fill', chart.color('blue'))
        .attr('fill-opacity', 0.85);
      rows
        .append('text')
        .attr('x', MARGIN.left - 12)
        .attr('y', top + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('font-size', 12)
        .attr('fill', chart.text)
        .text(model.model);
      rows
        .append('text')
        .attr('x', x(model.band[0]) + 8)
        .attr('y', top + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('font-size', 11)
        .attr('fill', '#fff')
        .text(
          `${formatMHz(model.band[0])} – ${formatMHz(model.band[1])} · ${intl.formatMessage(
            { id: 'spectrum.devices' },
            { count: model.total },
          )}`,
        );
    });

    // 对数坐标轴
    const axis = d3
      .axisBottom(x)
      .tickValues([20, 50, 100, 200, 500, 1000, 2000, 5000])
      .tickFormat((value) => formatMHz(Number(value)));
    const axisGroup = svg
      .append('g')
      .attr('transform', `translate(0, ${MARGIN.top + models.length * ROW_HEIGHT + 6})`)
      .call(axis);
    axisGroup.selectAll('text').attr('fill', chart.textSecondary);
    axisGroup.selectAll('line,path').attr('stroke', chart.border);
    svg
      .append('text')
      .attr('x', width - MARGIN.right)
      .attr('y', height - 6)
      .attr('text-anchor', 'end')
      .attr('font-size', 11)
      .attr('fill', chart.textSecondary)
      .text(intl.formatMessage({ id: 'spectrum.axis' }));
  }, [width, models, chart, intl]);

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <svg ref={svgRef} role="img" aria-label={intl.formatMessage({ id: 'spectrum.coverage' })} />
    </div>
  );
}
