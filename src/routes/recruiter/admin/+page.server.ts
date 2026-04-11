import { createSessionTokenFromIdToken, requireSessionUser, verifyIdToken } from '$server/auth';
import { firestoreRepository } from '$server/firestore';
import { log, logError } from '$lib/logging';
import {
	appSettingsSchema,
	companySchema,
	promptTemplateSchema,
	systemInstructionVersionSchema,
	userSchema,
	writingSampleSchema
} from '$validation/schemas';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function now(): Date {
	return new Date();
}

function makeId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID()}`;
}

function parseCsv(raw: FormDataEntryValue | null): string[] {
	return String(raw ?? '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
}

function parseJsonRecord(raw: FormDataEntryValue | null): Record<string, unknown> {
	const source = String(raw ?? '').trim();
	if (!source) {
		return {};
	}

	const parsed = JSON.parse(source) as unknown;
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error('Expected a JSON object.');
	}

	return parsed as Record<string, unknown>;
}

function parseFeatureFlags(raw: FormDataEntryValue | null): Record<string, boolean> {
	const parsed = parseJsonRecord(raw);
	const result: Record<string, boolean> = {};
	for (const [key, value] of Object.entries(parsed)) {
		result[key] = Boolean(value);
	}
	return result;
}

function requireAdminScope(event: Parameters<Actions[keyof Actions]>[0]) {
	const user = requireSessionUser(event);
	if (!user.companyId) {
		return { user, error: fail(400, { error: 'Missing company scope.' }) };
	}
	if (user.role !== 'admin') {
		return { user, error: fail(403, { error: 'Admin role is required.' }) };
	}

	return { user, error: null };
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.companyId) {
		return {
			company: null,
			users: [],
			settings: [],
			writingSamples: [],
			promptTemplates: [],
			systemInstructionVersions: [],
			adminAccess: false
		};
	}

	const companyId = locals.user.companyId;
	const [company, users, settings, writingSamples, promptTemplates, systemInstructionVersions] =
		await Promise.all([
			firestoreRepository.getCompany(companyId),
			firestoreRepository.listUsers(companyId, 200),
			firestoreRepository.listAppSettings(companyId, 200),
			firestoreRepository.listWritingSamples(companyId, 200),
			firestoreRepository.listPromptTemplates(companyId, 200),
			firestoreRepository.listSystemInstructionVersions(companyId, 200)
		]);

	return {
		company,
		users,
		settings,
		writingSamples,
		promptTemplates,
		systemInstructionVersions,
		adminAccess: locals.user.role === 'admin'
	};
};

export const actions: Actions = {
	upsertCompany: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const timestamp = now();
		const existing = await firestoreRepository.getCompany(user.companyId!);
		const company = companySchema.parse({
			companyId: user.companyId!,
			name: String(formData.get('name') ?? existing?.name ?? '').trim(),
			plan: String(formData.get('plan') ?? existing?.plan ?? 'free'),
			defaultLanguage: 'en',
			defaultStyleStrength: String(
				formData.get('defaultStyleStrength') ?? existing?.defaultStyleStrength ?? 'medium'
			),
			monthlyGenerationQuota: Number(formData.get('monthlyGenerationQuota') ?? 0),
			settings: parseJsonRecord(formData.get('settingsJson')),
			createdBy: existing?.createdBy ?? user.uid,
			createdAt: existing?.createdAt ?? timestamp,
			isActive: String(formData.get('isActive') ?? 'true') === 'true'
		});

		await firestoreRepository.upsertCompany(company);
		return { success: true, successMessage: 'Company updated.' };
	},

	deactivateCompany: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const company = await firestoreRepository.getCompany(user.companyId!);
		if (!company) {
			return fail(404, { error: 'Company not found.' });
		}

		await firestoreRepository.upsertCompany(
			companySchema.parse({
				...company,
				isActive: false
			})
		);

		return { success: true, successMessage: 'Company deactivated.' };
	},

	mintBootstrapSessionCookie: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const idToken = String(formData.get('idToken') ?? '').trim();
		const companyId = String(formData.get('companyId') ?? user.companyId ?? '').trim();
		const expiresDays = Number(formData.get('expiresDays') ?? 7);

		if (!idToken) {
			return fail(400, {
				error: 'Firebase ID token is required to mint a bootstrap session cookie.'
			});
		}

		if (!companyId) {
			return fail(400, { error: 'Company ID is required.' });
		}

		if (!Number.isInteger(expiresDays) || expiresDays < 1 || expiresDays > 14) {
			return fail(400, { error: 'Expires days must be an integer between 1 and 14.' });
		}

		try {
			const tokenUser = await verifyIdToken(idToken);
			if (tokenUser.uid !== user.uid) {
				return fail(403, {
					error: 'The provided Firebase ID token does not belong to the signed-in admin user.'
				});
			}

			const sessionCookie = await createSessionTokenFromIdToken(idToken, expiresDays);
			const bootstrapSnippet = [
				'AUTH_BOOTSTRAP_ENABLED=true',
				`AUTH_BOOTSTRAP_COMPANY_ID=${companyId}`,
				`AUTH_BOOTSTRAP_SESSION_COOKIE=${sessionCookie}`,
				'AUTH_BOOTSTRAP_ID_TOKEN='
			].join('\n');

			log({
				level: 'info',
				message: 'Admin minted bootstrap session cookie from recruiter admin panel.',
				context: {
					uid: user.uid,
					companyId,
					expiresDays
				}
			});

			return {
				success: true,
				successMessage: 'Bootstrap session cookie generated.',
				bootstrapSnippet,
				expiresDays,
				companyId
			};
		} catch (mintError) {
			logError('Failed to mint bootstrap session cookie in recruiter admin action.', mintError, {
				uid: user.uid,
				companyId,
				expiresDays
			});
			return fail(401, { error: 'Invalid Firebase ID token.' });
		}
	},

	createUser: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const newUser = userSchema.parse({
			userId: String(formData.get('userId') ?? makeId('usr')).trim(),
			companyId: user.companyId!,
			email: String(formData.get('email') ?? '').trim(),
			displayName: String(formData.get('displayName') ?? '').trim(),
			role: String(formData.get('role') ?? 'recruiter').trim(),
			preferences: parseJsonRecord(formData.get('preferencesJson')),
			lastLoginAt: null,
			createdAt: now(),
			isActive: true
		});

		await firestoreRepository.upsertUser(newUser);
		return { success: true, successMessage: `User ${newUser.displayName} created.` };
	},

	updateUser: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const userId = String(formData.get('userId') ?? '').trim();
		const existingUser = await firestoreRepository.getUser(user.companyId!, userId);
		if (!existingUser) {
			return fail(404, { error: 'User not found.' });
		}

		const updatedUser = userSchema.parse({
			...existingUser,
			displayName: String(formData.get('displayName') ?? existingUser.displayName).trim(),
			role: String(formData.get('role') ?? existingUser.role).trim(),
			preferences: parseJsonRecord(formData.get('preferencesJson')),
			isActive: String(formData.get('isActive') ?? String(existingUser.isActive)) === 'true'
		});

		await firestoreRepository.upsertUser(updatedUser);
		return { success: true, successMessage: `User ${updatedUser.displayName} updated.` };
	},

	deleteUser: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const userId = String(formData.get('userId') ?? '').trim();
		await firestoreRepository.deleteUser(user.companyId!, userId);
		return { success: true, successMessage: `User ${userId} deleted.` };
	},

	createSettings: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const settings = appSettingsSchema.parse({
			settingsId: String(formData.get('settingsId') ?? makeId('settings')).trim(),
			companyId: user.companyId!,
			defaultChannel: String(formData.get('defaultChannel') ?? 'email').trim(),
			defaultStage: String(formData.get('defaultStage') ?? 'initial_outreach').trim(),
			defaultStyleStrength: String(formData.get('defaultStyleStrength') ?? 'medium').trim(),
			featureFlags: parseFeatureFlags(formData.get('featureFlagsJson')),
			notificationPreferences: parseJsonRecord(formData.get('notificationPreferencesJson')),
			updatedBy: user.uid,
			updatedAt: now()
		});

		await firestoreRepository.upsertAppSettings(settings);
		return { success: true, successMessage: `Settings ${settings.settingsId} saved.` };
	},

	updateSettings: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const settingsId = String(formData.get('settingsId') ?? '').trim();
		const existing = await firestoreRepository.getAppSettings(user.companyId!, settingsId);
		if (!existing) {
			return fail(404, { error: 'Settings record not found.' });
		}

		const settings = appSettingsSchema.parse({
			...existing,
			defaultChannel: String(formData.get('defaultChannel') ?? existing.defaultChannel).trim(),
			defaultStage: String(formData.get('defaultStage') ?? existing.defaultStage).trim(),
			defaultStyleStrength: String(
				formData.get('defaultStyleStrength') ?? existing.defaultStyleStrength
			).trim(),
			featureFlags: parseFeatureFlags(formData.get('featureFlagsJson')),
			notificationPreferences: parseJsonRecord(formData.get('notificationPreferencesJson')),
			updatedBy: user.uid,
			updatedAt: now()
		});

		await firestoreRepository.upsertAppSettings(settings);
		return { success: true, successMessage: `Settings ${settings.settingsId} updated.` };
	},

	deleteSettings: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const settingsId = String((await event.request.formData()).get('settingsId') ?? '').trim();
		await firestoreRepository.deleteAppSettings(user.companyId!, settingsId);
		return { success: true, successMessage: `Settings ${settingsId} deleted.` };
	},

	createWritingSample: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const sample = writingSampleSchema.parse({
			sampleId: String(formData.get('sampleId') ?? makeId('sample')).trim(),
			companyId: user.companyId!,
			recruiterId: String(formData.get('recruiterId') ?? '').trim() || null,
			scope: String(formData.get('scope') ?? 'company').trim(),
			stage: String(formData.get('stage') ?? '').trim() || null,
			channel: String(formData.get('channel') ?? 'email').trim(),
			text: String(formData.get('text') ?? '').trim(),
			isActive: String(formData.get('isActive') ?? 'true') === 'true',
			sourceMessageId: String(formData.get('sourceMessageId') ?? '').trim() || null,
			createdAt: now()
		});

		await firestoreRepository.upsertWritingSample(sample);
		return { success: true, successMessage: `Writing sample ${sample.sampleId} created.` };
	},

	updateWritingSample: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const sampleId = String(formData.get('sampleId') ?? '').trim();
		const existing = await firestoreRepository.getWritingSample(user.companyId!, sampleId);
		if (!existing) {
			return fail(404, { error: 'Writing sample not found.' });
		}

		const sample = writingSampleSchema.parse({
			...existing,
			recruiterId: String(formData.get('recruiterId') ?? '').trim() || null,
			scope: String(formData.get('scope') ?? existing.scope).trim(),
			stage: String(formData.get('stage') ?? '').trim() || null,
			channel: String(formData.get('channel') ?? existing.channel).trim(),
			text: String(formData.get('text') ?? existing.text).trim(),
			isActive: String(formData.get('isActive') ?? String(existing.isActive)) === 'true'
		});

		await firestoreRepository.upsertWritingSample(sample);
		return { success: true, successMessage: `Writing sample ${sample.sampleId} updated.` };
	},

	deleteWritingSample: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const sampleId = String((await event.request.formData()).get('sampleId') ?? '').trim();
		await firestoreRepository.deleteWritingSample(user.companyId!, sampleId);
		return { success: true, successMessage: `Writing sample ${sampleId} deleted.` };
	},

	createPromptTemplate: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const template = promptTemplateSchema.parse({
			templateId: String(formData.get('templateId') ?? makeId('tmpl')).trim(),
			companyId: user.companyId!,
			stage: String(formData.get('stage') ?? 'initial_outreach').trim(),
			channel: String(formData.get('channel') ?? 'email').trim(),
			promptVersion: Number(formData.get('promptVersion') ?? 1),
			basePrompt: String(formData.get('basePrompt') ?? '').trim(),
			editableFields: parseCsv(formData.get('editableFields')),
			maxLengthWords: Number(formData.get('maxLengthWords') ?? 120),
			deprecated: String(formData.get('deprecated') ?? 'false') === 'true',
			updatedBy: user.uid,
			createdAt: now(),
			updatedAt: now()
		});

		await firestoreRepository.upsertPromptTemplate(template);
		return { success: true, successMessage: `Prompt template ${template.templateId} created.` };
	},

	updatePromptTemplate: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const templateId = String(formData.get('templateId') ?? '').trim();
		const existing = await firestoreRepository.getPromptTemplate(user.companyId!, templateId);
		if (!existing) {
			return fail(404, { error: 'Prompt template not found.' });
		}

		const template = promptTemplateSchema.parse({
			...existing,
			stage: String(formData.get('stage') ?? existing.stage).trim(),
			channel: String(formData.get('channel') ?? existing.channel).trim(),
			promptVersion: Number(formData.get('promptVersion') ?? existing.promptVersion),
			basePrompt: String(formData.get('basePrompt') ?? existing.basePrompt).trim(),
			editableFields: parseCsv(formData.get('editableFields')),
			maxLengthWords: Number(formData.get('maxLengthWords') ?? existing.maxLengthWords),
			deprecated: String(formData.get('deprecated') ?? String(existing.deprecated)) === 'true',
			updatedBy: user.uid,
			updatedAt: now()
		});

		await firestoreRepository.upsertPromptTemplate(template);
		return { success: true, successMessage: `Prompt template ${template.templateId} updated.` };
	},

	deletePromptTemplate: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const templateId = String((await event.request.formData()).get('templateId') ?? '').trim();
		await firestoreRepository.deletePromptTemplate(user.companyId!, templateId);
		return { success: true, successMessage: `Prompt template ${templateId} deleted.` };
	},

	createSystemInstructionVersion: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const version = systemInstructionVersionSchema.parse({
			versionId: String(formData.get('versionId') ?? makeId('sysv')).trim(),
			companyId: user.companyId!,
			versionLabel: String(formData.get('versionLabel') ?? '').trim(),
			instructionUri: String(formData.get('instructionUri') ?? '').trim(),
			lifecycle: String(formData.get('lifecycle') ?? 'active').trim(),
			createdBy: user.uid,
			createdAt: now(),
			notes: String(formData.get('notes') ?? '').trim() || null
		});

		await firestoreRepository.upsertSystemInstructionVersion(version);
		return { success: true, successMessage: `System instruction ${version.versionLabel} created.` };
	},

	updateSystemInstructionVersion: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const formData = await event.request.formData();
		const versionId = String(formData.get('versionId') ?? '').trim();
		const existing = await firestoreRepository.getSystemInstructionVersion(
			user.companyId!,
			versionId
		);
		if (!existing) {
			return fail(404, { error: 'System instruction version not found.' });
		}

		const version = systemInstructionVersionSchema.parse({
			...existing,
			versionLabel: String(formData.get('versionLabel') ?? existing.versionLabel).trim(),
			instructionUri: String(formData.get('instructionUri') ?? existing.instructionUri).trim(),
			lifecycle: String(formData.get('lifecycle') ?? existing.lifecycle).trim(),
			notes: String(formData.get('notes') ?? '').trim() || null
		});

		await firestoreRepository.upsertSystemInstructionVersion(version);
		return { success: true, successMessage: `System instruction ${version.versionLabel} updated.` };
	},

	deleteSystemInstructionVersion: async (event) => {
		const { user, error } = requireAdminScope(event);
		if (error) return error;

		const versionId = String((await event.request.formData()).get('versionId') ?? '').trim();
		await firestoreRepository.deleteSystemInstructionVersion(user.companyId!, versionId);
		return { success: true, successMessage: `System instruction version ${versionId} deleted.` };
	}
};
