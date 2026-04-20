import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyIdToken, createSessionTokenFromIdToken, getAuthCookieOptions } = vi.hoisted(() => ({
	verifyIdToken: vi.fn(),
	createSessionTokenFromIdToken: vi.fn(),
	getAuthCookieOptions: vi.fn(() => ({
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: false,
		maxAge: 604800
	}))
}));

const { provisionUserWorkspace } = vi.hoisted(() => ({
	provisionUserWorkspace: vi.fn()
}));

vi.mock('$server/auth', () => ({
	AUTH_COOKIE_NAME: 'session_token',
	COMPANY_COOKIE_NAME: 'company_id',
	verifyIdToken,
	createSessionTokenFromIdToken,
	getAuthCookieOptions
}));

vi.mock('$server/user-workspace', () => ({
	provisionUserWorkspace
}));

vi.mock('$lib/logging', () => ({
	log: vi.fn(),
	logError: vi.fn()
}));

vi.mock('$lib/env/server', () => ({
	serverEnv: {
		nodeEnv: 'test'
	}
}));

import { actions, load } from './+page.server';

describe('auth +page.server', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe('load', () => {
		it('returns empty object when not authenticated', async () => {
			const result = await load({ locals: { user: null } } as any);
			expect(result).toEqual({});
		});

		it('redirects to /recruiter when already authenticated', async () => {
			const locals = { user: { uid: 'test-user', email: 'test@example.com' } };

			await expect(load({ locals } as any)).rejects.toMatchObject({
				status: 303,
				location: '/recruiter'
			});
		});
	});

	describe('actions.default', () => {
		it('verifies token, provisions workspace, and sets cookies', async () => {
			verifyIdToken.mockResolvedValue({
				uid: 'user123',
				email: 'user@example.com'
			});
			createSessionTokenFromIdToken.mockResolvedValue('session_cookie_abc123');
			provisionUserWorkspace.mockResolvedValue('personal__user123');

			const set = vi.fn();
			const formData = new FormData();
			formData.append('idToken', 'id_token_xyz');

			await expect(
				actions.default({
					request: new Request('http://localhost/auth', {
						method: 'POST',
						body: formData
					}),
					cookies: { set }
				} as any)
			).rejects.toMatchObject({
				status: 303,
				location: '/recruiter'
			});

			expect(verifyIdToken).toHaveBeenCalledWith('id_token_xyz');
			expect(createSessionTokenFromIdToken).toHaveBeenCalledWith('id_token_xyz');
			expect(provisionUserWorkspace).toHaveBeenCalledWith({
				uid: 'user123',
				email: 'user@example.com'
			});
			expect(set).toHaveBeenCalledWith(
				'session_token',
				'session_cookie_abc123',
				expect.objectContaining({ httpOnly: true, path: '/' })
			);
			expect(set).toHaveBeenCalledWith(
				'company_id',
				'personal__user123',
				expect.objectContaining({ httpOnly: true, path: '/' })
			);
		});

		it('returns 400 when idToken is missing', async () => {
			const set = vi.fn();
			const formData = new FormData();

			const result = await actions.default({
				request: new Request('http://localhost/auth', {
					method: 'POST',
					body: formData
				}),
				cookies: { set }
			} as any);

			expect(result).toMatchObject({
				status: 400,
				data: { error: 'A Firebase ID token is required.' }
			});
			expect(verifyIdToken).not.toHaveBeenCalled();
		});

		it('returns 401 when token verification fails', async () => {
			verifyIdToken.mockRejectedValue(new Error('Invalid token'));

			const set = vi.fn();
			const formData = new FormData();
			formData.append('idToken', 'invalid_token');

			const result = await actions.default({
				request: new Request('http://localhost/auth', {
					method: 'POST',
					body: formData
				}),
				cookies: { set }
			} as any);

			expect(result).toMatchObject({
				status: 401,
				data: { error: 'Invalid Firebase ID token.' }
			});
		});
	});
});
