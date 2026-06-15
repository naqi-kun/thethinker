import { apiClient } from '../../shared/api/client';
import type { Preferences, UserProfile, WorkSchedule } from '../../shared/api/types';

export async function getProfile(): Promise<UserProfile> {
  const { data } = await apiClient.GET('/users/me');
  return data!;
}

export async function updateProfile(name: string): Promise<UserProfile> {
  const { data } = await apiClient.PUT('/users/me', { body: { name } });
  return data!;
}

export async function getPreferences(): Promise<Preferences> {
  const { data } = await apiClient.GET('/users/me/preferences');
  return data!;
}

export async function updatePreferences(prefs: Preferences): Promise<Preferences> {
  const { data } = await apiClient.PUT('/users/me/preferences', { body: prefs });
  return data!;
}

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
