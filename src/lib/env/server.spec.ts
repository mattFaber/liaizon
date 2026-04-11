import { afterEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted(() => ({
	AUTH_BOOTSTRAP_ENABLED: undefined as string | undefined
}));

vi.mock('$env/dynamic/private', () => ({
	env: privateEnv
}));

import { getServerEnv } from './server';

describe('getServerEnv', () => {
	afterEach(() => {
		privateEnv.AUTH_BOOTSTRAP_ENABLED = undefined;
	});

	it('parses AUTH_BOOTSTRAP_ENABLED=false as false', () => {
		privateEnv.AUTH_BOOTSTRAP_ENABLED = 'false';

		expect(getServerEnv().authBootstrapEnabled).toBe(false);
	});

	it('parses AUTH_BOOTSTRAP_ENABLED=true as true', () => {
		privateEnv.AUTH_BOOTSTRAP_ENABLED = 'true';

		expect(getServerEnv().authBootstrapEnabled).toBe(true);
	});
});
