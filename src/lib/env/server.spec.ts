import { describe, expect, it } from 'vitest';
import { getServerEnv } from './server';

describe('getServerEnv', () => {
	it('parses AUTH_BOOTSTRAP_ENABLED=false as false', () => {
		const originalEnv = process.env;
		process.env = {
			...originalEnv,
			AUTH_BOOTSTRAP_ENABLED: 'false'
		};

		try {
			expect(getServerEnv().authBootstrapEnabled).toBe(false);
		} finally {
			process.env = originalEnv;
		}
	});

	it('parses AUTH_BOOTSTRAP_ENABLED=true as true', () => {
		const originalEnv = process.env;
		process.env = {
			...originalEnv,
			AUTH_BOOTSTRAP_ENABLED: 'true'
		};

		try {
			expect(getServerEnv().authBootstrapEnabled).toBe(true);
		} finally {
			process.env = originalEnv;
		}
	});
});