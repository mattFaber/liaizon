import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyIdToken, createSessionTokenFromIdToken, verifySessionToken, getAuthCookieOptions } =
	vi.hoisted(() => ({
		verifyIdToken: vi.fn(),
		createSessionTokenFromIdToken: vi.fn(),
		verifySessionToken: vi.fn(),
		getAuthCookieOptions: vi.fn(() => ({
			httpOnly: true,
			path: '/',
			sameSite: 'lax',
			secure: false,
			maxAge: 604800
		}))
	}));

vi.mock('$server/auth', () => ({
	AUTH_COOKIE_NAME: 'session_token',
	COMPANY_COOKIE_NAME: 'company_id',
	verifyIdToken,
	createSessionTokenFromIdToken,
	verifySessionToken,
	getAuthCookieOptions
}));

vi.mock('$lib/logging', () => ({
	log: vi.fn(),
	logError: vi.fn()
}));

vi.mock('$lib/env/server', () => ({
	serverEnv: {
		authBootstrapEnabled: false,
		authBootstrapIdToken: undefined,
		authBootstrapSessionCookie: undefined,
		authBootstrapCompanyId: 'demo-company'
	}
}));

import { actions, load } from './+page.server';
import { serverEnv } from '$lib/env/server';

function makeEvent(formData: FormData) {
	const set = vi.fn();

	return {
		event: {
			request: new Request('http://localhost/auth', {
				method: 'POST',
				body: formData
			}),
			cookies: {
				set
			}
		},
		set
	};
}

describe('auth load', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		serverEnv.authBootstrapEnabled = false;
		serverEnv.authBootstrapIdToken = undefined;
		serverEnv.authBootstrapSessionCookie = undefined;
		serverEnv.authBootstrapCompanyId = 'demo-company';
	});

	it('returns bootstrap metadata when disabled', async () => {
		serverEnv.authBootstrapEnabled = false;

		const result = await load({ cookies: { get: vi.fn(), set: vi.fn() } } as any);

		expect(result).toEqual({
			engineerAuthConfigured: false,
			configuredCompanyId: 'demo-company',
			bootstrapError: null
		});
	});

	it('bootstraps auth from env and redirects', async () => {
		serverEnv.authBootstrapEnabled = true;
		serverEnv.authBootstrapIdToken = 'token_from_env';
		serverEnv.authBootstrapCompanyId = 'company_env';
		verifyIdToken.mockResolvedValue({ uid: 'u1' });
		createSessionTokenFromIdToken.mockResolvedValue('session_cookie_from_id_token');
		const set = vi.fn();

		await expect(load({ cookies: { get: vi.fn(), set } } as any)).rejects.toMatchObject({
			status: 303,
			location: '/recruiter'
		});

		expect(verifyIdToken).toHaveBeenCalledWith('token_from_env');
		expect(set).toHaveBeenCalledWith(
			'session_token',
			'session_cookie_from_id_token',
			expect.objectContaining({ httpOnly: true, path: '/' })
		);
		expect(set).toHaveBeenCalledWith(
			'company_id',
			'company_env',
			expect.objectContaining({ httpOnly: true, path: '/' })
		);
	});

	it('uses env session cookie directly when provided', async () => {
		serverEnv.authBootstrapEnabled = true;
		serverEnv.authBootstrapSessionCookie = 'session_cookie_from_env';
		serverEnv.authBootstrapCompanyId = 'company_env';
		verifySessionToken.mockResolvedValue({ uid: 'u1' });
		const set = vi.fn();

		await expect(load({ cookies: { get: vi.fn(), set } } as any)).rejects.toMatchObject({
			status: 303,
			location: '/recruiter'
		});

		expect(verifySessionToken).toHaveBeenCalledWith('session_cookie_from_env');
		expect(verifyIdToken).not.toHaveBeenCalled();
		expect(createSessionTokenFromIdToken).not.toHaveBeenCalled();
		expect(set).toHaveBeenCalledWith(
			'session_token',
			'session_cookie_from_env',
			expect.objectContaining({ httpOnly: true, path: '/' })
		);
	});

	it('returns load error when bootstrap credentials are missing', async () => {
		serverEnv.authBootstrapEnabled = true;
		serverEnv.authBootstrapIdToken = undefined;
		serverEnv.authBootstrapSessionCookie = undefined;
		serverEnv.authBootstrapCompanyId = 'company_env';

		const result = await load({ cookies: { get: vi.fn(), set: vi.fn() } } as any);

		expect(result).toEqual({
			engineerAuthConfigured: true,
			configuredCompanyId: 'company_env',
			bootstrapError:
				'AUTH_BOOTSTRAP_ENABLED is true but neither AUTH_BOOTSTRAP_SESSION_COOKIE nor AUTH_BOOTSTRAP_ID_TOKEN is configured.'
		});
	});

	it('returns load error when bootstrap credentials are invalid', async () => {
		serverEnv.authBootstrapEnabled = true;
		serverEnv.authBootstrapIdToken = 'invalid_token';
		serverEnv.authBootstrapCompanyId = 'company_env';
		verifyIdToken.mockRejectedValue(new Error('invalid token'));

		const result = await load({ cookies: { get: vi.fn(), set: vi.fn() } } as any);

		expect(result).toEqual({
			engineerAuthConfigured: true,
			configuredCompanyId: 'company_env',
			bootstrapError:
				'Configured auth bootstrap credentials are invalid. Check AUTH_BOOTSTRAP_SESSION_COOKIE or AUTH_BOOTSTRAP_ID_TOKEN.'
		});
	});
});

