import { firestoreRepository } from '$server/firestore';
import { requireSessionUser } from '$server/auth';
import { projectSchema } from '$validation/schemas';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function now(): Date {
	return new Date();
}

function makeId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID()}`;
}

function parseIdList(raw: FormDataEntryValue | null): string[] {
	return String(raw ?? '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.companyId) {
		return {
			companyId: null,
			projects: [],
			applications: [],
			users: []
		};
	}

	const companyId = locals.user.companyId;
	const [projects, applications, users] = await Promise.all([
		firestoreRepository.listProjects(companyId, 200),
		firestoreRepository.listApplications(companyId, 200),
		firestoreRepository.listUsers(companyId, 200)
	]);

	return {
		companyId,
		projects,
		applications,
		users
	};
};

export const actions: Actions = {
	createProject: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for project creation.' });
		}

		const formData = await event.request.formData();
		const timestamp = now();
		const project = projectSchema.parse({
			projectId: makeId('proj'),
			companyId: user.companyId,
			name: String(formData.get('name') ?? '').trim(),
			description: String(formData.get('description') ?? '').trim() || null,
			status: 'draft',
			ownerUserId: String(formData.get('ownerUserId') ?? '').trim() || user.uid,
			collaboratorUserIds: parseIdList(formData.get('collaboratorUserIds')),
			applicationIds: parseIdList(formData.get('applicationIds')),
			tags: parseIdList(formData.get('tags')),
			startDate: null,
			endDate: null,
			createdAt: timestamp,
			updatedAt: timestamp,
			archivedAt: null,
			isActive: true
		});

		await firestoreRepository.upsertProject(project);
		return { success: true, successMessage: `Project ${project.name} created.` };
	},

	updateProject: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for project update.' });
		}

		const formData = await event.request.formData();
		const projectId = String(formData.get('projectId') ?? '').trim();
		const existingProject = await firestoreRepository.getProject(user.companyId, projectId);
		if (!existingProject) {
			return fail(404, { error: 'Project not found.' });
		}

		const timestamp = now();
		const updatedProject = projectSchema.parse({
			...existingProject,
			name: String(formData.get('name') ?? '').trim(),
			description: String(formData.get('description') ?? '').trim() || null,
			status: String(formData.get('status') ?? existingProject.status),
			ownerUserId: String(formData.get('ownerUserId') ?? '').trim() || existingProject.ownerUserId,
			collaboratorUserIds: parseIdList(formData.get('collaboratorUserIds')),
			applicationIds: parseIdList(formData.get('applicationIds')),
			tags: parseIdList(formData.get('tags')),
			updatedAt: timestamp
		});

		await firestoreRepository.upsertProject(updatedProject);
		return { success: true, successMessage: `Project ${updatedProject.name} updated.` };
	},

	archiveProject: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for project archive.' });
		}

		const formData = await event.request.formData();
		const projectId = String(formData.get('projectId') ?? '').trim();
		const project = await firestoreRepository.getProject(user.companyId, projectId);
		if (!project) {
			return fail(404, { error: 'Project not found.' });
		}

		if (!project.isActive) {
			return { success: true, successMessage: `Project ${project.name} is already archived.` };
		}

		const timestamp = now();
		await firestoreRepository.upsertProject(
			projectSchema.parse({
				...project,
				status: 'archived',
				isActive: false,
				archivedAt: timestamp,
				updatedAt: timestamp
			})
		);

		return { success: true, successMessage: `Project ${project.name} archived.` };
	},

	deleteProject: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for project delete.' });
		}

		const formData = await event.request.formData();
		const projectId = String(formData.get('projectId') ?? '').trim();
		const project = await firestoreRepository.getProject(user.companyId, projectId);
		if (!project) {
			return fail(404, { error: 'Project not found.' });
		}

		await firestoreRepository.deleteProject(user.companyId, projectId);
		return { success: true, successMessage: `Project ${project.name} deleted.` };
	}
};
