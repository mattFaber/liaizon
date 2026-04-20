import {
	AUTH_COOKIE_NAME,
	COMPANY_COOKIE_NAME,
	createSessionTokenFromIdToken,
	getAuthCookieOptions,
	verifyIdToken
} from '$server/auth';
import { provisionUserWorkspace } from '$server/user-workspace';
import { serverEnv } from '$lib/env/server';
import { log, logError } from '$lib/logging';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/recruiter');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const idToken = String(formData.get('idToken') ?? '').trim();

		if (!idToken) {
			return fail(400, { error: 'A Firebase ID token is required.' });
		}

		try {
			const sessionUser = await verifyIdToken(idToken);
			const sessionToken = await createSessionTokenFromIdToken(idToken);
			const companyId = await provisionUserWorkspace(sessionUser);

			cookies.set(AUTH_COOKIE_NAME, sessionToken, getAuthCookieOptions());
			cookies.set(COMPANY_COOKIE_NAME, companyId, getAuthCookieOptions());

			log({
				level: 'info',
				message: 'User signed in with Google and workspace provisioned.',
				context: {
					uid: sessionUser.uid,
					email: sessionUser.email,
					companyId
				}
			});
		} catch (error) {
			logError('Failed to verify Firebase ID token during sign-in.', error);
			const rawMessage = error instanceof Error ? error.message : '';
			const needsAdcReauth =
				rawMessage.includes('invalid_rapt') || rawMessage.includes('Reauthentication is needed');

			if (serverEnv.nodeEnv === 'development' && needsAdcReauth) {
				return fail(401, {
					error:
						'Invalid Firebase ID token. Local Google Application Default Credentials are expired. Run "gcloud auth application-default login" to refresh ADC, or configure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY for a service account in .env.local.'
				});
			}

			const errorMessage =
				serverEnv.nodeEnv === 'development' && error instanceof Error
					? `Invalid Firebase ID token. ${error.message}`
					: 'Invalid Firebase ID token.';

			return fail(401, { error: errorMessage });
		}

		throw redirect(303, '/recruiter');
	}
};
