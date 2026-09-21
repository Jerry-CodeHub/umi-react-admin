import { ProCard } from '@ant-design/pro-components';
import { DateSelectArg, EventApi, EventClickArg, EventContentArg } from '@fullcalendar/core';
import zhLocale from '@fullcalendar/core/locales/zh-cn';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import multiMonthPlugin from '@fullcalendar/multimonth';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useIntl } from '@umijs/max';
import { App, Checkbox, Input, List, Modal, Typography } from 'antd';
import { useState } from 'react';

import { INITIAL_EVENTS, createEventId } from './event-utils';

function renderEventContent(eventContent: EventContentArg) {
  return (
    <>
      <b>{eventContent.timeText}</b>
      <i>{eventContent.event.title}</i>
    </>
  );
}

export default () => {
  const intl = useIntl();
  // App 上下文中的 modal：随主题算法（暗色）渲染，静态 Modal.confirm 无法消费动态主题
  const { modal } = App.useApp();
  const dateFormatter = new Intl.DateTimeFormat(intl.locale, { year: 'numeric', month: 'short', day: 'numeric' });
  const [state, setState] = useState({
    weekendsVisible: true,
    currentEvents: [] as EventApi[],
  });
  // 新建事件弹窗状态（替代 window.prompt 阻塞式交互）
  const [createState, setCreateState] = useState<{
    open: boolean;
    title: string;
    selectInfo: DateSelectArg | null;
  }>({ open: false, title: '', selectInfo: null });

  const handleWeekendsToggle = () => {
    setState((prevState) => ({
      ...prevState,
      weekendsVisible: !prevState.weekendsVisible,
    }));
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    // 清除日期选中状态，避免多次触发选中高亮；暂存选区并弹窗收集标题
    selectInfo.view.calendar.unselect();
    setCreateState({ open: true, title: '', selectInfo });
  };

  const handleCreateOk = () => {
    const title = createState.title.trim();
    const selectInfo = createState.selectInfo;
    if (title && selectInfo) {
      selectInfo.view.calendar.addEvent({
        id: createEventId(),
        title,
        start: selectInfo.startStr,
        end: selectInfo.endStr,
        allDay: selectInfo.allDay,
      });
    }
    setCreateState({ open: false, title: '', selectInfo: null });
  };

  const closeCreate = () => {
    setCreateState({ open: false, title: '', selectInfo: null });
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    // 替代 window.confirm 阻塞式交互
    modal.confirm({
      title: `确认删除事件「${clickInfo.event.title}」？`,
      onOk: () => {
        clickInfo.event.remove();
      },
    });
  };

  const handleEvents = (events: EventApi[]) => {
    setState((prevState) => ({
      ...prevState,
      currentEvents: events,
    }));
  };

  return (
    <ProCard className="shadow-2xl">
      <div className="flex flex-col gap-4 xl:flex-row">
        {/* 侧栏：AntD 组件化（原 demo-app* 样式类在仓库中从未定义，渲染为裸样式） */}
        <div className="shrink-0 space-y-3 xl:w-72">
          <Typography.Paragraph type="secondary">
            选择日期创建新事件；支持拖放与调整事件大小；单击事件可删除。
          </Typography.Paragraph>
          <Checkbox checked={state.weekendsVisible} onChange={handleWeekendsToggle}>
            切换周末
          </Checkbox>
          <Typography.Title level={5}>所有事件 ({state.currentEvents.length})</Typography.Title>
          <List
            size="small"
            dataSource={state.currentEvents}
            renderItem={(event) => (
              <List.Item>
                <b>{event.start ? dateFormatter.format(event.start) : ''}</b>
                <i className="ml-2">{event.title}</i>
              </List.Item>
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <FullCalendar
            // 英文用 FullCalendar 内置的 en（美式日期、周日起始），中文用 zh-cn
            locale={intl.locale === 'en-US' ? 'en' : zhLocale}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, multiMonthPlugin]}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay',
            }}
            initialView="dayGridMonth"
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={state.weekendsVisible}
            // 使用静态初始事件；也可改为 events 属性从远程接口拉取
            initialEvents={INITIAL_EVENTS}
            select={handleDateSelect}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            // 事件初始化/添加/更改/删除后均会触发，用于同步侧边栏事件列表
            eventsSet={handleEvents}
          />
        </div>
      </div>

      <Modal
        title="新建事件"
        open={createState.open}
        onOk={handleCreateOk}
        onCancel={closeCreate}
        okButtonProps={{ disabled: !createState.title.trim() }}
        destroyOnClose
      >
        <Input
          placeholder="请输入事件标题"
          value={createState.title}
          onChange={(e) => setCreateState((prev) => ({ ...prev, title: e.target.value }))}
          onPressEnter={handleCreateOk}
        />
      </Modal>
    </ProCard>
  );
};
