import { datadogRum } from '@datadog/browser-rum';

export function initTelemetry() {
  const applicationId = import.meta.env.VITE_DD_APPLICATION_ID;
  const clientToken = import.meta.env.VITE_DD_CLIENT_TOKEN;

  if (!applicationId || !clientToken) return;

  datadogRum.init({
    applicationId,
    clientToken,
    site: (import.meta.env.VITE_DD_SITE as string) ?? 'datadoghq.com',
    service: 'thethinker-frontend',
    env: import.meta.env.MODE,
    version: '0.1.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
  });
}
