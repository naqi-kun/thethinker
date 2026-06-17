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

// Exchanges a Google OAuth code for an app session. Signs the user in (creating
// their account on first use) and connects/syncs their Google Calendar.
export async function loginWithGoogle(
  code: string,
  redirectUri: string,
): Promise<AuthResponse> {
  const { data } = await apiClient.POST('/auth/google', {
    body: { code, redirect_uri: redirectUri },
  });
  return data!;
}
