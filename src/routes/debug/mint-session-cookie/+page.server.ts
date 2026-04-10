import { serverEnv } from '$lib/env/server';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { verifyIdToken } from '$server/auth';
import { adminAuth } from '$server/firebase-admin';
import { log, logError } from '$lib/logging';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	if (serverEnv.nodeEnv !== 'development') {
		throw redirect(303, '/');
	}

	return {
		isDevelopment: true
	};
};

export const actions: Actions = {
	mint: async ({ request }) => {
		if (serverEnv.nodeEnv !== 'development') {
			return fail(403, { error: 'This endpoint is only available in development.' });
		}

		const formData = await request.formData();
		const idToken = String(formData.get('idToken') ?? '').trim();
		const expiresDays = Number(formData.get('expiresDays') ?? 7);

		if (!idToken) {
			return fail(400, { error: 'Firebase ID token is required.' });
		}

		if (!Number.isInteger(expiresDays) || expiresDays < 1 || expiresDays > 14) {
			return fail(400, {
				error: 'Expires days must be an integer between 1 and 14.'
			});
		}

		try {
			await verifyIdToken(idToken);
			const expiresInMs = expiresDays * 24 * 60 * 60 * 1000;
			const sessionCookie = await adminAuth.createSessionCookie(idToken, {
				expiresIn: expiresInMs
			});

			log({
				level: 'info',
				message: 'Development debug endpoint minted bootstrap session cookie.',
				context: {
					expiresDays
				}
			});

			return {
				success: true,
				sessionCookie,
				expiresDays,
				message: `Session cookie generated (expires in ${expiresDays} day${expiresDays === 1 ? '' : 's'}).`
			};
		} catch (error) {
			logError('Failed to mint session cookie in debug endpoint.', error);
			return fail(401, {
				error: 'Invalid Firebase ID token or minting failed.'
			});
		}
	}
};
