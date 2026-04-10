import process from 'node:process';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const DEFAULT_EXPIRES_DAYS = 7;
const MIN_EXPIRES_DAYS = 1;
const MAX_EXPIRES_DAYS = 14;

function parseArgs(argv) {
	const args = {
		help: false,
		idToken: '',
		expiresDays: DEFAULT_EXPIRES_DAYS
	};

	for (let i = 0; i < argv.length; i += 1) {
		const current = argv[i];

		if (current === '--help' || current === '-h') {
			args.help = true;
			continue;
		}

		if (current === '--id-token') {
			args.idToken = String(argv[i + 1] ?? '').trim();
			i += 1;
			continue;
		}

		if (current === '--expires-days') {
			const parsed = Number(argv[i + 1]);
			args.expiresDays = Number.isFinite(parsed) ? parsed : NaN;
			i += 1;
			continue;
		}
	}

	return args;
}

function printHelp() {
	console.log('Generate a Firebase session cookie for AUTH_BOOTSTRAP_SESSION_COOKIE.');
	console.log('');
	console.log('Usage:');
	console.log('  npm run auth:session-cookie -- --id-token <firebase-id-token> [--expires-days 7]');
	console.log('');
	console.log('Options:');
	console.log('  --id-token <token>      Firebase ID token to exchange for a session cookie');
	console.log(
		`  --expires-days <days>  Session duration in days (${MIN_EXPIRES_DAYS}-${MAX_EXPIRES_DAYS}, default ${DEFAULT_EXPIRES_DAYS})`
	);
	console.log('  --help                  Show help');
	console.log('');
	console.log('Required env:');
	console.log('  GCP_PROJECT_ID');
	console.log('  GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY');
}

function validateInput({ idToken, expiresDays }) {
	if (!idToken) {
		throw new Error('Missing required --id-token argument.');
	}

	if (!Number.isInteger(expiresDays)) {
		throw new Error('--expires-days must be an integer.');
	}

	if (expiresDays < MIN_EXPIRES_DAYS || expiresDays > MAX_EXPIRES_DAYS) {
		throw new Error(`--expires-days must be between ${MIN_EXPIRES_DAYS} and ${MAX_EXPIRES_DAYS}.`);
	}

	if (!process.env.GCP_PROJECT_ID?.trim()) {
		throw new Error('Missing GCP_PROJECT_ID in environment.');
	}
}

function getFirebaseAdminApp() {
	if (getApps().length > 0) {
		return getApp();
	}

	const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
	const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
	const projectId = process.env.GCP_PROJECT_ID?.trim();

	if (privateKey && clientEmail && projectId) {
		return initializeApp({
			credential: cert({
				projectId,
				privateKey,
				clientEmail
			})
		});
	}

	return initializeApp({
		projectId
	});
}

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (options.help) {
		printHelp();
		return;
	}

	validateInput(options);

	const app = getFirebaseAdminApp();
	const auth = getAuth(app);
	const expiresInMs = options.expiresDays * 24 * 60 * 60 * 1000;

	await auth.verifyIdToken(options.idToken);
	const sessionCookie = await auth.createSessionCookie(options.idToken, { expiresIn: expiresInMs });

	console.log('Session cookie generated successfully.');
	console.log('');
	console.log('Set this in your .env.local (or deploy env):');
	console.log(`AUTH_BOOTSTRAP_SESSION_COOKIE=${sessionCookie}`);
	console.log('');
	console.log('Then set: AUTH_BOOTSTRAP_ENABLED=true');
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Failed to generate session cookie: ${message}`);
	process.exit(1);
});
