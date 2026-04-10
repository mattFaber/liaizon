import { firestoreRepository } from '$server/firestore';
import { requireSessionUser } from '$server/auth';
import {
	applicationSchema,
	candidateSchema,
	candidateVersionSchema,
	jobSchema,
	jobVersionSchema,
	messageStageSchema
} from '$validation/schemas';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { ApplicationStageTransition } from '$types';

function now(): Date {
	return new Date();
}

function makeId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID()}`;
}

export const load: PageServerLoad = async ({ locals }) => {
	const emptyTransitions: Record<string, ApplicationStageTransition[]> = {};
	const emptyActorDisplayByUserId: Record<string, string> = {};

	if (!locals.user?.companyId) {
		return {
			candidates: [],
			jobs: [],
			applications: [],
			stageTransitionsByApplication: emptyTransitions,
			actorDisplayByUserId: emptyActorDisplayByUserId
		};
	}

	const companyId = locals.user.companyId;

	const [candidates, jobs, applications, users] = await Promise.all([
		firestoreRepository.listCandidates(companyId),
		firestoreRepository.listJobs(companyId),
		firestoreRepository.listApplications(companyId),
		firestoreRepository.listUsers(companyId, 200)
	]);

	const actorDisplayByUserId = Object.fromEntries(
		users.map((user) => [user.userId, user.displayName || user.email || user.userId])
	);

	const stageTransitionsByApplication: Record<string, ApplicationStageTransition[]> = Object.fromEntries(
		await Promise.all(
			applications.map(async (application) => {
				const transitions = await firestoreRepository.listApplicationStageTransitions(
					companyId,
					application.applicationId
				);
				return [application.applicationId, transitions] as const;
			})
		)
	);

	return {
		companyId,
		candidates,
		jobs,
		applications,
		stageTransitionsByApplication,
		actorDisplayByUserId
	};
};

export const actions: Actions = {
	createCandidate: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for candidate creation.' });
		}

		const formData = await event.request.formData();
		const firstName = String(formData.get('firstName') ?? '').trim();
		const lastName = String(formData.get('lastName') ?? '').trim();
		const email = String(formData.get('email') ?? '').trim();
		const currentTitle = String(formData.get('currentTitle') ?? '').trim();

		const timestamp = now();
		const candidate = candidateSchema.parse({
			candidateId: makeId('cand'),
			companyId: user.companyId,
			firstName,
			lastName,
			fullName: `${firstName} ${lastName}`.trim(),
			email: email || null,
			phone: null,
			linkedinUrl: null,
			currentTitle: currentTitle || null,
			currentCompany: null,
			yearsExperience: null,
			highlights: [],
			resumeText: null,
			resumeTextSizeBytes: 0,
			resumeStorageMode: 'none',
			activeVersionNumber: 1,
			tags: [],
			createdBy: user.uid,
			createdAt: timestamp,
			updatedAt: timestamp,
			archivedAt: null,
			isActive: true
		});

		await firestoreRepository.upsertCandidate(candidate);
		return { success: true };
	},

	createJob: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for job creation.' });
		}

		const formData = await event.request.formData();
		const title = String(formData.get('title') ?? '').trim();
		const department = String(formData.get('department') ?? '').trim();

		const timestamp = now();
		const job = jobSchema.parse({
			jobId: makeId('job'),
			companyId: user.companyId,
			title,
			department: department || null,
			level: null,
			description: null,
			descriptionSizeBytes: 0,
			descriptionStorageMode: 'none',
			requiredSkills: [],
			preferredSkills: [],
			keyResponsibilities: [],
			location: null,
			employmentType: null,
			compensationMin: null,
			compensationMax: null,
			compensationCurrency: null,
			isOpen: true,
			activeVersionNumber: 1,
			createdBy: user.uid,
			createdAt: timestamp,
			updatedAt: timestamp,
			archivedAt: null
		});

		await firestoreRepository.upsertJob(job);
		return { success: true };
	},

	createApplication: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for application creation.' });
		}

		const formData = await event.request.formData();
		const candidateId = String(formData.get('candidateId') ?? '').trim();
		const jobId = String(formData.get('jobId') ?? '').trim();
		const priority = String(formData.get('priority') ?? 'medium').trim();

		const timestamp = now();
		const application = applicationSchema.parse({
			applicationId: makeId('app'),
			companyId: user.companyId,
			candidateId,
			jobId,
			stage: 'initial_outreach',
			status: 'active',
			ownerUserId: user.uid,
			collaboratorUserIds: [],
			priority,
			source: null,
			notesSummary: null,
			latestMessageId: null,
			lastActivityAt: timestamp,
			createdAt: timestamp,
			updatedAt: timestamp,
			archivedAt: null
		});

		await firestoreRepository.upsertApplication(application);
		return { success: true };
	},

	updateCandidate: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for candidate update.' });
		}

		const formData = await event.request.formData();
		const candidateId = String(formData.get('candidateId') ?? '').trim();
		const firstName = String(formData.get('firstName') ?? '').trim();
		const lastName = String(formData.get('lastName') ?? '').trim();
		const currentTitle = String(formData.get('currentTitle') ?? '').trim();

		const existingCandidate = await firestoreRepository.getCandidate(user.companyId, candidateId);
		if (!existingCandidate) {
			return fail(404, { error: 'Candidate not found.' });
		}

		const timestamp = now();

		const version = candidateVersionSchema.parse({
			versionId: makeId('candver'),
			companyId: user.companyId,
			candidateId,
			versionNumber: existingCandidate.activeVersionNumber,
			snapshot: existingCandidate,
			changedBy: user.uid,
			changeReason: 'Candidate profile update',
			createdAt: timestamp
		});

		const updatedCandidate = candidateSchema.parse({
			...existingCandidate,
			firstName,
			lastName,
			fullName: `${firstName} ${lastName}`.trim(),
			currentTitle: currentTitle || null,
			activeVersionNumber: existingCandidate.activeVersionNumber + 1,
			updatedAt: timestamp
		});

		await firestoreRepository.createCandidateVersion(version);
		await firestoreRepository.upsertCandidate(updatedCandidate);

		return { success: true };
	},

	archiveCandidate: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for candidate archive.' });
		}

		const formData = await event.request.formData();
		const candidateId = String(formData.get('candidateId') ?? '').trim();
		const candidate = await firestoreRepository.getCandidate(user.companyId, candidateId);

		if (!candidate) {
			return fail(404, { error: 'Candidate not found.' });
		}

		if (!candidate.isActive) {
			return {
				success: true,
				successMessage: `Candidate ${candidate.fullName} is already archived.`
			};
		}

		const timestamp = now();
		await firestoreRepository.upsertCandidate(
			candidateSchema.parse({
				...candidate,
				isActive: false,
				archivedAt: timestamp,
				updatedAt: timestamp
			})
		);

		return {
			success: true,
			successMessage: `Candidate ${candidate.fullName} archived.`
		};
	},

	deleteCandidate: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for candidate delete.' });
		}

		const formData = await event.request.formData();
		const candidateId = String(formData.get('candidateId') ?? '').trim();
		const candidate = await firestoreRepository.getCandidate(user.companyId, candidateId);
		if (!candidate) {
			return fail(404, { error: 'Candidate not found.' });
		}

		await firestoreRepository.deleteCandidate(user.companyId, candidateId);
		return {
			success: true,
			successMessage: `Candidate ${candidate.fullName} deleted.`
		};
	},

	updateJob: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for job update.' });
		}

		const formData = await event.request.formData();
		const jobId = String(formData.get('jobId') ?? '').trim();
		const title = String(formData.get('title') ?? '').trim();
		const department = String(formData.get('department') ?? '').trim();

		const existingJob = await firestoreRepository.getJob(user.companyId, jobId);
		if (!existingJob) {
			return fail(404, { error: 'Job not found.' });
		}

		const timestamp = now();

		const version = jobVersionSchema.parse({
			versionId: makeId('jobver'),
			companyId: user.companyId,
			jobId,
			versionNumber: existingJob.activeVersionNumber,
			snapshot: existingJob,
			changedBy: user.uid,
			changeReason: 'Job profile update',
			createdAt: timestamp
		});

		const updatedJob = jobSchema.parse({
			...existingJob,
			title,
			department: department || null,
			activeVersionNumber: existingJob.activeVersionNumber + 1,
			updatedAt: timestamp
		});

		await firestoreRepository.createJobVersion(version);
		await firestoreRepository.upsertJob(updatedJob);

		return { success: true };
	},

	archiveJob: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for job archive.' });
		}

		const formData = await event.request.formData();
		const jobId = String(formData.get('jobId') ?? '').trim();
		const job = await firestoreRepository.getJob(user.companyId, jobId);

		if (!job) {
			return fail(404, { error: 'Job not found.' });
		}

		if (!job.isOpen) {
			return {
				success: true,
				successMessage: `Job ${job.title} is already archived.`
			};
		}

		const timestamp = now();
		await firestoreRepository.upsertJob(
			jobSchema.parse({
				...job,
				isOpen: false,
				archivedAt: timestamp,
				updatedAt: timestamp
			})
		);

		return {
			success: true,
			successMessage: `Job ${job.title} archived.`
		};
	},

	deleteJob: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for job delete.' });
		}

		const formData = await event.request.formData();
		const jobId = String(formData.get('jobId') ?? '').trim();
		const job = await firestoreRepository.getJob(user.companyId, jobId);
		if (!job) {
			return fail(404, { error: 'Job not found.' });
		}

		await firestoreRepository.deleteJob(user.companyId, jobId);
		return {
			success: true,
			successMessage: `Job ${job.title} deleted.`
		};
	},

	archiveApplication: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for application archive.' });
		}

		const formData = await event.request.formData();
		const applicationId = String(formData.get('applicationId') ?? '').trim();
		const application = await firestoreRepository.getApplication(user.companyId, applicationId);

		if (!application) {
			return fail(404, { error: 'Application not found.' });
		}

		if (application.status === 'closed') {
			return {
				success: true,
				successMessage: `Application ${application.applicationId} is already archived.`
			};
		}

		const timestamp = now();
		await firestoreRepository.upsertApplication(
			applicationSchema.parse({
				...application,
				status: 'closed',
				archivedAt: timestamp,
				updatedAt: timestamp,
				lastActivityAt: timestamp
			})
		);

		return {
			success: true,
			successMessage: `Application ${application.applicationId} archived.`
		};
	},

	deleteApplication: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for application delete.' });
		}

		const formData = await event.request.formData();
		const applicationId = String(formData.get('applicationId') ?? '').trim();
		const application = await firestoreRepository.getApplication(user.companyId, applicationId);
		if (!application) {
			return fail(404, { error: 'Application not found.' });
		}

		await firestoreRepository.deleteApplication(user.companyId, applicationId);
		return {
			success: true,
			successMessage: `Application ${application.applicationId} deleted.`
		};
	},

	transitionApplicationStage: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for application stage transition.' });
		}

		const formData = await event.request.formData();
		const applicationId = String(formData.get('applicationId') ?? '').trim();
		const stageRaw = String(formData.get('stage') ?? '').trim();
		const transitionNoteRaw = String(formData.get('transitionNote') ?? '').trim();
		const transitionNote = transitionNoteRaw.length > 0 ? transitionNoteRaw : null;

		if (transitionNote && transitionNote.length > 500) {
			return fail(400, { error: 'Transition note must be 500 characters or less.' });
		}

		const stageResult = messageStageSchema.safeParse(stageRaw);
		if (!stageResult.success) {
			return fail(400, { error: 'Invalid stage value.' });
		}

		const application = await firestoreRepository.getApplication(user.companyId, applicationId);
		if (!application) {
			return fail(404, { error: 'Application not found.' });
		}

		if (application.status === 'closed') {
			return fail(400, { error: 'Cannot move stage for a closed application.' });
		}

		if (application.stage === stageResult.data) {
			return { success: true, successMessage: `Application is already in stage ${stageResult.data}.` };
		}

		const timestamp = now();
		await firestoreRepository.createApplicationStageTransition({
			transitionId: makeId('stg'),
			companyId: user.companyId,
			applicationId: application.applicationId,
			fromStage: application.stage,
			toStage: stageResult.data,
			changedBy: user.uid,
			createdAt: timestamp,
			note: transitionNote
		});

		await firestoreRepository.upsertApplication(
			applicationSchema.parse({
				...application,
				stage: stageResult.data,
				updatedAt: timestamp,
				lastActivityAt: timestamp
			})
		);

		return {
			success: true,
			successMessage: `Application moved from ${application.stage} to ${stageResult.data}.`
		};
	}
};
