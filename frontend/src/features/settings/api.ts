import { apiClient } from '../../shared/api/client';
import type { WorkSchedule } from '../../shared/api/types';

export async function getWorkSchedule(): Promise<WorkSchedule> {
  const { data } = await apiClient.GET('/users/me/work-schedule');
  return data!;
}

export async function updateWorkSchedule(
  schedule: WorkSchedule,
): Promise<WorkSchedule> {
  const { data } = await apiClient.PUT('/users/me/work-schedule', {
    body: schedule,
  });
  return data!;
}
