import { runtimeConfig } from '$server/config';
import { initializeApp, cert, getApps, type App, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function createFirebaseAdminApp(): App {
	if (getApps().length > 0) {
		return getApp();
	}

	const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
	const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

	if (privateKey && clientEmail) {
		return initializeApp({
			credential: cert({
				projectId: runtimeConfig.gcp.projectId,
				privateKey,
				clientEmail
			})
		});
	}

	return initializeApp({
		projectId: runtimeConfig.gcp.projectId
	});
}

export const firebaseAdminApp = createFirebaseAdminApp();
export const adminAuth = getAuth(firebaseAdminApp);
export const adminDb = getFirestore(firebaseAdminApp);
