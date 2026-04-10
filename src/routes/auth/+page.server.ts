import {
	AUTH_COOKIE_NAME,
	COMPANY_COOKIE_NAME,
	createSessionTokenFromIdToken,
	getAuthCookieOptions,
	verifyIdToken,
	verifySessionToken
} from '$server/auth';
import { serverEnv } from '$lib/env/server';
import { log, logError } from '$lib/logging';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	if (serverEnv.authBootstrapEnabled) {
		const envSessionCookie = String(serverEnv.authBootstrapSessionCookie ?? '').trim();
		const envIdToken = String(serverEnv.authBootstrapIdToken ?? '').trim();

		if (!envSessionCookie && !envIdToken) {
			return {
				engineerAuthConfigured: true,
				configuredCompanyId: serverEnv.authBootstrapCompanyId,
				bootstrapError:
					'AUTH_BOOTSTRAP_ENABLED is true but neither AUTH_BOOTSTRAP_SESSION_COOKIE nor AUTH_BOOTSTRAP_ID_TOKEN is configured.'
			};
		}

		let sessionToken = envSessionCookie;

		try {
			if (sessionToken) {
				await verifySessionToken(sessionToken);
			} else {
				await verifyIdToken(envIdToken);
				sessionToken = await createSessionTokenFromIdToken(envIdToken);
			}
		} catch (error) {
			logError('Failed to verify configured auth bootstrap token during auth bootstrap.', error);

			return {
				engineerAuthConfigured: true,
				configuredCompanyId: serverEnv.authBootstrapCompanyId,
				bootstrapError:
					'Configured auth bootstrap credentials are invalid. Check AUTH_BOOTSTRAP_SESSION_COOKIE or AUTH_BOOTSTRAP_ID_TOKEN.'
			};
		}

		cookies.set(AUTH_COOKIE_NAME, sessionToken, getAuthCookieOptions());
		cookies.set(COMPANY_COOKIE_NAME, serverEnv.authBootstrapCompanyId, getAuthCookieOptions());

		log({
			level: 'info',
			message: 'Auth bootstrap sign-in completed from server environment.',
			context: {
				companyId: serverEnv.authBootstrapCompanyId,
				usedSessionCookie: Boolean(envSessionCookie),
				usedIdTokenFallback: !envSessionCookie
			}
		});

		throw redirect(303, '/recruiter');
	}

	return {
		engineerAuthConfigured: false,
		configuredCompanyId: serverEnv.authBootstrapCompanyId,
		bootstrapError: null
	};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const submittedIdToken = String(formData.get('idToken') ?? '').trim();
		const submittedCompanyId = String(formData.get('companyId') ?? '').trim();
		const envSessionCookie = serverEnv.authBootstrapEnabled
			? String(serverEnv.authBootstrapSessionCookie ?? '').trim()
			: '';

		const envIdToken = serverEnv.authBootstrapEnabled
			? String(serverEnv.authBootstrapIdToken ?? '').trim()
			: '';
		const envCompanyId = serverEnv.authBootstrapEnabled ? serverEnv.authBootstrapCompanyId : '';

		const idToken = submittedIdToken || envIdToken;
		const companyId = submittedCompanyId || envCompanyId;
		let sessionToken = envSessionCookie;

		if (serverEnv.authBootstrapEnabled && !envSessionCookie && !envIdToken) {
			return fail(500, {
				error:
					'AUTH_BOOTSTRAP_ENABLED is true but neither AUTH_BOOTSTRAP_SESSION_COOKIE nor AUTH_BOOTSTRAP_ID_TOKEN is configured.'
			});
		}

		if (!sessionToken && !idToken) {
			return fail(400, { error: 'A Firebase ID token is required.' });
		}

		if (!companyId) {
			return fail(400, { error: 'A company ID is required.' });
		}

		try {
			if (sessionToken) {
				await verifySessionToken(sessionToken);
			} else {
				await verifyIdToken(idToken);
				sessionToken = await createSessionTokenFromIdToken(idToken);
			}

			cookies.set(AUTH_COOKIE_NAME, sessionToken, getAuthCookieOptions());

			cookies.set(COMPANY_COOKIE_NAME, companyId, getAuthCookieOptions());

			log({
				level: 'info',
				message: 'Auth sign-in completed from auth form action.',
				context: {
					companyId,
					engineerBootstrapEnabled: serverEnv.authBootstrapEnabled,
					usedSessionCookie: Boolean(envSessionCookie)
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
