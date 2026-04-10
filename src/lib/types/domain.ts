export const userRoleValues = ['admin', 'recruiter', 'hiring_manager'] as const;
export const messageStageValues = [
	'initial_outreach',
	'follow_up',
	'interview_invite',
	'interview_follow_up',
	'offer_stage',
	'rejection'
] as const;
export const messageChannelValues = ['email', 'linkedin', 'sms'] as const;
export const styleStrengthValues = ['low', 'medium', 'high'] as const;
export const companyPlanValues = ['free', 'pro', 'enterprise'] as const;
export const textStorageModeValues = ['inline', 'chunked', 'none'] as const;
export const applicationStatusValues = ['active', 'paused', 'closed', 'hired', 'rejected'] as const;
export const applicationPriorityValues = ['low', 'medium', 'high'] as const;
export const bulkJobStatusValues = [
	'queued',
	'processing',
	'completed',
	'failed',
	'partial_success'
] as const;
export const writingSampleScopeValues = ['recruiter', 'company'] as const;
export const projectStatusValues = ['draft', 'active', 'on_hold', 'completed', 'archived'] as const;
export const systemInstructionLifecycleValues = ['active', 'deprecated'] as const;
export const logLevelValues = ['debug', 'info', 'warn', 'error'] as const;

export type UserRole = (typeof userRoleValues)[number];
export type MessageStage = (typeof messageStageValues)[number];
export type MessageChannel = (typeof messageChannelValues)[number];
export type StyleStrength = (typeof styleStrengthValues)[number];
export type CompanyPlan = (typeof companyPlanValues)[number];
export type TextStorageMode = (typeof textStorageModeValues)[number];
export type ApplicationStatus = (typeof applicationStatusValues)[number];
export type ApplicationPriority = (typeof applicationPriorityValues)[number];
export type BulkJobStatus = (typeof bulkJobStatusValues)[number];
export type WritingSampleScope = (typeof writingSampleScopeValues)[number];
export type ProjectStatus = (typeof projectStatusValues)[number];
export type SystemInstructionLifecycle = (typeof systemInstructionLifecycleValues)[number];
export type LogLevel = (typeof logLevelValues)[number];

// Repository code should convert these to Firestore Timestamp values.
export type TimestampValue = Date;

export interface Company {
	companyId: string;
	name: string;
	plan: CompanyPlan;
	defaultLanguage: 'en';
	defaultStyleStrength: StyleStrength;
	monthlyGenerationQuota: number;
	settings: Record<string, unknown>;
	createdBy: string;
	createdAt: TimestampValue;
	isActive: boolean;
}

export interface User {
	userId: string;
	companyId: string;
	email: string;
	displayName: string;
	role: UserRole;
	preferences: Record<string, unknown>;
	lastLoginAt: TimestampValue | null;
	createdAt: TimestampValue;
	isActive: boolean;
}

export interface Candidate {
	candidateId: string;
	companyId: string;
	firstName: string;
	lastName: string;
	fullName: string;
	email: string | null;
	phone: string | null;
	linkedinUrl: string | null;
	currentTitle: string | null;
	currentCompany: string | null;
	yearsExperience: number | null;
	highlights: string[];
	resumeText: string | null;
	resumeTextSizeBytes: number;
	resumeStorageMode: TextStorageMode;
	activeVersionNumber: number;
	tags: string[];
	createdBy: string;
	createdAt: TimestampValue;
	updatedAt: TimestampValue;
	archivedAt: TimestampValue | null;
	isActive: boolean;
}

export interface CandidateVersion {
	versionId: string;
	companyId: string;
	candidateId: string;
	versionNumber: number;
	snapshot: Record<string, unknown>;
	changedBy: string;
	changeReason: string | null;
	createdAt: TimestampValue;
}

export interface Job {
	jobId: string;
	companyId: string;
	title: string;
	department: string | null;
	level: string | null;
	description: string | null;
	descriptionSizeBytes: number;
	descriptionStorageMode: TextStorageMode;
	requiredSkills: string[];
	preferredSkills: string[];
	keyResponsibilities: string[];
	location: string | null;
	employmentType: string | null;
	compensationMin: number | null;
	compensationMax: number | null;
	compensationCurrency: string | null;
	isOpen: boolean;
	activeVersionNumber: number;
	createdBy: string;
	createdAt: TimestampValue;
	updatedAt: TimestampValue;
	archivedAt: TimestampValue | null;
}

export interface JobVersion {
	versionId: string;
	companyId: string;
	jobId: string;
	versionNumber: number;
	snapshot: Record<string, unknown>;
	changedBy: string;
	changeReason: string | null;
	createdAt: TimestampValue;
}

