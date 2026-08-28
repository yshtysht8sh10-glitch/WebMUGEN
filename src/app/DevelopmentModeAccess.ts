import { resolveApplicationAssetPath } from './ApplicationAssetPath';

export const DEVELOPMENT_MODE_AUTH_PATH = `${resolveApplicationAssetPath('api/catalog.php')}?action=authorize`;

type AuthorizationResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

export type DevelopmentModeAuthFetch = (input: string, init?: RequestInit) => Promise<AuthorizationResponse>;

export class DevelopmentModeAuthorizationError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DevelopmentModeAuthorizationError';
    this.status = status;
  }
}

export async function authorizeDevelopmentMode(
  password: string,
  fetcher: DevelopmentModeAuthFetch = fetch,
): Promise<void> {
  const credential = password.trim();
  if (!credential) throw new DevelopmentModeAuthorizationError('Pass is required.', 400);
  const response = await fetcher(DEVELOPMENT_MODE_AUTH_PATH, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credential}`,
      'X-WebMUGEN-Token': credential,
    },
    body: '{}',
  });
  const source = await response.text();
  const payload = parseResponse(source);
  if (!response.ok || payload.success !== true) {
    const error = isRecord(payload.error) ? payload.error : {};
    throw new DevelopmentModeAuthorizationError(
      typeof error.message === 'string' ? error.message : `HTTP ${response.status}`,
      response.status,
    );
  }
}

function parseResponse(source: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(source);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
