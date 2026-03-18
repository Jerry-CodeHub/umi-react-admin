import { ProCard } from '@ant-design/pro-components';
import { DateSelectArg, EventApi, EventClickArg, EventContentArg, formatDate } from '@fullcalendar/core';
import zhLocale from '@fullcalendar/core/locales/zh-cn';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import multiMonthPlugin from '@fullcalendar/multimonth';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
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

function renderSidebarEvent(event: EventApi) {
  return (
    <li key={event.id}>
      <b>
        {formatDate(event.start!, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </b>
      <i>{event.title}</i>
    </li>
  );
}

export default () => {
  const [state, setState] = useState({
    weekendsVisible: true,
    currentEvents: [],
  });

  const handleWeekendsToggle = () => {
    setState({
      ...state,
      weekendsVisible: !state.weekendsVisible,
    });
  };

  const renderSidebar = () => {
    return (
      <div className="demo-app-sidebar">
        <div className="demo-app-sidebar-section">
          <h2>说明: </h2>
          <ul>
            <li>选择日期，系统将提示您创建一个新事件</li>
            <li>拖放和调整事件大小</li>
            <li>单击需要删除的事件</li>
          </ul>
        </div>
        <div className="demo-app-sidebar-section">
          <label>
            <input type="checkbox" checked={state.weekendsVisible} onChange={handleWeekendsToggle}></input>
            切换周末
          </label>
        </div>
        <div className="demo-app-sidebar-section">
          <h2>所有事件 ({state.currentEvents.length})</h2>
          <ul>{state.currentEvents.map(renderSidebarEvent)}</ul>
        </div>
      </div>
    );
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    let title = prompt('请为您的活动输入一个新标题');
    let calendarApi = selectInfo.view.calendar;

    // 清除日期选中状态，避免多次触发选中高亮
    calendarApi.unselect();

    if (title) {
      calendarApi.addEvent({
        id: createEventId(),
        title,
        start: selectInfo.startStr,
        end: selectInfo.endStr,
        allDay: selectInfo.allDay,
      });
    }
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    if (confirm(`您确定要删除事件吗 '${clickInfo.event.title}'`)) {
      clickInfo.event.remove();
    }
  };

  const handleEvents = (events: any) => {
    setState({
      ...state,
      currentEvents: events,
    });
  };

  return (
    <ProCard className="shadow-2xl">
      <div className="demo-app">
        <FullCalendar
          locale={zhLocale}
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
        <div className="shadow-2xl p-8 m-8">{renderSidebar()}</div>
      </div>
    </ProCard>
  );
};
