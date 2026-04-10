import { adminAuth } from '$server/firebase-admin';
import { AuthenticationError } from '$validation/errors';
import type { RequestEvent } from '@sveltejs/kit';

export const AUTH_COOKIE_NAME = 'session_token';
export const COMPANY_COOKIE_NAME = 'company_id';
const SESSION_COOKIE_MIN_EXPIRES_DAYS = 1;
const SESSION_COOKIE_MAX_EXPIRES_DAYS = 14;
const SESSION_COOKIE_DEFAULT_EXPIRES_DAYS = 7;

function toSessionCookieExpiresInMs(expiresDays: number): number {
	if (!Number.isInteger(expiresDays)) {
		throw new Error('Session cookie expiration days must be an integer.');
	}

	if (expiresDays < SESSION_COOKIE_MIN_EXPIRES_DAYS || expiresDays > SESSION_COOKIE_MAX_EXPIRES_DAYS) {
		throw new Error(
			`Session cookie expiration days must be between ${SESSION_COOKIE_MIN_EXPIRES_DAYS} and ${SESSION_COOKIE_MAX_EXPIRES_DAYS}.`
		);
	}

	return expiresDays * 24 * 60 * 60 * 1000;
}

export interface SessionUser {
	uid: string;
	email: string | null;
	companyId: string | null;
	role: string | null;
}

function toSessionUser(
	decodedToken: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>
): SessionUser {
	return {
		uid: decodedToken.uid,
		email: decodedToken.email ?? null,
		companyId: (decodedToken.companyId as string | undefined) ?? null,
		role: (decodedToken.role as string | undefined) ?? null
	};
}

export async function verifyIdToken(idToken: string): Promise<SessionUser> {
	const decodedToken = await adminAuth.verifyIdToken(idToken);
	return toSessionUser(decodedToken);
}

export async function createSessionTokenFromIdToken(
	idToken: string,
	expiresDays: number = SESSION_COOKIE_DEFAULT_EXPIRES_DAYS
): Promise<string> {
	return adminAuth.createSessionCookie(idToken, { expiresIn: toSessionCookieExpiresInMs(expiresDays) });
}

export function getAuthCookieOptions(maxAgeDays: number = SESSION_COOKIE_DEFAULT_EXPIRES_DAYS) {
	const expiresInMs = toSessionCookieExpiresInMs(maxAgeDays);

	return {
		httpOnly: true,
		path: '/',
		sameSite: 'lax' as const,
		secure: process.env.NODE_ENV === 'production',
		maxAge: Math.floor(expiresInMs / 1000)
	};
}

export async function verifySessionToken(sessionToken: string): Promise<SessionUser> {
	const decodedToken = await adminAuth.verifySessionCookie(sessionToken, true);
	return toSessionUser(decodedToken);
}

export async function getSessionUserFromEvent(event: RequestEvent): Promise<SessionUser | null> {
	const token = event.cookies.get(AUTH_COOKIE_NAME);
	const companyCookie = event.cookies.get(COMPANY_COOKIE_NAME) ?? null;

	if (!token) {
		return null;
	}

	try {
		const user = await verifySessionToken(token);
		return {
			...user,
			companyId: user.companyId ?? companyCookie
		};
	} catch {
		return null;
	}
}

export function requireSessionUser(event: RequestEvent): SessionUser {
	if (!event.locals.user) {
		throw new AuthenticationError();
	}

	return event.locals.user;
}
