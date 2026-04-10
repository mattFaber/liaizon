import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$server/firestore', () => ({
	firestoreRepository: {
		listCandidates: vi.fn(),
		listJobs: vi.fn(),
		listApplications: vi.fn(),
		listUsers: vi.fn(),
		listApplicationStageTransitions: vi.fn(),
		getCandidate: vi.fn(),
		getJob: vi.fn(),
		getApplication: vi.fn(),
		deleteCandidate: vi.fn(),
		deleteJob: vi.fn(),
		deleteApplication: vi.fn(),
		createApplicationStageTransition: vi.fn(),
		upsertApplication: vi.fn()
	}
}));

import { actions, load } from './+page.server';
import { firestoreRepository } from '$server/firestore';

function makeEvent(formData: FormData) {
	return {
		request: new Request('http://localhost/recruiter/pipeline', {
			method: 'POST',
			body: formData
		}),
		locals: {
			user: {
				uid: 'user_1',
				email: 'recruiter@example.com',
				companyId: 'company_1',
				role: 'recruiter'
			}
		}
	} as any;
}

function makeApplication() {
	const now = new Date('2026-04-06T00:00:00.000Z');
	return {
		applicationId: 'app_1',
		companyId: 'company_1',
		candidateId: 'cand_1',
		jobId: 'job_1',
		stage: 'initial_outreach',
		status: 'active',
		ownerUserId: 'user_1',
		collaboratorUserIds: [],
		priority: 'medium',
		source: null,
		notesSummary: null,
		latestMessageId: null,
		lastActivityAt: now,
		createdAt: now,
		updatedAt: now,
		archivedAt: null
	};
}

describe('pipeline actions', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('returns 400 for invalid stage transitions', async () => {
		const formData = new FormData();
		formData.append('applicationId', 'app_1');
		formData.append('stage', 'not_a_stage');

		const result = await actions.transitionApplicationStage(makeEvent(formData));

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Invalid stage value.' }
		});
	});

	it('returns 400 when application is closed', async () => {
		const formData = new FormData();
		formData.append('applicationId', 'app_1');
		formData.append('stage', 'follow_up');

		vi.mocked(firestoreRepository.getApplication).mockResolvedValue({
			applicationId: 'app_1',
			status: 'closed',
			stage: 'initial_outreach'
		} as any);

		const result = await actions.transitionApplicationStage(makeEvent(formData));

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Cannot move stage for a closed application.' }
		});
		expect(firestoreRepository.upsertApplication).not.toHaveBeenCalled();
	});

	it('updates stage and activity timestamps for valid transitions', async () => {
		const formData = new FormData();
		formData.append('applicationId', 'app_1');
		formData.append('stage', 'follow_up');
		formData.append('transitionNote', 'Candidate asked to reconnect later this week.');

		const existing = makeApplication();
		vi.mocked(firestoreRepository.getApplication).mockResolvedValue(existing as any);

		const result = await actions.transitionApplicationStage(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Application moved from initial_outreach to follow_up.'
		});
		expect(firestoreRepository.createApplicationStageTransition).toHaveBeenCalledTimes(1);
		expect(firestoreRepository.createApplicationStageTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				applicationId: 'app_1',
				fromStage: 'initial_outreach',
				toStage: 'follow_up',
				changedBy: 'user_1',
				note: 'Candidate asked to reconnect later this week.'
			})
		);
		expect(firestoreRepository.upsertApplication).toHaveBeenCalledTimes(1);
		expect(firestoreRepository.upsertApplication).toHaveBeenCalledWith(
			expect.objectContaining({
				applicationId: 'app_1',
				stage: 'follow_up'
			})
		);
	});

	it('archives an application and returns a success message', async () => {
		const formData = new FormData();
		formData.append('applicationId', 'app_1');

		const existing = makeApplication();
		vi.mocked(firestoreRepository.getApplication).mockResolvedValue(existing as any);

		const result = await actions.archiveApplication(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Application app_1 archived.'
		});
		expect(firestoreRepository.upsertApplication).toHaveBeenCalledTimes(1);
		expect(firestoreRepository.upsertApplication).toHaveBeenCalledWith(
			expect.objectContaining({
				applicationId: 'app_1',
				status: 'closed'
			})
		);
	});

	it('deletes a candidate', async () => {
		const formData = new FormData();
		formData.append('candidateId', 'cand_1');
		vi.mocked(firestoreRepository.getCandidate).mockResolvedValue({
			candidateId: 'cand_1',
			fullName: 'Alex Doe'
		} as any);

		const result = await actions.deleteCandidate(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Candidate Alex Doe deleted.'
		});
		expect(firestoreRepository.deleteCandidate).toHaveBeenCalledWith('company_1', 'cand_1');
	});

	it('deletes a job', async () => {
		const formData = new FormData();
		formData.append('jobId', 'job_1');
		vi.mocked(firestoreRepository.getJob).mockResolvedValue({
			jobId: 'job_1',
			title: 'Staff Engineer'
		} as any);

		const result = await actions.deleteJob(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Job Staff Engineer deleted.'
		});
		expect(firestoreRepository.deleteJob).toHaveBeenCalledWith('company_1', 'job_1');
	});

	it('deletes an application', async () => {
		const formData = new FormData();
		formData.append('applicationId', 'app_1');
		vi.mocked(firestoreRepository.getApplication).mockResolvedValue(makeApplication() as any);

		const result = await actions.deleteApplication(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Application app_1 deleted.'
		});
		expect(firestoreRepository.deleteApplication).toHaveBeenCalledWith('company_1', 'app_1');
	});
});