export interface Application {
	applicationId: string;
	companyId: string;
	candidateId: string;
	jobId: string;
	stage: MessageStage;
	status: ApplicationStatus;
	ownerUserId: string;
	collaboratorUserIds: string[];
	priority: ApplicationPriority;
	source: string | null;
	notesSummary: string | null;
	latestMessageId: string | null;
	lastActivityAt: TimestampValue;
	createdAt: TimestampValue;
	updatedAt: TimestampValue;
	archivedAt: TimestampValue | null;
}

export interface ApplicationStageTransition {
	transitionId: string;
	companyId: string;
	applicationId: string;
	fromStage: MessageStage;
	toStage: MessageStage;
	changedBy: string;
	createdAt: TimestampValue;
	note: string | null;
}

export interface Project {
	projectId: string;
	companyId: string;
	name: string;
	description: string | null;
	status: ProjectStatus;
	ownerUserId: string;
	collaboratorUserIds: string[];
	applicationIds: string[];
	tags: string[];
	startDate: TimestampValue | null;
	endDate: TimestampValue | null;
	createdAt: TimestampValue;
	updatedAt: TimestampValue;
	archivedAt: TimestampValue | null;
	isActive: boolean;
}

export interface AppSettings {
	settingsId: string;
	companyId: string;
	defaultChannel: MessageChannel;
	defaultStage: MessageStage;
	defaultStyleStrength: StyleStrength;
	featureFlags: Record<string, boolean>;
	notificationPreferences: Record<string, unknown>;
	updatedBy: string;
	updatedAt: TimestampValue;
}

export interface SystemInstructionVersion {
	versionId: string;
	companyId: string;
	versionLabel: string;
	instructionUri: string;
	lifecycle: SystemInstructionLifecycle;
	createdBy: string;
	createdAt: TimestampValue;
	notes: string | null;
}

export interface PromptTemplate {
	templateId: string;
	companyId: string;
	stage: MessageStage;
	channel: MessageChannel;
	promptVersion: number;
	basePrompt: string;
	editableFields: string[];
	maxLengthWords: number;
	deprecated: boolean;
	updatedBy: string;
	createdAt: TimestampValue;
	updatedAt: TimestampValue;
}

export interface WritingSample {
	sampleId: string;
	companyId: string;
	recruiterId: string | null;
	scope: WritingSampleScope;
	stage: MessageStage | null;
	channel: MessageChannel;
	text: string;
	isActive: boolean;
	sourceMessageId: string | null;
	createdAt: TimestampValue;
}

export interface GenerationTokens {
	inputTokens: number;
	outputTokens: number;
	totalTokens?: number;
}

export interface GenerationQualityChecks {
	factuallyGrounded: boolean;
	stageAligned: boolean;
	clearCta: boolean;
	withinLengthLimit: boolean;
	styleAlignedToSamples: boolean;
	professionalTone: boolean;
}

export interface GeneratedMessage {
	messageId: string;
	companyId: string;
	applicationId: string;
	candidateId: string;
	jobId: string;
	recruiterId: string;
	stage: MessageStage;
	channel: MessageChannel;
	subject: string;
	message: string;
	sourceMessageId: string | null;
	isEditedVariant: boolean;
	templateVersionUsed: number;
	systemPromptVersionUsed: string;
	generationModel: string;
	generationLatencyMs: number;
	tokens: GenerationTokens;
	rationale: string[];
	styleAlignmentNotes: string[];
	qualityChecks: GenerationQualityChecks;
	writingSampleIds: string[];
	candidateName: string;
	jobTitle: string;
	wasApproved: boolean;
	sentAt: TimestampValue | null;
	sentVia: 'clipboard' | 'exported' | MessageChannel | null;
	createdAt: TimestampValue;
	expiresAt: TimestampValue | null;
}

export interface BulkJobResultMessage {
	applicationId: string;
	messageId: string;
	status: 'success' | 'failed';
}

export interface BulkJobError {
	applicationId: string;
	error: string;
	createdAt: TimestampValue;
}

export interface BulkGenerationJob {
	bulkJobId: string;
	companyId: string;
	recruiterId: string;
	jobId: string | null;
	stage: MessageStage;
	channel: MessageChannel;
	applicationIds: string[];
	status: BulkJobStatus;
	totalCount: number;
	successCount: number;
	failureCount: number;
	errors: BulkJobError[];
	resultMessages: BulkJobResultMessage[];
	requestedAt: TimestampValue;
	startedAt: TimestampValue | null;
	completedAt: TimestampValue | null;
	maxConcurrency: number;
	expiresAt: TimestampValue | null;
}
