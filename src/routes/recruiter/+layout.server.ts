import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth');
	}

	if (!locals.user.companyId) {
		throw redirect(303, '/auth');
	}

	return {
		user: locals.user
	};
};
