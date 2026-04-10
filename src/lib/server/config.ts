import { serverEnv } from '$lib/env/server';

export const runtimeConfig = {
	app: {
		baseUrl: serverEnv.appBaseUrl,
		systemPromptVersion: serverEnv.systemPromptVersion,
		defaultStyleStrength: serverEnv.defaultStyleStrength,
		defaultLanguage: serverEnv.defaultLanguage
	},
	gcp: {
		projectId: serverEnv.gcpProjectId,
		vertexLocation: serverEnv.vertexAiLocation,
		vertexModel: serverEnv.vertexAiModel,
		googleApplicationCredentials: serverEnv.googleApplicationCredentials
	},
	storage: {
		resumeInlineMaxBytes: serverEnv.resumeInlineMaxBytes,
		jobDescriptionInlineMaxBytes: serverEnv.jobDescriptionInlineMaxBytes,
		promptTemplateMaxBytes: serverEnv.promptTemplateMaxBytes
	},
	queues: {
		location: serverEnv.cloudTasksLocation,
		bulkGenerationQueue: serverEnv.cloudTasksQueueBulkGeneration,
		maxConcurrency: serverEnv.bulkGenerationMaxConcurrency
	},
	logging: {
		level: serverEnv.logLevel
	}
} as const;

export type RuntimeConfig = typeof runtimeConfig;
