import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { token } from './token';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const t = token.get();
    if (t) request.headers.set('Authorization', `Bearer ${t}`);
    return request;
  },
};

const errorMiddleware: Middleware = {
  async onResponse({ response }) {
    if (!response.ok) {
      if (response.status === 401) {
        token.clear();
        window.location.href = '/login';
        return;
      }
      const body = await response
        .clone()
        .json()
        .catch(() => ({})) as { code?: string; message?: string };
      throw new ApiError(
        response.status,
        body.code ?? 'UNKNOWN',
        body.message ?? 'Something went wrong',
      );
    }
  },
};

export const apiClient = createClient<paths>({ baseUrl: '/api' });
apiClient.use(authMiddleware);
apiClient.use(errorMiddleware);
