import { getSessionUserFromEvent } from '$server/auth';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = await getSessionUserFromEvent(event);

	return resolve(event);
};
