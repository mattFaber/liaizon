import { adminDb } from '$server/firebase-admin';
import {
	applicationSchema,
	applicationStageTransitionSchema,
	appSettingsSchema,
	bulkGenerationJobSchema,
	candidateSchema,
	candidateVersionSchema,
	companySchema,
	generatedMessageSchema,
	jobSchema,
	jobVersionSchema,
	projectSchema,
	promptTemplateSchema,
	systemInstructionVersionSchema,
	userSchema,
	writingSampleSchema
} from '$validation/schemas';
import type {
	Application,
	ApplicationStageTransition,
	AppSettings,
	BulkGenerationJob,
	Candidate,
	CandidateVersion,
	Company,
	GeneratedMessage,
	Job,
	JobVersion,
	Project,
	PromptTemplate,
	SystemInstructionVersion,
	User,
	WritingSample
} from '$types';

function normalizeFirestoreValue(value: unknown): unknown {
	if (value === null || value === undefined) {
		return value;
	}

	if (typeof value !== 'object') {
		return value;
	}

	if (value instanceof Date) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeFirestoreValue(item));
	}

	if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
		return (value as { toDate: () => Date }).toDate();
	}

	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
			key,
			normalizeFirestoreValue(entry)
		])
	);
}

function normalizeFirestoreDoc<T>(value: unknown): T {
	return normalizeFirestoreValue(value) as T;
}

function companyDoc(companyId: string) {
	return adminDb.collection('companies').doc(companyId);
}

function companyCollection(companyId: string, collectionName: string) {
	return companyDoc(companyId).collection(collectionName);
}

async function getById<T>(
	companyId: string,
	collectionName: string,
	id: string
): Promise<T | null> {
	const snapshot = await companyCollection(companyId, collectionName).doc(id).get();
	if (!snapshot.exists) {
		return null;
	}

	return normalizeFirestoreDoc<T>(snapshot.data());
}

async function setById<T extends FirebaseFirestore.DocumentData>(
	companyId: string,
	collectionName: string,
	id: string,
	value: T
): Promise<void> {
	await companyCollection(companyId, collectionName).doc(id).set(value, { merge: true });
}

async function deleteById(companyId: string, collectionName: string, id: string): Promise<void> {
	await companyCollection(companyId, collectionName).doc(id).delete();
}

async function setNestedById<T extends FirebaseFirestore.DocumentData>(
	companyId: string,
	parentCollection: string,
	parentId: string,
	nestedCollection: string,
	id: string,
	value: T
): Promise<void> {
	await companyCollection(companyId, parentCollection)
		.doc(parentId)
		.collection(nestedCollection)
		.doc(id)
		.set(value, { merge: true });
}

async function listCollection<T>(
	companyId: string,
	collectionName: string,
	orderByField: string,
	limit = 50
): Promise<T[]> {
	const snapshot = await companyCollection(companyId, collectionName)
		.orderBy(orderByField, 'desc')
		.limit(limit)
		.get();

	return snapshot.docs.map((doc) => normalizeFirestoreDoc<T>(doc.data()));
}

