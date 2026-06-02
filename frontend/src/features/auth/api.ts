import { apiRequest } from '../../shared/api/httpClient';
import type { AuthResponse } from '../../shared/api/types';

type AuthPayload = { email: string; password: string };

export function login(payload: AuthPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: payload });
}

export function register(payload: AuthPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: payload });
}
