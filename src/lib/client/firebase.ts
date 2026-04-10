import { getClientEnv } from '$lib/env/client';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
	GoogleAuthProvider,
	getAuth,
	signInWithPopup,
	type Auth,
	type UserCredential
} from 'firebase/auth';
import { ZodError } from 'zod';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
	if (app) {
		return app;
	}

	try {
		const env = getClientEnv();

		app =
			getApps()[0] ??
			initializeApp({
				apiKey: env.firebaseApiKey,
				authDomain: env.firebaseAuthDomain,
				projectId: env.firebaseProjectId,
				storageBucket: env.firebaseStorageBucket,
				messagingSenderId: env.firebaseMessagingSenderId,
				appId: env.firebaseAppId
			});
	} catch (error) {
		if (error instanceof ZodError) {
			throw new Error(
				'Firebase client environment is incomplete. Set PUBLIC_FIREBASE_* (or VITE_FIREBASE_*) variables before using Google sign-in.',
				{ cause: error }
			);
		}

		throw error;
	}

	return app;
}

function getFirebaseAuth(): Auth {
	if (auth) {
		return auth;
	}

	auth = getAuth(getFirebaseApp());
	return auth;
}

export async function signInWithGooglePopup(): Promise<UserCredential> {
	const provider = new GoogleAuthProvider();
	return signInWithPopup(getFirebaseAuth(), provider);
}

export async function getCurrentUserIdToken(forceRefresh: boolean = false): Promise<string | null> {
	const user = getFirebaseAuth().currentUser;
	if (!user) {
		return null;
	}

	return user.getIdToken(forceRefresh);
}
