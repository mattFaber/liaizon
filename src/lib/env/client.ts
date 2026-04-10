import { z } from 'zod';
import { env } from '$env/dynamic/public';

const clientEnvSchema = z.object({
	environment: z.enum(['development', 'staging', 'production']).default('development'),
	firebaseApiKey: z.string().min(1),
	firebaseAuthDomain: z.string().min(1),
	firebaseProjectId: z.string().min(1),
	firebaseStorageBucket: z.string().min(1),
	firebaseMessagingSenderId: z.string().min(1),
	firebaseAppId: z.string().min(1)
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function getClientEnv(): ClientEnv {
	const firebaseApiKey = env.PUBLIC_FIREBASE_API_KEY ?? import.meta.env.VITE_FIREBASE_API_KEY;
	const firebaseAuthDomain =
		env.PUBLIC_FIREBASE_AUTH_DOMAIN ?? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
	const firebaseProjectId =
		env.PUBLIC_FIREBASE_PROJECT_ID ?? import.meta.env.VITE_FIREBASE_PROJECT_ID;
	const firebaseStorageBucket =
		env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
	const firebaseMessagingSenderId =
		env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
	const firebaseAppId = env.PUBLIC_FIREBASE_APP_ID ?? import.meta.env.VITE_FIREBASE_APP_ID;

	return clientEnvSchema.parse({
		environment: import.meta.env.VITE_ENVIRONMENT,
		firebaseApiKey,
		firebaseAuthDomain,
		firebaseProjectId,
		firebaseStorageBucket,
		firebaseMessagingSenderId,
		firebaseAppId
	});
}
