import { AUTH_COOKIE_NAME, COMPANY_COOKIE_NAME } from '$server/auth';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
	cookies.delete(COMPANY_COOKIE_NAME, { path: '/' });
	throw redirect(303, '/auth');
};
