import { apiClient } from '../../shared/api/client';
import type {
  Calendar,
  CalendarConnection,
  CalendarEvent,
} from '../../shared/api/types';

export async function listCalendars(): Promise<Calendar[]> {
  const { data } = await apiClient.GET('/calendars');
  return data ?? [];
}

export async function addCalendar(name: string, icsUrl: string): Promise<Calendar> {
  const { data } = await apiClient.POST('/calendars', {
    body: { name, ics_url: icsUrl },
  });
  return data!;
}

export async function removeCalendar(id: string): Promise<void> {
  await apiClient.DELETE('/calendars/{id}', {
    params: { path: { id } },
  });
}

// Re-fetches a calendar's events from its source (Google API or ICS feed).
export async function syncCalendar(id: string): Promise<Calendar> {
  const { data } = await apiClient.POST('/calendars/{id}/sync', {
    params: { path: { id } },
  });
  return data!;
}

// Re-fetch every connected calendar from its source, returning the (best-effort)
// refreshed calendars. Per-calendar failures are swallowed and the original is
// kept, so a flaky feed never breaks a passive on-open refresh. Callers re-fetch
// events afterward to pick up the new snapshot.
export async function resyncAllCalendars(): Promise<Calendar[]> {
  const cals = await listCalendars();
  const results = await Promise.allSettled(cals.map((c) => syncCalendar(c.id)));
  return cals.map((c, i) => {
    const r = results[i];
    return r.status === 'fulfilled' ? r.value : c;
  });
}

export async function getTodayEvents(): Promise<CalendarEvent[]> {
  const { data } = await apiClient.GET('/calendars/events');
  return data ?? [];
}

export async function ignoreEvent(id: string): Promise<void> {
  await apiClient.POST('/calendars/events/{id}/ignore', {
    params: { path: { id } },
  });
}

export async function unignoreEvent(id: string): Promise<void> {
  await apiClient.DELETE('/calendars/events/{id}/ignore', {
    params: { path: { id } },
  });
}

// Legacy OAuth connect/disconnect — not yet implemented end-to-end.
export async function connectCalendar(
  provider: 'google' | 'apple',
  authCode: string,
): Promise<CalendarConnection> {
  const { data } = await apiClient.POST('/calendar/connect', {
    body: { provider, auth_code: authCode },
  });
  return data!;
}

export async function disconnectCalendar(): Promise<void> {
  await apiClient.DELETE('/calendar/disconnect');
}
