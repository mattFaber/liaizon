import fs from 'node:fs';
import path from 'node:path';

function readDotEnvLocal(filePath) {
	if (!fs.existsSync(filePath)) {
		return {};
	}

	const content = fs.readFileSync(filePath, 'utf8');
	const lines = content.split(/\r?\n/);
	const env = {};

	for (const rawLine of lines) {
		const line = rawLine.trim();

		if (!line || line.startsWith('#')) {
			continue;
		}

		const separatorIndex = line.indexOf('=');
		if (separatorIndex < 0) {
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		let value = line.slice(separatorIndex + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		env[key] = value;
	}

	return env;
}

const cwd = process.cwd();
const dotEnvLocalPath = path.join(cwd, '.env.local');
const localEnv = readDotEnvLocal(dotEnvLocalPath);

const rawCredentialsPath =
	process.env.GOOGLE_APPLICATION_CREDENTIALS ?? localEnv.GOOGLE_APPLICATION_CREDENTIALS ?? '';
const credentialsPath = rawCredentialsPath.trim();

if (!credentialsPath) {
	console.error('Credential preflight failed: GOOGLE_APPLICATION_CREDENTIALS is not set.');
	console.error('Set GOOGLE_APPLICATION_CREDENTIALS in .env.local to your credentials JSON path.');
	process.exit(1);
}

const resolvedPath = path.isAbsolute(credentialsPath)
	? credentialsPath
	: path.resolve(cwd, credentialsPath);

if (!fs.existsSync(resolvedPath)) {
	console.error(`Credential preflight failed: file not found at ${resolvedPath}`);
	console.error('Update GOOGLE_APPLICATION_CREDENTIALS to a valid JSON credential file path.');
	process.exit(1);
}

try {
	fs.accessSync(resolvedPath, fs.constants.R_OK);
} catch {
	console.error(`Credential preflight failed: cannot read ${resolvedPath}`);
	console.error('Fix file permissions for the credential JSON.');
	process.exit(1);
}

console.log(`Credential preflight passed: ${resolvedPath}`);