export const firestoreRepository = {
	async listCompanies(limit = 100): Promise<Company[]> {
		const snapshot = await adminDb
			.collection('companies')
			.orderBy('createdAt', 'desc')
			.limit(limit)
			.get();
		return snapshot.docs.map((doc) => normalizeFirestoreDoc<Company>(doc.data()));
	},

	async upsertCompany(company: Company): Promise<void> {
		companySchema.parse(company);
		await companyDoc(company.companyId).set(company, { merge: true });
	},

	async getCompany(companyId: string): Promise<Company | null> {
		const snapshot = await companyDoc(companyId).get();
		if (!snapshot.exists) {
			return null;
		}

		return normalizeFirestoreDoc<Company>(snapshot.data());
	},

	async deleteCompany(companyId: string): Promise<void> {
		await companyDoc(companyId).delete();
	},

	async upsertUser(user: User): Promise<void> {
		userSchema.parse(user);
		await setById(user.companyId, 'users', user.userId, user);
	},

	getUser(companyId: string, userId: string): Promise<User | null> {
		return getById<User>(companyId, 'users', userId);
	},

	listUsers(companyId: string, limit = 50): Promise<User[]> {
		return listCollection<User>(companyId, 'users', 'createdAt', limit);
	},

	async deleteUser(companyId: string, userId: string): Promise<void> {
		await deleteById(companyId, 'users', userId);
	},

	async upsertCandidate(candidate: Candidate): Promise<void> {
		candidateSchema.parse(candidate);
		await setById(candidate.companyId, 'candidates', candidate.candidateId, candidate);
	},

	async createCandidateVersion(version: CandidateVersion): Promise<void> {
		candidateVersionSchema.parse(version);
		await setNestedById(
			version.companyId,
			'candidates',
			version.candidateId,
			'versions',
			version.versionId,
			version
		);
	},

	getCandidate(companyId: string, candidateId: string): Promise<Candidate | null> {
		return getById<Candidate>(companyId, 'candidates', candidateId);
	},

	listCandidates(companyId: string, limit = 50): Promise<Candidate[]> {
		return listCollection<Candidate>(companyId, 'candidates', 'updatedAt', limit);
	},

	async deleteCandidate(companyId: string, candidateId: string): Promise<void> {
		await deleteById(companyId, 'candidates', candidateId);
	},

	async upsertJob(job: Job): Promise<void> {
		jobSchema.parse(job);
		await setById(job.companyId, 'jobs', job.jobId, job);
	},

	async createJobVersion(version: JobVersion): Promise<void> {
		jobVersionSchema.parse(version);
		await setNestedById(
			version.companyId,
			'jobs',
			version.jobId,
			'versions',
			version.versionId,
			version
		);
	},

	getJob(companyId: string, jobId: string): Promise<Job | null> {
		return getById<Job>(companyId, 'jobs', jobId);
	},

	listJobs(companyId: string, limit = 50): Promise<Job[]> {
		return listCollection<Job>(companyId, 'jobs', 'updatedAt', limit);
	},

	async deleteJob(companyId: string, jobId: string): Promise<void> {
		await deleteById(companyId, 'jobs', jobId);
	},

	async upsertApplication(application: Application): Promise<void> {
		applicationSchema.parse(application);
		await setById(application.companyId, 'applications', application.applicationId, application);
	},

	async createApplicationStageTransition(transition: ApplicationStageTransition): Promise<void> {
		applicationStageTransitionSchema.parse(transition);
		await setNestedById(
			transition.companyId,
			'applications',
			transition.applicationId,
			'stageTransitions',
			transition.transitionId,
			transition
		);
	},

	getApplication(companyId: string, applicationId: string): Promise<Application | null> {
		return getById<Application>(companyId, 'applications', applicationId);
	},

	listApplications(companyId: string, limit = 50): Promise<Application[]> {
		return listCollection<Application>(companyId, 'applications', 'updatedAt', limit);
	},

	async deleteApplication(companyId: string, applicationId: string): Promise<void> {
		await deleteById(companyId, 'applications', applicationId);
	},

	async listApplicationStageTransitions(
		companyId: string,
		applicationId: string,
		limit = 10
	): Promise<ApplicationStageTransition[]> {
		const snapshot = await companyCollection(companyId, 'applications')
			.doc(applicationId)
			.collection('stageTransitions')
			.orderBy('createdAt', 'desc')
			.limit(limit)
			.get();

		return snapshot.docs.map((doc) =>
			normalizeFirestoreDoc<ApplicationStageTransition>(doc.data())
		);
	},

	async upsertProject(project: Project): Promise<void> {
		projectSchema.parse(project);
		await setById(project.companyId, 'projects', project.projectId, project);
	},

	getProject(companyId: string, projectId: string): Promise<Project | null> {
		return getById<Project>(companyId, 'projects', projectId);
	},

	listProjects(companyId: string, limit = 50): Promise<Project[]> {
		return listCollection<Project>(companyId, 'projects', 'updatedAt', limit);
	},

	async deleteProject(companyId: string, projectId: string): Promise<void> {
		await deleteById(companyId, 'projects', projectId);
	},

	async upsertAppSettings(settings: AppSettings): Promise<void> {
		appSettingsSchema.parse(settings);
		await setById(settings.companyId, 'settings', settings.settingsId, settings);
	},

	getAppSettings(companyId: string, settingsId: string): Promise<AppSettings | null> {
		return getById<AppSettings>(companyId, 'settings', settingsId);
	},

	listAppSettings(companyId: string, limit = 50): Promise<AppSettings[]> {
		return listCollection<AppSettings>(companyId, 'settings', 'updatedAt', limit);
	},

	async deleteAppSettings(companyId: string, settingsId: string): Promise<void> {
		await deleteById(companyId, 'settings', settingsId);
	},

	async upsertSystemInstructionVersion(version: SystemInstructionVersion): Promise<void> {
		systemInstructionVersionSchema.parse(version);
		await setById(version.companyId, 'systemInstructionVersions', version.versionId, version);
	},

	getSystemInstructionVersion(
		companyId: string,
		versionId: string
	): Promise<SystemInstructionVersion | null> {
		return getById<SystemInstructionVersion>(companyId, 'systemInstructionVersions', versionId);
	},

	listSystemInstructionVersions(
		companyId: string,
		limit = 50
	): Promise<SystemInstructionVersion[]> {
		return listCollection<SystemInstructionVersion>(
			companyId,
			'systemInstructionVersions',
			'createdAt',
			limit
		);
	},

	async deleteSystemInstructionVersion(companyId: string, versionId: string): Promise<void> {
		await deleteById(companyId, 'systemInstructionVersions', versionId);
	},

	async upsertPromptTemplate(template: PromptTemplate): Promise<void> {
		promptTemplateSchema.parse(template);
		await setById(template.companyId, 'promptTemplates', template.templateId, template);
	},

	getPromptTemplate(companyId: string, templateId: string): Promise<PromptTemplate | null> {
		return getById<PromptTemplate>(companyId, 'promptTemplates', templateId);
	},

	listPromptTemplates(companyId: string, limit = 50): Promise<PromptTemplate[]> {
		return listCollection<PromptTemplate>(companyId, 'promptTemplates', 'updatedAt', limit);
	},

	async getLatestPromptTemplate(
		companyId: string,
		stage: PromptTemplate['stage'],
		channel: PromptTemplate['channel']
	): Promise<PromptTemplate | null> {
		const snapshot = await companyCollection(companyId, 'promptTemplates')
			.where('stage', '==', stage)
			.where('channel', '==', channel)
			.where('deprecated', '==', false)
			.orderBy('promptVersion', 'desc')
			.limit(1)
			.get();

		if (snapshot.empty) {
			return null;
		}

		return snapshot.docs[0].data() as PromptTemplate;
	},

	async deletePromptTemplate(companyId: string, templateId: string): Promise<void> {
		await deleteById(companyId, 'promptTemplates', templateId);
	},

	async upsertWritingSample(sample: WritingSample): Promise<void> {
		writingSampleSchema.parse(sample);
		await setById(sample.companyId, 'writingSamples', sample.sampleId, sample);
	},

	getWritingSample(companyId: string, sampleId: string): Promise<WritingSample | null> {
		return getById<WritingSample>(companyId, 'writingSamples', sampleId);
	},

	listWritingSamples(companyId: string, limit = 50): Promise<WritingSample[]> {
		return listCollection<WritingSample>(companyId, 'writingSamples', 'createdAt', limit);
	},

	async deleteWritingSample(companyId: string, sampleId: string): Promise<void> {
		await deleteById(companyId, 'writingSamples', sampleId);
	},

	async createGeneratedMessage(message: GeneratedMessage): Promise<void> {
		generatedMessageSchema.parse(message);
		await setById(message.companyId, 'generatedMessages', message.messageId, message);
	},

	async upsertGeneratedMessage(message: GeneratedMessage): Promise<void> {
		generatedMessageSchema.parse(message);
		await setById(message.companyId, 'generatedMessages', message.messageId, message);
	},

	getGeneratedMessage(companyId: string, messageId: string): Promise<GeneratedMessage | null> {
		return getById<GeneratedMessage>(companyId, 'generatedMessages', messageId);
	},

	async listGeneratedMessages(
		companyId: string,
		options?: {
			limit?: number;
			channel?: GeneratedMessage['channel'];
			stage?: GeneratedMessage['stage'];
			sortDirection?: 'asc' | 'desc';
		}
	): Promise<GeneratedMessage[]> {
		const limit = options?.limit ?? 50;
		const sortDirection = options?.sortDirection ?? 'desc';
		let query: FirebaseFirestore.Query = companyCollection(companyId, 'generatedMessages');
		if (options?.channel) {
			query = query.where('channel', '==', options.channel);
		}
		if (options?.stage) {
			query = query.where('stage', '==', options.stage);
		}

		const snapshot = await query.orderBy('createdAt', sortDirection).limit(limit).get();
		return snapshot.docs.map((doc) => doc.data() as GeneratedMessage);
	},

	async deleteGeneratedMessage(companyId: string, messageId: string): Promise<void> {
		await deleteById(companyId, 'generatedMessages', messageId);
	},

	async createBulkGenerationJob(job: BulkGenerationJob): Promise<void> {
		bulkGenerationJobSchema.parse(job);
		await setById(job.companyId, 'bulkGenerationJobs', job.bulkJobId, job);
	},

	getBulkGenerationJob(companyId: string, bulkJobId: string): Promise<BulkGenerationJob | null> {
		return getById<BulkGenerationJob>(companyId, 'bulkGenerationJobs', bulkJobId);
	},

	listBulkGenerationJobs(companyId: string, limit = 50): Promise<BulkGenerationJob[]> {
		return listCollection<BulkGenerationJob>(companyId, 'bulkGenerationJobs', 'requestedAt', limit);
	},

	async deleteBulkGenerationJob(companyId: string, bulkJobId: string): Promise<void> {
		await deleteById(companyId, 'bulkGenerationJobs', bulkJobId);
	}
};
