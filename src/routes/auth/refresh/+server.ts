import {
	AUTH_COOKIE_NAME,
	createSessionTokenFromIdToken,
	getAuthCookieOptions,
	verifyIdToken
} from '$server/auth';
import { log, logError } from '$lib/logging';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	if (!locals.user?.uid || !locals.user.companyId) {
		return json({ error: 'Authentication required.' }, { status: 401 });
	}

	const formData = await request.formData();
	const idToken = String(formData.get('idToken') ?? '').trim();

	if (!idToken) {
		return json({ error: 'Firebase ID token is required.' }, { status: 400 });
	}

	try {
		const tokenUser = await verifyIdToken(idToken);
		if (tokenUser.uid !== locals.user.uid) {
			return json({ error: 'Token user mismatch.' }, { status: 403 });
		}

		const sessionToken = await createSessionTokenFromIdToken(idToken);
		cookies.set(AUTH_COOKIE_NAME, sessionToken, getAuthCookieOptions());

		log({
			level: 'info',
			message: 'Session cookie refreshed for authenticated user.',
			context: {
				uid: locals.user.uid,
				companyId: locals.user.companyId
			}
		});

		return json({ success: true });
	} catch (error) {
		logError('Failed to refresh session cookie from ID token.', error, {
			uid: locals.user.uid,
			companyId: locals.user.companyId
		});
		return json({ error: 'Invalid Firebase ID token.' }, { status: 401 });
	}
};