describe('auth action', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		serverEnv.authBootstrapEnabled = false;
		serverEnv.authBootstrapIdToken = undefined;
		serverEnv.authBootstrapSessionCookie = undefined;
		serverEnv.authBootstrapCompanyId = 'demo-company';
	});

	it('uses form token and company id when bootstrap is disabled', async () => {
		verifyIdToken.mockResolvedValue({ uid: 'u1', companyId: 'company_1' });
		createSessionTokenFromIdToken.mockResolvedValue('session_cookie_from_form');

		const formData = new FormData();
		formData.append('idToken', 'token_from_form');
		formData.append('companyId', 'company_1');
		const { event, set } = makeEvent(formData);

		await expect(actions.default(event as any)).rejects.toMatchObject({
			status: 303,
			location: '/recruiter'
		});

		expect(verifyIdToken).toHaveBeenCalledWith('token_from_form');
		expect(set).toHaveBeenCalledWith(
			'session_token',
			'session_cookie_from_form',
			expect.objectContaining({ httpOnly: true, path: '/' })
		);
		expect(set).toHaveBeenCalledWith(
			'company_id',
			'company_1',
			expect.objectContaining({ httpOnly: true, path: '/' })
		);
	});

	it('uses env token and company when bootstrap is enabled', async () => {
		serverEnv.authBootstrapEnabled = true;
		serverEnv.authBootstrapIdToken = 'token_from_env';
		serverEnv.authBootstrapCompanyId = 'company_env';
		verifyIdToken.mockResolvedValue({ uid: 'u1', companyId: 'company_env' });
		createSessionTokenFromIdToken.mockResolvedValue('session_cookie_from_env_id_token');

		const { event, set } = makeEvent(new FormData());

		await expect(actions.default(event as any)).rejects.toMatchObject({
			status: 303,
			location: '/recruiter'
		});

		expect(verifyIdToken).toHaveBeenCalledWith('token_from_env');
		expect(set).toHaveBeenCalledWith(
			'session_token',
			'session_cookie_from_env_id_token',
			expect.objectContaining({ httpOnly: true, path: '/' })
		);
		expect(set).toHaveBeenCalledWith(
			'company_id',
			'company_env',
			expect.objectContaining({ httpOnly: true, path: '/' })
		);
	});

	it('returns 500 when bootstrap is enabled without configured env token', async () => {
		serverEnv.authBootstrapEnabled = true;
		serverEnv.authBootstrapIdToken = undefined;
		serverEnv.authBootstrapSessionCookie = undefined;

		const { event } = makeEvent(new FormData());
		const result = await actions.default(event as any);

		expect(result).toMatchObject({
			status: 500,
			data: {
				error:
					'AUTH_BOOTSTRAP_ENABLED is true but neither AUTH_BOOTSTRAP_SESSION_COOKIE nor AUTH_BOOTSTRAP_ID_TOKEN is configured.'
			}
		});
		expect(verifyIdToken).not.toHaveBeenCalled();
	});
});
