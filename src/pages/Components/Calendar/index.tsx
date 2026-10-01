import DemoPage from '@/components/DemoPage';
import { EVENT_TYPE_KEYS } from '@/constants/enums';
import type { PresetColor } from '@/constants/semantic';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useEnums } from '@/hooks/useEnums';
import { createEvent, deleteEvent, listEvents, updateEvent } from '@/services/events';
import type { CalendarEvent, EventType } from '@/services/types';
import { formatDateTime } from '@/utils/format';
import FullCalendar, {
  type DateSelectInfo,
  type EventChangeInfo,
  type EventClickInfo,
  type EventInput,
  type EventSourceFuncInfo,
} from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import zhLocale from '@fullcalendar/react/locales/zh-cn';
import multiMonthPlugin from '@fullcalendar/react/multimonth';
import classicTheme from '@fullcalendar/react/themes/classic';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import { useIntl } from '@umijs/max';
import { App, Badge, Card, Checkbox, Col, Form, Input, List, Modal, Row, Select, Typography } from 'antd';
import { useCallback, useState } from 'react';

import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/palette.css';
import '@fullcalendar/react/themes/classic/theme.css';

/** 日程类型色：与全站分类色板一致 */
export const EVENT_COLOR: Record<EventType, PresetColor> = {
  duty: 'blue',
  inspection: 'green',
  review: 'purple',
  training: 'cyan',
  maintenance: 'orange',
  release: 'magenta',
};

type Draft = { start: string; end: string; allDay: boolean };

export default function Calendar() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string>) => intl.formatMessage({ id }, values);
  const enums = useEnums();
  const chart = useChartTheme();
  const { message, modal } = App.useApp();
  // 事件源函数的引用变化时 FullCalendar 会重新拉取：新建后递增 version 即可刷新
  const [version, setVersion] = useState(0);
  const [weekends, setWeekends] = useState(true);
  const [draft, setDraft] = useState<Draft>();
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([]);
  const [form] = Form.useForm<{ title: string; type: EventType }>();

  const toInput = (event: CalendarEvent): EventInput => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    color: chart.color(EVENT_COLOR[event.type]),
    extendedProps: { type: event.type },
  });

  /** 按视图范围向接口拉取日程；顺带刷新侧栏的「接下来」列表 */
  const fetchEvents = useCallback(
    async (info: EventSourceFuncInfo) => {
      const list = await listEvents(info.startStr, info.endStr);
      const now = Date.now();
      setUpcoming(
        list
          .filter((event) => new Date(event.start).getTime() >= now)
          .sort((a, b) => a.start.localeCompare(b.start))
          .slice(0, 6),
      );
      return list.map(toInput);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [version, chart],
  );

  const refetch = () => setVersion((v) => v + 1);

  const handleSelect = (info: DateSelectInfo) => {
    info.view.calendar.unselect();
    form.setFieldsValue({ title: '', type: 'inspection' });
    setDraft({ start: info.startStr, end: info.endStr, allDay: info.allDay });
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    await createEvent({ ...values, start: draft!.start, end: draft!.end, allDay: draft!.allDay });
    message.success(t('calendar.saved'));
    setDraft(undefined);
    refetch();
  };

  /** 拖动 / 拉伸改期：写回接口，失败则还原 */
  const handleChange = async ({ event, revert }: EventChangeInfo) => {
    try {
      await updateEvent(event.id, {
        start: event.start!.toISOString(),
        end: event.end?.toISOString(),
        allDay: event.allDay,
      });
      message.success(t('calendar.saved'));
    } catch {
      revert();
    }
  };

  const handleClick = ({ event }: EventClickInfo) => {
    modal.confirm({
      title: t('calendar.deleteConfirm', { title: event.title }),
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteEvent(event.id);
        event.remove();
      },
    });
  };

  return (
    <DemoPage descriptionId="page.calendar.desc" source="src/pages/Components/Calendar/index.tsx">
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={6}>
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
            <List
              size="small"
              dataSource={upcoming}
              locale={{ emptyText: t('calendar.noUpcoming') }}
              renderItem={(event) => (
                <List.Item className="px-0!">
                  <div className="min-w-0">
                    <Badge color={chart.color(EVENT_COLOR[event.type])} text={event.title} className="truncate" />
                    <Typography.Text type="secondary" className="block pl-3.5 text-xs">
                      {event.allDay
                        ? `${formatDateTime(event.start, 'MM-DD')} · ${t('calendar.allDay')}`
                        : formatDateTime(event.start, 'MM-DD HH:mm')}
                    </Typography.Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={18}>
          <Card>
            {/* v7 经典主题的调色板按祖先 [data-color-scheme] 切换暗色变量，与应用主题同源 */}
            <div data-color-scheme={chart.dark ? 'dark' : 'light'}>
              <FullCalendar
                locale={intl.locale === 'en-US' ? 'en' : zhLocale}
                plugins={[classicTheme, dayGridPlugin, timeGridPlugin, interactionPlugin, multiMonthPlugin]}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }}
                initialView="dayGridMonth"
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
            </div>
          </Card>
        </Col>
      </Row>
      <Modal
        title={t('calendar.newEvent')}
        open={!!draft}
        onOk={handleCreate}
        onCancel={() => setDraft(undefined)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="title" label={t('calendar.title')} rules={[{ required: true, whitespace: true }]}>
            <Input placeholder={t('calendar.titlePlaceholder')} onPressEnter={handleCreate} />
          </Form.Item>
          <Form.Item name="type" label={t('calendar.type')} rules={[{ required: true }]}>
            <Select options={enums.options('eventType', EVENT_TYPE_KEYS)} />
          </Form.Item>
        </Form>
      </Modal>
    </DemoPage>
  );
}
