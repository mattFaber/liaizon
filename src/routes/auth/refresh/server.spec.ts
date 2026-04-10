import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$server/auth', () => ({
	AUTH_COOKIE_NAME: 'session_token',
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

vi.mock('$lib/logging', () => ({
	log: vi.fn(),
	logError: vi.fn()
}));

import { POST } from './+server';
import { createSessionTokenFromIdToken, verifyIdToken } from '$server/auth';

function makeEvent(overrides: Partial<any> = {}) {
	return {
		request: new Request('http://localhost/auth/refresh', {
			method: 'POST',
			body: new URLSearchParams({ idToken: 'header.payload.signature' })
		}),
		cookies: {
			set: vi.fn()
		},
		locals: {
			user: {
				uid: 'user_admin',
				email: 'admin@example.com',
				companyId: 'company_1',
				role: 'admin'
			}
		},
		...overrides
	} as any;
}

describe('auth refresh endpoint', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('rejects unauthenticated requests', async () => {
		const response = await POST(makeEvent({ locals: { user: null } }));
		expect(response.status).toBe(401);
	});

	it('refreshes session cookie for matching token user', async () => {
		vi.mocked(verifyIdToken).mockResolvedValue({
			uid: 'user_admin',
			email: 'admin@example.com',
			companyId: 'company_1',
			role: 'admin'
		});
		vi.mocked(createSessionTokenFromIdToken).mockResolvedValue('session_cookie_123');

		const event = makeEvent();
		const response = await POST(event);

		expect(response.status).toBe(200);
		expect(event.cookies.set).toHaveBeenCalledWith(
			'session_token',
			'session_cookie_123',
			expect.objectContaining({ maxAge: 604800 })
		);
	});

	it('rejects token user mismatch', async () => {
		vi.mocked(verifyIdToken).mockResolvedValue({
			uid: 'other_user',
			email: 'other@example.com',
			companyId: 'company_1',
			role: 'admin'
		});

		const response = await POST(makeEvent());
		expect(response.status).toBe(403);
	});
});
