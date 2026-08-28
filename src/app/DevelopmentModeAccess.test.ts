import { describe, expect, it, vi } from 'vitest';
import {
  DEVELOPMENT_MODE_AUTH_PATH,
  DevelopmentModeAuthorizationError,
  authorizeDevelopmentMode,
} from './DevelopmentModeAccess';

describe('Development Mode authorization', () => {
  it('authenticates with the existing server-side Catalog credential without putting it in the URL or body', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, text: async () => '{"success":true}' }));

    await authorizeDevelopmentMode('admin-pass', fetcher);

    expect(fetcher).toHaveBeenCalledWith(DEVELOPMENT_MODE_AUTH_PATH, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer admin-pass',
        'X-WebMUGEN-Token': 'admin-pass',
      }),
      body: '{}',
    }));
    expect(DEVELOPMENT_MODE_AUTH_PATH).not.toContain('admin-pass');
  });

  it('reports rejected credentials without including the entered Pass in the error', async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => '{"success":false,"error":{"code":"auth.failed","message":"Authorization failed."}}',
    }));

    await expect(authorizeDevelopmentMode('secret-value', fetcher)).rejects.toMatchObject<DevelopmentModeAuthorizationError>({ status: 401 });
    await expect(authorizeDevelopmentMode('secret-value', fetcher)).rejects.not.toThrow('secret-value');
  });
});