describe('pipeline load', () => {
	it('returns empty shape when user is not scoped to a company', async () => {
		const result = await load({
			locals: {
				user: {
					uid: 'user_1',
					email: 'recruiter@example.com',
					companyId: null,
					role: 'recruiter'
				}
			}
		} as any);

		expect(result).toEqual({
			candidates: [],
			jobs: [],
			applications: [],
			stageTransitionsByApplication: {},
			actorDisplayByUserId: {}
		});
	});

	it('returns stage transition map per application for scoped users', async () => {
		vi.mocked(firestoreRepository.listCandidates).mockResolvedValue([]);
		vi.mocked(firestoreRepository.listJobs).mockResolvedValue([]);
		vi.mocked(firestoreRepository.listUsers).mockResolvedValue([
			{
				userId: 'user_1',
				displayName: 'Avery Recruiter',
				email: 'avery@example.com'
			}
		] as any);
		vi.mocked(firestoreRepository.listApplications).mockResolvedValue([
			{ applicationId: 'app_1' },
			{ applicationId: 'app_2' }
		] as any);
		vi.mocked(firestoreRepository.listApplicationStageTransitions)
			.mockResolvedValueOnce([
				{
					transitionId: 'stg_1',
					fromStage: 'initial_outreach',
					toStage: 'follow_up',
					changedBy: 'user_1',
					createdAt: new Date('2026-04-06T00:00:00.000Z'),
					note: null
				}
			] as any)
			.mockResolvedValueOnce([]);

		const result = await load({
			locals: {
				user: {
					uid: 'user_1',
					email: 'recruiter@example.com',
					companyId: 'company_1',
					role: 'recruiter'
				}
			}
		} as any);

		expect(firestoreRepository.listApplicationStageTransitions).toHaveBeenCalledTimes(2);
		expect(firestoreRepository.listApplicationStageTransitions).toHaveBeenCalledWith(
			'company_1',
			'app_1'
		);
		expect(firestoreRepository.listApplicationStageTransitions).toHaveBeenCalledWith(
			'company_1',
			'app_2'
		);
		expect(result).toMatchObject({
			actorDisplayByUserId: {
				user_1: 'Avery Recruiter'
			},
			stageTransitionsByApplication: {
				app_1: [
					expect.objectContaining({
						transitionId: 'stg_1',
						fromStage: 'initial_outreach',
						toStage: 'follow_up'
					})
				],
				app_2: []
			}
		});
	});
});
