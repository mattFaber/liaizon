import { afterEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted(() => ({
	LOG_LEVEL: undefined as string | undefined
}));

vi.mock('$env/dynamic/private', () => ({
	env: privateEnv
}));

import { getServerEnv } from './server';

describe('getServerEnv', () => {
	afterEach(() => {
		privateEnv.LOG_LEVEL = undefined;
	});

	it('parses LOG_LEVEL environment variable', () => {
		privateEnv.LOG_LEVEL = 'debug';
		expect(getServerEnv().logLevel).toBe('debug');
	});

	it('defaults LOG_LEVEL to info', () => {
		expect(getServerEnv().logLevel).toBe('info');
	});
});
