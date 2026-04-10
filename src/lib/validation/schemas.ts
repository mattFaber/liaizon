import { z } from 'zod';
import {
	applicationPriorityValues,
	applicationStatusValues,
	bulkJobStatusValues,
	companyPlanValues,
	messageChannelValues,
	messageStageValues,
	projectStatusValues,
	styleStrengthValues,
	systemInstructionLifecycleValues,
	textStorageModeValues,
	userRoleValues,
	writingSampleScopeValues
} from '$types';

const encoder = new TextEncoder();

function maxUtf8Bytes(limit: number, label: string) {
	return z.string().superRefine((value, ctx) => {
		if (encoder.encode(value).length > limit) {
			ctx.addIssue({
				code: 'too_big',
				maximum: limit,
				origin: 'string',
				inclusive: true,
				message: `${label} must be ${limit} bytes or less`
			});
		}
	});
}

export const timestampSchema = z.date();
export const emailSchema = z.string().email();
export const userRoleSchema = z.enum(userRoleValues);
export const messageStageSchema = z.enum(messageStageValues);
export const messageChannelSchema = z.enum(messageChannelValues);
export const styleStrengthSchema = z.enum(styleStrengthValues);
export const companyPlanSchema = z.enum(companyPlanValues);
export const textStorageModeSchema = z.enum(textStorageModeValues);
export const applicationStatusSchema = z.enum(applicationStatusValues);
export const applicationPrioritySchema = z.enum(applicationPriorityValues);
export const bulkJobStatusSchema = z.enum(bulkJobStatusValues);
export const writingSampleScopeSchema = z.enum(writingSampleScopeValues);
export const projectStatusSchema = z.enum(projectStatusValues);
export const systemInstructionLifecycleSchema = z.enum(systemInstructionLifecycleValues);

export const companySchema = z.object({
	companyId: z.string().min(1),
	name: z.string().min(1).max(200),
	plan: companyPlanSchema,
	defaultLanguage: z.literal('en'),
	defaultStyleStrength: styleStrengthSchema,
	monthlyGenerationQuota: z.number().int().nonnegative(),
	settings: z.record(z.string(), z.unknown()),
	createdBy: z.string().min(1),
	createdAt: timestampSchema,
	isActive: z.boolean()
});

export const userSchema = z.object({
	userId: z.string().min(1),
	companyId: z.string().min(1),
	email: emailSchema,
	displayName: z.string().min(1).max(200),
	role: userRoleSchema,
	preferences: z.record(z.string(), z.unknown()),
	lastLoginAt: timestampSchema.nullable(),
	createdAt: timestampSchema,
	isActive: z.boolean()
});

export const candidateSchema = z.object({
	candidateId: z.string().min(1),
	companyId: z.string().min(1),
	firstName: z.string().min(1).max(100),
	lastName: z.string().min(1).max(100),
	fullName: z.string().min(1).max(200),
	email: emailSchema.nullable(),
	phone: z.string().max(50).nullable(),
	linkedinUrl: z.url().max(500).nullable(),
	currentTitle: z.string().max(200).nullable(),
	currentCompany: z.string().max(200).nullable(),
	yearsExperience: z.number().nonnegative().nullable(),
	highlights: z.array(z.string().min(1).max(500)).max(20),
	resumeText: maxUtf8Bytes(102_400, 'resumeText').nullable(),
	resumeTextSizeBytes: z.number().int().nonnegative(),
	resumeStorageMode: textStorageModeSchema,
	activeVersionNumber: z.number().int().positive(),
	tags: z.array(z.string().min(1).max(50)).max(50),
	createdBy: z.string().min(1),
	createdAt: timestampSchema,
	updatedAt: timestampSchema,
	archivedAt: timestampSchema.nullable(),
	isActive: z.boolean()
});

export const candidateVersionSchema = z.object({
	versionId: z.string().min(1),
	companyId: z.string().min(1),
	candidateId: z.string().min(1),
	versionNumber: z.number().int().positive(),
	snapshot: z.record(z.string(), z.unknown()),
	changedBy: z.string().min(1),
	changeReason: z.string().max(500).nullable(),
	createdAt: timestampSchema
});

export const jobSchema = z.object({
	jobId: z.string().min(1),
	companyId: z.string().min(1),
	title: z.string().min(1).max(200),
	department: z.string().max(100).nullable(),
	level: z.string().max(100).nullable(),
	description: maxUtf8Bytes(51_200, 'description').nullable(),
	descriptionSizeBytes: z.number().int().nonnegative(),
	descriptionStorageMode: textStorageModeSchema,
	requiredSkills: z.array(z.string().min(1).max(100)).max(50),
	preferredSkills: z.array(z.string().min(1).max(100)).max(50),
	keyResponsibilities: z.array(z.string().min(1).max(500)).max(50),
	location: z.string().max(200).nullable(),
	employmentType: z.string().max(100).nullable(),
	compensationMin: z.number().nonnegative().nullable(),
	compensationMax: z.number().nonnegative().nullable(),
	compensationCurrency: z.string().max(10).nullable(),
	isOpen: z.boolean(),
	activeVersionNumber: z.number().int().positive(),
	createdBy: z.string().min(1),
	createdAt: timestampSchema,
	updatedAt: timestampSchema,
	archivedAt: timestampSchema.nullable()
});

