import { apiClient } from '../../shared/api/client';
import type { CalendarConnection } from '../../shared/api/types';

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
