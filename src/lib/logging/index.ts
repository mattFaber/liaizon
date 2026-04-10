import { runtimeConfig } from '$server/config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const logLevelOrder: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40
};

export interface LogEntry {
	level: LogLevel;
	message: string;
	context?: Record<string, unknown>;
	error?: { message: string; stack?: string; code?: string };
	timestamp?: string;
}

function shouldLog(level: LogLevel): boolean {
	return logLevelOrder[level] >= logLevelOrder[runtimeConfig.logging.level];
}

export function log(entry: LogEntry): void {
	if (!shouldLog(entry.level)) {
		return;
	}

	const record = {
		...entry,
		timestamp: entry.timestamp ?? new Date().toISOString()
	};

	console.log(JSON.stringify(record));
}

export function logError(message: string, error: unknown, context?: Record<string, unknown>): void {
	const normalizedError =
		error instanceof Error
			? { message: error.message, stack: error.stack }
			: { message: 'Unknown error' };

	log({
		level: 'error',
		message,
		context,
		error: normalizedError
	});
}
