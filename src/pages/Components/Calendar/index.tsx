import DemoPage from '@/components/DemoPage';
import { EVENT_TYPE_KEYS } from '@/constants/enums';
import type { PresetColor } from '@/constants/semantic';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useEnums } from '@/hooks/useEnums';
import { createEvent, deleteEvent, listEvents, updateEvent } from '@/services/events';
import type { CalendarEvent, EventType } from '@/services/types';
import { formatDateTime } from '@/utils/format';
import { PlusOutlined } from '@ant-design/icons';
import FullCalendar, {
  type DateSelectInfo,
  type EventApi,
  type EventChangeInfo,
  type EventClickInfo,
  type EventInput,
  type EventSourceFuncInfo,
} from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import listPlugin from '@fullcalendar/react/list';
import zhLocale from '@fullcalendar/react/locales/zh-cn';
import multiMonthPlugin from '@fullcalendar/react/multimonth';
import classicTheme from '@fullcalendar/react/themes/classic';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import { useIntl } from '@umijs/max';
import {
  App,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Grid,
  Input,
  Listy,
  Modal,
  Popconfirm,
  Row,
  Select,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/palette.css';
import '@fullcalendar/react/themes/classic/theme.css';
import './calendar.css';

/** 日程类型色：与全站分类色板一致 */
export const EVENT_COLOR: Record<EventType, PresetColor> = {
  duty: 'blue',
  inspection: 'green',
  review: 'purple',
  training: 'cyan',
  maintenance: 'orange',
  release: 'magenta',
};

/**
 * 无障碍（Q5）：FullCalendar 事件块是「深底 + 白字」，而 antd 预设色给的是中间调
 * （#52c41a 白字 2.26:1、#13c2c2 2.20:1、#fa8c16 2.37:1，axe color-contrast serious）。
 * 这里取同一色系的深档作为事件背景：白字 5.43~9.85:1，明暗两套主题都成立
 * （深色主题下事件块落在 #141414 上，非文本对比度也 ≥3:1）。图例圆点仍用 chart.color 的亮色。
 */
const EVENT_BACKGROUND: Record<EventType, string> = {
  duty: '#0958d9', // 白字 6.16:1
  inspection: '#237804', // 5.59:1
  review: '#531dab', // 9.85:1
  training: '#006d75', // 6.10:1
  maintenance: '#ad4e00', // 5.43:1
  release: '#a50044', // 7.83:1
};

type Draft = { start: string; end: string; allDay: boolean };

/** 「接下来」独立向前查询的天数 */
const UPCOMING_DAYS = 14;

/** 日程时间的可读形式：全天日程只写日期（跨天写起止），定时日程写「日期 时:分–时:分」 */
const describeTime = (event: EventApi, allDayLabel: string) => {
  const start = dayjs(event.start);
  if (event.allDay) {
    // FullCalendar 全天日程的 end 是「结束日的次日 0 点」（开区间）
    const last = event.end ? dayjs(event.end).subtract(1, 'day') : start;
    const range = last.isAfter(start, 'day')
      ? `${start.format('MM-DD')} ~ ${last.format('MM-DD')}`
      : start.format('MM-DD');
    return `${range} · ${allDayLabel}`;
  }
  return `${start.format('MM-DD HH:mm')}${event.end ? ` – ${dayjs(event.end).format('HH:mm')}` : ''}`;
};

export default function Calendar() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string>) => intl.formatMessage({ id }, values);
  const enums = useEnums();
  const chart = useChartTheme();
  const { message } = App.useApp();
  // 事件源函数的引用变化时 FullCalendar 会重新拉取：新建后递增 version 即可刷新
  const [version, setVersion] = useState(0);
  const [weekends, setWeekends] = useState(true);
  const [draft, setDraft] = useState<Draft>();
  const [viewing, setViewing] = useState<EventApi>();
  // 手机上月视图一格只放得下两个字：默认改用按周列表。initialView 只在挂载时读取一次，
  // 所以用同步的 matchMedia 判断（Grid.useBreakpoint 首帧还是空对象）；工具栏则随断点实时切换
  const [compact] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches);
  const { md } = Grid.useBreakpoint();
  const narrow = md === undefined ? compact : !md;
  // FullCalendar 在 render 阶段就发起事件拉取；路由切换的渲染可能被 React 打断丢弃，
  // 被丢弃的那个实例拉取完成后回写状态，开发环境会报 "Can't perform a React state update on a component
  // that hasn't mounted yet"。等本组件挂载（layout effect，绘制前同步完成、不会闪）后再渲染日历
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => setMounted(true), []);
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([]);
  const [form] = Form.useForm<{ title: string; type: EventType }>();

  const toInput = useCallback(
    (event: CalendarEvent): EventInput => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      // 事件块用白字，背景必须够深（见 EVENT_BACKGROUND）；此处的颜色不随主题变，故 toInput 不再依赖 chart
      color: EVENT_BACKGROUND[event.type],
      extendedProps: { type: event.type },
    }),
    [],
  );

  /**
   * 事件源函数：FullCalendar 按 events 属性的**引用**比较决定是否重新拉取，所以新建 / 改期后
   * 递增 version 让本函数的引用变化即可刷新。version 不是被读取的输入，而是引用失效标记，
   * 因此显式编进返回的函数对象（避免「未使用依赖」被静默掩盖）。不要改成只依赖 toInput：
   * 那样保存后日历不会重新拉取。
   */
  const fetchEvents = useMemo(() => {
    const source = async (info: EventSourceFuncInfo) => (await listEvents(info.startStr, info.endStr)).map(toInput);
    return Object.assign(source, { version });
  }, [toInput, version]);

  /** 「接下来」独立查询未来 14 天：不再跟随日历当前视图范围，否则周末视图会漏掉次日的值班交接 */
  const fetchUpcoming = useCallback(async () => {
    const now = Date.now();
    const to = new Date(now + UPCOMING_DAYS * 86_400_000).toISOString();
    const list = await listEvents(new Date(now).toISOString(), to);
    setUpcoming(
      list
        .filter((event) => new Date(event.start).getTime() >= now)
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, 6),
    );
  }, []);

  useEffect(() => {
    void fetchUpcoming();
  }, [fetchUpcoming, version]);

  const refetch = () => setVersion((v) => v + 1);

  const handleSelect = (info: DateSelectInfo) => {
    info.view.calendar.unselect();
    form.setFieldsValue({ title: '', type: 'inspection' });
    setDraft({ start: info.startStr, end: info.endStr, allDay: info.allDay });
  };

  /** 常驻的新建入口（审计 U03：手机上框选手势不易发现）：默认下一个整点起 1 小时 */
  const openCreate = () => {
    form.setFieldsValue({ title: '', type: 'inspection' });
    const start = dayjs().startOf('hour').add(1, 'hour');
    setDraft({ start: start.toISOString(), end: start.add(1, 'hour').toISOString(), allDay: false });
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    await createEvent({ ...values, start: draft!.start, end: draft!.end, allDay: draft!.allDay });
    message.success(t('calendar.saved'));
    setDraft(undefined);
    refetch();
  };

  // validateFields 对「标题为空」的拒绝会以字段错误形式展示：onPressEnter / onOk 直接挂
  // 原函数会把该拒绝变成 unhandled rejection（弹窗保持打开是期望行为，吞掉即可）
  const handleCreateSafe = () => {
    void handleCreate().catch(() => undefined);
  };

  /** 拖动 / 拉伸改期：写回接口，失败则还原；成功后 refetch（「接下来」侧栏此前一直滞留旧时段） */
  const handleChange = async ({ event, revert }: EventChangeInfo) => {
    try {
      await updateEvent(event.id, {
        start: event.start!.toISOString(),
        end: event.end?.toISOString(),
        allDay: event.allDay,
      });
      message.success(t('calendar.saved'));
      refetch();
    } catch {
      revert();
    }
  };

  /** 点击日程先看详情（此前一点就弹「确认删除」，查看和删除混在一起） */
  const handleClick = ({ event }: EventClickInfo) => setViewing(event);

  const handleDelete = async () => {
    if (!viewing) return;
    await deleteEvent(viewing.id);
    viewing.remove();
    setViewing(undefined);
    message.success(t('common.deleted'));
    // 侧栏「接下来」此前不随删除刷新，被删日程一直挂到下一次新建
    refetch();
  };

  return (
    <DemoPage descriptionId="page.calendar.desc" source="src/pages/Components/Calendar/index.tsx">
      <Row gutter={[16, 16]}>
        {/* 窄屏上日历在前、侧栏（说明 / 图例 / 接下来）在后 */}
        <Col xs={{ span: 24, order: 2 }} xl={{ span: 6, order: 1 }}>
          <Card className="h-full">
            <Typography.Paragraph type="secondary">{t('calendar.hint')}</Typography.Paragraph>
            <Checkbox checked={weekends} onChange={(e) => setWeekends(e.target.checked)}>
              {t('calendar.weekends')}
            </Checkbox>
            <Typography.Title level={5} className="mt-6">
              {t('calendar.legend')}
            </Typography.Title>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPE_KEYS.map((type) => (
                <Badge key={type} color={chart.color(EVENT_COLOR[type])} text={enums.label('eventType', type)} />
              ))}
            </div>
            <Typography.Title level={5} className="mt-6">
              {t('calendar.upcoming')}
            </Typography.Title>
            {upcoming.length > 0 ? (
              <Listy
                items={upcoming}
                rowKey="id"
                styles={{ item: { paddingBlock: 8, paddingInline: 0 } }}
                itemRender={(event) => (
                  <div className="min-w-0">
                    <Badge color={chart.color(EVENT_COLOR[event.type])} text={event.title} className="truncate" />
                    <Typography.Text type="secondary" className="block pl-3.5 text-xs">
                      {event.allDay
                        ? `${formatDateTime(event.start, 'MM-DD')} · ${t('calendar.allDay')}`
                        : formatDateTime(event.start, 'MM-DD HH:mm')}
                    </Typography.Text>
                  </div>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('calendar.noUpcoming')} />
            )}
          </Card>
        </Col>
        <Col xs={{ span: 24, order: 1 }} xl={{ span: 18, order: 2 }}>
          <Card>
            {/* 新建按钮常驻（审计 U03：手机上只能靠框选新建，入口不可见）；窄屏收成图标按钮省宽度 */}
            <div className="mb-2 flex justify-end">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                aria-label={narrow ? t('calendar.newEvent') : undefined}
                onClick={openCreate}
              >
                {narrow ? null : t('calendar.newEvent')}
              </Button>
            </div>
            {/* v7 经典主题的调色板按祖先 [data-color-scheme] 切换暗色变量；calendar-skin 再把颜色接到 antd token */}
            <div className="calendar-skin" data-color-scheme={chart.dark ? 'dark' : 'light'}>
              {mounted && (
                <FullCalendar
                  locale={intl.locale === 'en-US' ? 'en' : zhLocale}
                  plugins={[
                    classicTheme,
                    dayGridPlugin,
                    timeGridPlugin,
                    listPlugin,
                    interactionPlugin,
                    multiMonthPlugin,
                  ]}
                  headerToolbar={
                    narrow
                      ? { left: 'prev,next', center: 'title', right: 'listWeek,dayGridMonth' }
                      : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }
                  }
                  views={{
                    // 手机默认的按周列表：范围标题改短格式（默认的「2025年9月8日 – 14日」在 390px 上太长）；
                    // 桌面工具栏不含 listWeek，不受影响
                    listWeek: { titleFormat: { month: 'short', day: 'numeric' } },
                  }}
                  initialView={compact ? 'listWeek' : 'dayGridMonth'}
                  // 统一 24 小时制 HH:mm（与全站时间格式一致）：默认格式整点省分钟，
                  // 同一格里中文混排「9:30」与「10时」，英文是「9:30a」「12a」
                  eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                  height="auto"
                  editable
                  selectable
                  selectMirror
                  dayMaxEvents={3}
                  weekends={weekends}
                  events={fetchEvents}
                  select={handleSelect}
                  eventChange={handleChange}
                  eventClick={handleClick}
                />
              )}
            </div>
          </Card>
        </Col>
      </Row>
      <Modal
        open={!!viewing}
        title={viewing?.title}
        onCancel={() => setViewing(undefined)}
        destroyOnHidden
        footer={[
          <Popconfirm
            key="delete"
            title={t('calendar.deleteConfirm', { title: viewing?.title ?? '' })}
            okButtonProps={{ danger: true }}
            onConfirm={handleDelete}
          >
            <Button danger>{t('common.delete')}</Button>
          </Popconfirm>,
          <Button key="close" type="primary" onClick={() => setViewing(undefined)}>
            {t('common.confirm')}
          </Button>,
        ]}
      >
        {viewing && (
          <div className="flex flex-col gap-2">
            <Badge
              color={chart.color(EVENT_COLOR[viewing.extendedProps.type as EventType])}
              text={enums.label('eventType', viewing.extendedProps.type as EventType)}
            />
            <Typography.Text type="secondary">{describeTime(viewing, t('calendar.allDay'))}</Typography.Text>
          </div>
        )}
      </Modal>
      <Modal
        title={t('calendar.newEvent')}
        open={!!draft}
        onOk={handleCreateSafe}
        onCancel={() => setDraft(undefined)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="title" label={t('calendar.title')} rules={[{ required: true, whitespace: true }]}>
            <Input placeholder={t('calendar.titlePlaceholder')} onPressEnter={handleCreateSafe} />
          </Form.Item>
          <Form.Item name="type" label={t('calendar.type')} rules={[{ required: true }]}>
            <Select options={enums.options('eventType', EVENT_TYPE_KEYS)} />
          </Form.Item>
        </Form>
      </Modal>
    </DemoPage>
  );
}