export const jobVersionSchema = z.object({
	versionId: z.string().min(1),
	companyId: z.string().min(1),
	jobId: z.string().min(1),
	versionNumber: z.number().int().positive(),
	snapshot: z.record(z.string(), z.unknown()),
	changedBy: z.string().min(1),
	changeReason: z.string().max(500).nullable(),
	createdAt: timestampSchema
});

export const applicationSchema = z.object({
	applicationId: z.string().min(1),
	companyId: z.string().min(1),
	candidateId: z.string().min(1),
	jobId: z.string().min(1),
	stage: messageStageSchema,
	status: applicationStatusSchema,
	ownerUserId: z.string().min(1),
	collaboratorUserIds: z.array(z.string().min(1)).max(50),
	priority: applicationPrioritySchema,
	source: z.string().max(200).nullable(),
	notesSummary: z.string().max(2_000).nullable(),
	latestMessageId: z.string().min(1).nullable(),
	lastActivityAt: timestampSchema,
	createdAt: timestampSchema,
	updatedAt: timestampSchema,
	archivedAt: timestampSchema.nullable()
});

export const applicationStageTransitionSchema = z.object({
	transitionId: z.string().min(1),
	companyId: z.string().min(1),
	applicationId: z.string().min(1),
	fromStage: messageStageSchema,
	toStage: messageStageSchema,
	changedBy: z.string().min(1),
	createdAt: timestampSchema,
	note: z.string().max(500).nullable()
});

export const projectSchema = z.object({
	projectId: z.string().min(1),
	companyId: z.string().min(1),
	name: z.string().min(1).max(200),
	description: z.string().max(5_000).nullable(),
	status: projectStatusSchema,
	ownerUserId: z.string().min(1),
	collaboratorUserIds: z.array(z.string().min(1)).max(100),
	applicationIds: z.array(z.string().min(1)).max(5_000),
	tags: z.array(z.string().min(1).max(50)).max(100),
	startDate: timestampSchema.nullable(),
	endDate: timestampSchema.nullable(),
	createdAt: timestampSchema,
	updatedAt: timestampSchema,
	archivedAt: timestampSchema.nullable(),
	isActive: z.boolean()
});

export const appSettingsSchema = z.object({
	settingsId: z.string().min(1),
	companyId: z.string().min(1),
	defaultChannel: messageChannelSchema,
	defaultStage: messageStageSchema,
	defaultStyleStrength: styleStrengthSchema,
	featureFlags: z.record(z.string(), z.boolean()),
	notificationPreferences: z.record(z.string(), z.unknown()),
	updatedBy: z.string().min(1),
	updatedAt: timestampSchema
});

export const systemInstructionVersionSchema = z.object({
	versionId: z.string().min(1),
	companyId: z.string().min(1),
	versionLabel: z.string().min(1).max(100),
	instructionUri: z.string().min(1).max(1_000),
	lifecycle: systemInstructionLifecycleSchema,
	createdBy: z.string().min(1),
	createdAt: timestampSchema,
	notes: z.string().max(2_000).nullable()
});

export const promptTemplateSchema = z.object({
	templateId: z.string().min(1),
	companyId: z.string().min(1),
	stage: messageStageSchema,
	channel: messageChannelSchema,
	promptVersion: z.number().int().positive(),
	basePrompt: maxUtf8Bytes(10_240, 'basePrompt'),
	editableFields: z.array(z.string().min(1).max(100)).max(25),
	maxLengthWords: z.number().int().positive(),
	deprecated: z.boolean(),
	updatedBy: z.string().min(1),
	createdAt: timestampSchema,
	updatedAt: timestampSchema
});

export const writingSampleSchema = z.object({
	sampleId: z.string().min(1),
	companyId: z.string().min(1),
	recruiterId: z.string().min(1).nullable(),
	scope: writingSampleScopeSchema,
	stage: messageStageSchema.nullable(),
	channel: messageChannelSchema,
	text: maxUtf8Bytes(3_000, 'text').min(50),
	isActive: z.boolean(),
	sourceMessageId: z.string().min(1).nullable(),
	createdAt: timestampSchema
});

export const generationTokensSchema = z.object({
	inputTokens: z.number().int().nonnegative(),
	outputTokens: z.number().int().nonnegative(),
	totalTokens: z.number().int().nonnegative().optional()
});

