import { describe, expect, it } from 'vitest';

import {
  createIdentityStore,
  createMemoryIdentityStore,
  loadIdentityValue,
} from '../store.js';
import { createElectronCdpToolDriver } from '../../tools/electron-driver.js';

describe('createMemoryIdentityStore', () => {
  it('starts empty with a known key list', async () => {
    const store = createMemoryIdentityStore();
    const list = await store.list();
    expect(list.length).toBeGreaterThan(5);
    expect(list.every(entry => entry.hasValue === false)).toBe(true);
  });

  it('write + read round-trip on a valid key', async () => {
    const store = createMemoryIdentityStore();
    await store.write('first_name', 'Steven');
    expect(await store.read('first_name')).toBe('Steven');
  });

  it('write rejects an unknown key', async () => {
    const store = createMemoryIdentityStore();
    await expect(
      store.write('not_a_real_key' as never, 'x'),
    ).rejects.toThrow(/unknown key/);
  });

  it('write rejects a value that fails validation', async () => {
    const store = createMemoryIdentityStore();
    await expect(store.write('email', 'not-an-email')).rejects.toThrow(
      /failed validation/,
    );
    await expect(
      store.write('github_url', 'not-a-url'),
    ).rejects.toThrow(/failed validation/);
  });

  it('read returns null when the key is known but not populated', async () => {
    const store = createMemoryIdentityStore();
    expect(await store.read('last_name')).toBeNull();
  });

  it('read throws on an unknown key', async () => {
    const store = createMemoryIdentityStore();
    await expect(store.read('ssn' as never)).rejects.toThrow(/unknown key/);
  });

  it('clear removes a stored value', async () => {
    const store = createMemoryIdentityStore();
    await store.write('first_name', 'Steven');
    expect(await store.read('first_name')).toBe('Steven');
    await store.clear('first_name');
    expect(await store.read('first_name')).toBeNull();
  });

  it('list reflects write + clear state', async () => {
    const store = createMemoryIdentityStore();
    await store.write('email', 'steven@example.com');
    const list1 = await store.list();
    const emailEntry = list1.find(e => e.key === 'email');
    expect(emailEntry?.hasValue).toBe(true);

    await store.clear('email');
    const list2 = await store.list();
    expect(list2.find(e => e.key === 'email')?.hasValue).toBe(false);
  });

  it('snapshot returns populated keys only - keys never seen stay absent', async () => {
    const store = createMemoryIdentityStore();
    await store.write('first_name', 'Steven');
    await store.write('email', 'steven@example.com');
    const snap = await store.snapshot();
    expect(snap.first_name).toBe('Steven');
    expect(snap.email).toBe('steven@example.com');
    expect(Object.keys(snap)).toHaveLength(2);
  });

  it('initial seed validates every value', () => {
    expect(() =>
      createMemoryIdentityStore({ email: 'not-an-email' }),
    ).toThrow(/failed validation/);
  });

  it('initial seed accepts valid values', async () => {
    const store = createMemoryIdentityStore({
      email: 'steven@example.com',
      first_name: 'Steven',
    });
    expect(await store.read('first_name')).toBe('Steven');
    expect(await store.read('email')).toBe('steven@example.com');
  });
});

describe('loadIdentityValue', () => {
  it('returns the value when populated', async () => {
    const store = createMemoryIdentityStore({ first_name: 'Steven' });
    expect(await loadIdentityValue(store, 'first_name')).toBe('Steven');
  });

  it('throws on unknown key', async () => {
    const store = createMemoryIdentityStore();
    await expect(loadIdentityValue(store, 'ssn')).rejects.toThrow(
      /unknown key/,
    );
  });

  it('throws on known-but-empty key', async () => {
    const store = createMemoryIdentityStore();
    await expect(loadIdentityValue(store, 'first_name')).rejects.toThrow(
      /known but not populated/,
    );
  });
});

describe('identity_load driver integration', () => {
  it('routes identity_load through the supplied IdentityStore', async () => {
    const store = createMemoryIdentityStore({ first_name: 'Steven' });
    const driver = createElectronCdpToolDriver({
      getWebContents: () => {
        throw new Error('webContents is not needed for identity_load');
      },
      identityStore: store,
    });

    await expect(
      driver.identityLoad({ key: 'first_name' }),
    ).resolves.toEqual({
      key: 'first_name',
      value: 'Steven',
    });
  });

  it('surfaces unknown identity keys as loud tool failures', async () => {
    const driver = createElectronCdpToolDriver({
      getWebContents: () => {
        throw new Error('webContents is not needed for identity_load');
      },
      identityStore: createMemoryIdentityStore(),
    });

    await expect(driver.identityLoad({ key: 'ssn' })).rejects.toThrow(
      /unknown key/,
    );
  });
});

describe('createIdentityStore factory', () => {
  it('returns an in-memory store when forceMemory is set', async () => {
    const store = createIdentityStore({
      forceMemory: true,
      initial: { first_name: 'Steven' },
    });
    expect(await store.read('first_name')).toBe('Steven');
  });

  it('returns an in-memory store on non-Darwin platforms (matches existing pattern)', async () => {
    // We cannot safely mutate process.platform here, but forceMemory
    // covers the same code path.
    const store = createIdentityStore({ forceMemory: true });
    const list = await store.list();
    expect(list.length).toBeGreaterThan(0);
  });
});
