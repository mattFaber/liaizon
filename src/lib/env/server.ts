import { z } from 'zod';
import { env } from '$env/dynamic/private';

function emptyStringToUndefined(value: string | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function parseBooleanEnv(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value !== 'string') {
		return undefined;
	}

	switch (value.trim().toLowerCase()) {
		case 'true':
		case '1':
		case 'yes':
		case 'on':
			return true;
		case 'false':
		case '0':
		case 'no':
		case 'off':
			return false;
		default:
			return undefined;
	}
}

const serverEnvSchema = z.object({
	nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
	gcpProjectId: z.string().min(1).default('local-project'),
	vertexAiLocation: z.string().min(1).default('us-central1'),
	vertexAiModel: z.string().min(1).default('gemini-1.5-pro'),
	googleApplicationCredentials: z.string().min(1).optional(),
	appBaseUrl: z.string().url().default('http://localhost:5173'),
	systemPromptVersion: z.string().min(1).default('2026-04-06'),
	defaultStyleStrength: z.enum(['low', 'medium', 'high']).default('medium'),
	defaultLanguage: z.literal('en').default('en'),
	resumeInlineMaxBytes: z.coerce.number().int().positive().default(102_400),
	jobDescriptionInlineMaxBytes: z.coerce.number().int().positive().default(51_200),
	promptTemplateMaxBytes: z.coerce.number().int().positive().default(10_240),
	cloudTasksLocation: z.string().min(1).optional(),
	cloudTasksQueueBulkGeneration: z.string().min(1).optional(),
	bulkGenerationMaxConcurrency: z.coerce.number().int().positive().default(5),
	authBootstrapEnabled: z.preprocess(parseBooleanEnv, z.boolean()).optional().default(false),
	authBootstrapIdToken: z.string().min(1).optional(),
	authBootstrapSessionCookie: z.string().min(1).optional(),
	authBootstrapCompanyId: z.string().min(1).default('demo-company'),
	logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
	return serverEnvSchema.parse({
		nodeEnv: env.NODE_ENV,
		gcpProjectId:
			emptyStringToUndefined(env.GCP_PROJECT_ID) ??
			emptyStringToUndefined(env.PUBLIC_FIREBASE_PROJECT_ID) ??
			emptyStringToUndefined(env.VITE_FIREBASE_PROJECT_ID),
		vertexAiLocation: env.VERTEX_AI_LOCATION,
		vertexAiModel: env.VERTEX_AI_MODEL,
		googleApplicationCredentials: emptyStringToUndefined(env.GOOGLE_APPLICATION_CREDENTIALS),
		appBaseUrl: env.APP_BASE_URL,
		systemPromptVersion: env.SYSTEM_PROMPT_VERSION,
		defaultStyleStrength: env.DEFAULT_STYLE_STRENGTH,
		defaultLanguage: env.DEFAULT_LANGUAGE,
		resumeInlineMaxBytes: env.RESUME_INLINE_MAX_BYTES,
		jobDescriptionInlineMaxBytes: env.JOB_DESCRIPTION_INLINE_MAX_BYTES,
		promptTemplateMaxBytes: env.PROMPT_TEMPLATE_MAX_BYTES,
		cloudTasksLocation: emptyStringToUndefined(env.CLOUD_TASKS_LOCATION),
		cloudTasksQueueBulkGeneration: emptyStringToUndefined(env.CLOUD_TASKS_QUEUE_BULK_GENERATION),
		bulkGenerationMaxConcurrency: env.BULK_GENERATION_MAX_CONCURRENCY,
		authBootstrapEnabled: env.AUTH_BOOTSTRAP_ENABLED,
		authBootstrapIdToken: emptyStringToUndefined(env.AUTH_BOOTSTRAP_ID_TOKEN),
		authBootstrapSessionCookie: emptyStringToUndefined(env.AUTH_BOOTSTRAP_SESSION_COOKIE),
		authBootstrapCompanyId: env.AUTH_BOOTSTRAP_COMPANY_ID,
		logLevel: env.LOG_LEVEL
	});
}

export const serverEnv = getServerEnv();
