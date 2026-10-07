import { api } from './client';
import type { CalendarEvent, CalendarEventInput } from './types';

export const listEvents = (from: string, to: string) =>
  api<CalendarEvent[]>('/api/v1/events', { method: 'GET', params: { from, to } });

export const createEvent = (input: CalendarEventInput) =>
  api<CalendarEvent>('/api/v1/events', { method: 'POST', data: input });

export const updateEvent = (id: string, input: Partial<CalendarEventInput>) =>
  api<CalendarEvent>(`/api/v1/events/${encodeURIComponent(id)}`, { method: 'PUT', data: input });

export const deleteEvent = (id: string) =>
  api<string>(`/api/v1/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
