import { apiClient } from '../../shared/api/client';
import type { AuthResponse } from '../../shared/api/types';

type AuthPayload = { email: string; password: string };

export async function login(payload: AuthPayload): Promise<AuthResponse> {
  const { data } = await apiClient.POST('/auth/login', { body: payload });
  return data!;
}

export async function register(payload: AuthPayload): Promise<AuthResponse> {
  const { data } = await apiClient.POST('/auth/register', { body: payload });
  return data!;
}
