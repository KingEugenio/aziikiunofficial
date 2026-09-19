import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

describe('supabaseClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not crash during import when the browser env vars are missing', async () => {
    const mod = await import('./supabaseClient');
    expect(mod.supabaseConfigured).toBe(false);
    expect(mod.supabase).toBeTruthy();
  });
});
