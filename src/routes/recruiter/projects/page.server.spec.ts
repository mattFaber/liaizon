import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$server/firestore', () => ({
	firestoreRepository: {
		listProjects: vi.fn(),
		listApplications: vi.fn(),
		listUsers: vi.fn(),
		getProject: vi.fn(),
		upsertProject: vi.fn(),
		deleteProject: vi.fn()
	}
}));

import { actions, load } from './+page.server';
import { firestoreRepository } from '$server/firestore';

function makeEvent(formData: FormData) {
	return {
		request: new Request('http://localhost/recruiter/projects', {
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

function makeProject() {
	const timestamp = new Date('2026-04-07T00:00:00.000Z');
	return {
		projectId: 'proj_1',
		companyId: 'company_1',
		name: 'Outbound Q2',
		description: null,
		status: 'draft',
		ownerUserId: 'user_1',
		collaboratorUserIds: [],
		applicationIds: ['app_1'],
		tags: ['outbound'],
		startDate: null,
		endDate: null,
		createdAt: timestamp,
		updatedAt: timestamp,
		archivedAt: null,
		isActive: true
	};
}

describe('projects load', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('returns empty shape without company scope', async () => {
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
			companyId: null,
			projects: [],
			applications: [],
			users: []
		});
	});

	it('loads projects, applications, and users for a scoped user', async () => {
		vi.mocked(firestoreRepository.listProjects).mockResolvedValue([{ projectId: 'proj_1' }] as any);
		vi.mocked(firestoreRepository.listApplications).mockResolvedValue([{ applicationId: 'app_1' }] as any);
		vi.mocked(firestoreRepository.listUsers).mockResolvedValue([{ userId: 'user_1' }] as any);

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

		expect(result).toMatchObject({
			companyId: 'company_1',
			projects: [{ projectId: 'proj_1' }],
			applications: [{ applicationId: 'app_1' }],
			users: [{ userId: 'user_1' }]
		});
	});
});

describe('projects actions', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('creates a project', async () => {
		const formData = new FormData();
		formData.append('name', 'Outbound Q2');
		formData.append('description', 'Focus on data engineers.');
		formData.append('ownerUserId', 'user_1');
		formData.append('collaboratorUserIds', 'user_2, user_3');
		formData.append('applicationIds', 'app_1, app_2');
		formData.append('tags', 'outbound, q2');

		const result = await actions.createProject(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Project Outbound Q2 created.'
		});
		expect(firestoreRepository.upsertProject).toHaveBeenCalledTimes(1);
		expect(firestoreRepository.upsertProject).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Outbound Q2',
				collaboratorUserIds: ['user_2', 'user_3'],
				applicationIds: ['app_1', 'app_2'],
				tags: ['outbound', 'q2']
			})
		);
	});

	it('archives a project', async () => {
		const formData = new FormData();
		formData.append('projectId', 'proj_1');
		vi.mocked(firestoreRepository.getProject).mockResolvedValue(makeProject() as any);

		const result = await actions.archiveProject(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Project Outbound Q2 archived.'
		});
		expect(firestoreRepository.upsertProject).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: 'proj_1',
				status: 'archived',
				isActive: false
			})
		);
	});

	it('deletes a project', async () => {
		const formData = new FormData();
		formData.append('projectId', 'proj_1');
		vi.mocked(firestoreRepository.getProject).mockResolvedValue(makeProject() as any);

		const result = await actions.deleteProject(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Project Outbound Q2 deleted.'
		});
		expect(firestoreRepository.deleteProject).toHaveBeenCalledWith('company_1', 'proj_1');
	});
});