export const generationQualityChecksSchema = z.object({
	factuallyGrounded: z.boolean(),
	stageAligned: z.boolean(),
	clearCta: z.boolean(),
	withinLengthLimit: z.boolean(),
	styleAlignedToSamples: z.boolean(),
	professionalTone: z.boolean()
});

export const generatedMessageSchema = z.object({
	messageId: z.string().min(1),
	companyId: z.string().min(1),
	applicationId: z.string().min(1),
	candidateId: z.string().min(1),
	jobId: z.string().min(1),
	recruiterId: z.string().min(1),
	stage: messageStageSchema,
	channel: messageChannelSchema,
	subject: z.string().max(200),
	message: maxUtf8Bytes(10_240, 'message'),
	sourceMessageId: z.string().min(1).nullable(),
	isEditedVariant: z.boolean(),
	templateVersionUsed: z.number().int().positive(),
	systemPromptVersionUsed: z.string().min(1),
	generationModel: z.string().min(1),
	generationLatencyMs: z.number().int().nonnegative(),
	tokens: generationTokensSchema,
	rationale: z.array(z.string().min(1).max(500)).min(1).max(4),
	styleAlignmentNotes: z.array(z.string().min(1).max(500)).max(3),
	qualityChecks: generationQualityChecksSchema,
	writingSampleIds: z.array(z.string().min(1)).max(5),
	candidateName: z.string().min(1).max(200),
	jobTitle: z.string().min(1).max(200),
	wasApproved: z.boolean(),
	sentAt: timestampSchema.nullable(),
	sentVia: z.enum(['clipboard', 'exported', ...messageChannelValues]).nullable(),
	createdAt: timestampSchema,
	expiresAt: timestampSchema.nullable()
});

export const bulkJobResultMessageSchema = z.object({
	applicationId: z.string().min(1),
	messageId: z.string().min(1),
	status: z.enum(['success', 'failed'])
});

export const bulkJobErrorSchema = z.object({
	applicationId: z.string().min(1),
	error: z.string().min(1).max(1_000),
	createdAt: timestampSchema
});

export const bulkGenerationJobSchema = z.object({
	bulkJobId: z.string().min(1),
	companyId: z.string().min(1),
	recruiterId: z.string().min(1),
	jobId: z.string().min(1).nullable(),
	stage: messageStageSchema,
	channel: messageChannelSchema,
	applicationIds: z.array(z.string().min(1)).min(1),
	status: bulkJobStatusSchema,
	totalCount: z.number().int().nonnegative(),
	successCount: z.number().int().nonnegative(),
	failureCount: z.number().int().nonnegative(),
	errors: z.array(bulkJobErrorSchema),
	resultMessages: z.array(bulkJobResultMessageSchema),
	requestedAt: timestampSchema,
	startedAt: timestampSchema.nullable(),
	completedAt: timestampSchema.nullable(),
	maxConcurrency: z.number().int().positive(),
	expiresAt: timestampSchema.nullable()
});

export const recruiterMessageRequestSchema = z.object({
	channel: messageChannelSchema,
	stage: messageStageSchema,
	recruiterName: z.string().min(1).max(200),
	companyName: z.string().min(1).max(200),
	roleTitle: z.string().min(1).max(200),
	keyRoleValueProp: z.string().min(1).max(2_000),
	candidateName: z.string().min(1).max(200),
	candidateHighlights: z.array(z.string().min(1).max(500)).max(20),
	previousContactSummary: z.string().max(2_000).optional(),
	ctaType: z.enum(['reply', 'schedule', 'confirm_interest']),
	constraints: z.array(z.string().min(1).max(500)).max(20).optional(),
	writingSamples: z.array(maxUtf8Bytes(3_000, 'writingSamples[]').min(50)).max(5).optional(),
	styleStrength: styleStrengthSchema.default('medium')
});

export type CompanySchema = z.infer<typeof companySchema>;
export type UserSchema = z.infer<typeof userSchema>;
export type CandidateSchema = z.infer<typeof candidateSchema>;
export type JobSchema = z.infer<typeof jobSchema>;
export type ApplicationSchema = z.infer<typeof applicationSchema>;
export type ApplicationStageTransitionSchema = z.infer<typeof applicationStageTransitionSchema>;
export type ProjectSchema = z.infer<typeof projectSchema>;
export type AppSettingsSchema = z.infer<typeof appSettingsSchema>;
export type SystemInstructionVersionSchema = z.infer<typeof systemInstructionVersionSchema>;
export type PromptTemplateSchema = z.infer<typeof promptTemplateSchema>;
export type WritingSampleSchema = z.infer<typeof writingSampleSchema>;
export type GeneratedMessageSchema = z.infer<typeof generatedMessageSchema>;
export type BulkGenerationJobSchema = z.infer<typeof bulkGenerationJobSchema>;
export type RecruiterMessageRequestSchema = z.infer<typeof recruiterMessageRequestSchema>;
