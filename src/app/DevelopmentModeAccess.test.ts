import { describe, expect, it, vi } from 'vitest';
import {
  DEVELOPMENT_MODE_AUTH_PATH,
  authorizeDevelopmentMode,
  type DevelopmentModeAuthFetch,
} from './DevelopmentModeAccess';

describe('Development Mode authorization', () => {
  it('exchanges the Development Pass for a short-lived session without using API-token headers', async () => {
    const sessionToken = 'wmd1.payload.signature';
    const fetcher = vi.fn<DevelopmentModeAuthFetch>(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ success: true, sessionToken }) }));

    await expect(authorizeDevelopmentMode('admin-pass', fetcher)).resolves.toBe(sessionToken);

    expect(fetcher).toHaveBeenCalledWith(DEVELOPMENT_MODE_AUTH_PATH, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'X-WebMUGEN-Development-Pass': 'admin-pass',
      }),
      body: '{}',
    }));
    const request = fetcher.mock.calls[0]?.[1];
    expect(request?.headers).not.toHaveProperty('Authorization');
    expect(request?.headers).not.toHaveProperty('X-WebMUGEN-Token');
    expect(DEVELOPMENT_MODE_AUTH_PATH).not.toContain('admin-pass');
  });

  it('rejects an authorization response that does not issue a Development session', async () => {
    const fetcher = vi.fn<DevelopmentModeAuthFetch>(async () => ({ ok: true, status: 200, text: async () => '{"success":true}' }));
    await expect(authorizeDevelopmentMode('admin-pass', fetcher)).rejects.toMatchObject({ status: 500 });
  });

  it('reports rejected credentials without including the entered Pass in the error', async () => {
    const fetcher = vi.fn<DevelopmentModeAuthFetch>(async () => ({
      ok: false,
      status: 401,
      text: async () => '{"success":false,"error":{"code":"auth.failed","message":"Authorization failed."}}',
    }));

    await expect(authorizeDevelopmentMode('secret-value', fetcher)).rejects.toMatchObject({ status: 401 });
    await expect(authorizeDevelopmentMode('secret-value', fetcher)).rejects.not.toThrow('secret-value');
  });
});
