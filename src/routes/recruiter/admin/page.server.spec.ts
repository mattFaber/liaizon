import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$server/firestore', () => ({
	firestoreRepository: {
		getCompany: vi.fn(),
		listUsers: vi.fn(),
		listAppSettings: vi.fn(),
		listWritingSamples: vi.fn(),
		listPromptTemplates: vi.fn(),
		listSystemInstructionVersions: vi.fn(),
		upsertUser: vi.fn(),
		deleteUser: vi.fn(),
		upsertAppSettings: vi.fn(),
		deleteAppSettings: vi.fn(),
		upsertWritingSample: vi.fn(),
		deleteWritingSample: vi.fn(),
		upsertPromptTemplate: vi.fn(),
		deletePromptTemplate: vi.fn(),
		upsertSystemInstructionVersion: vi.fn(),
		deleteSystemInstructionVersion: vi.fn(),
		upsertCompany: vi.fn(),
		getUser: vi.fn(),
		getAppSettings: vi.fn(),
		getWritingSample: vi.fn(),
		getPromptTemplate: vi.fn(),
		getSystemInstructionVersion: vi.fn()
	}
}));

vi.mock('$server/auth', async () => {
	const actual = await vi.importActual<typeof import('$server/auth')>('$server/auth');

	return {
		...actual,
		verifyIdToken: vi.fn(),
		createSessionTokenFromIdToken: vi.fn()
	};
});

import { actions, load } from './+page.server';
import { createSessionTokenFromIdToken, verifyIdToken } from '$server/auth';
import { firestoreRepository } from '$server/firestore';

function makeEvent(formData: FormData, role: string = 'admin') {
	return {
		request: new Request('http://localhost/recruiter/admin', {
			method: 'POST',
			body: formData
		}),
		locals: {
			user: {
				uid: 'user_admin',
				email: 'admin@example.com',
				companyId: 'company_1',
				role
			}
		}
	} as any;
}

describe('admin load', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('returns empty shape when no company scope', async () => {
		const result = await load({
			locals: {
				user: {
					uid: 'u1',
					email: 'u@example.com',
					companyId: null,
					role: 'admin'
				}
			}
		} as any);

		expect(result).toEqual({
			company: null,
			users: [],
			settings: [],
			writingSamples: [],
			promptTemplates: [],
			systemInstructionVersions: [],
			adminAccess: false
		});
	});

	it('loads admin data for scoped users', async () => {
		vi.mocked(firestoreRepository.getCompany).mockResolvedValue({ companyId: 'company_1' } as any);
		vi.mocked(firestoreRepository.listUsers).mockResolvedValue([{ userId: 'u1' }] as any);
		vi.mocked(firestoreRepository.listAppSettings).mockResolvedValue([{ settingsId: 's1' }] as any);
		vi.mocked(firestoreRepository.listWritingSamples).mockResolvedValue([
			{ sampleId: 'w1' }
		] as any);
		vi.mocked(firestoreRepository.listPromptTemplates).mockResolvedValue([
			{ templateId: 't1' }
		] as any);
		vi.mocked(firestoreRepository.listSystemInstructionVersions).mockResolvedValue([
			{ versionId: 'v1' }
		] as any);

		const result = await load({
			locals: {
				user: {
					uid: 'u1',
					email: 'u@example.com',
					companyId: 'company_1',
					role: 'admin'
				}
			}
		} as any);

		expect(result).toMatchObject({
			company: { companyId: 'company_1' },
			users: [{ userId: 'u1' }],
			settings: [{ settingsId: 's1' }],
			writingSamples: [{ sampleId: 'w1' }],
			promptTemplates: [{ templateId: 't1' }],
			systemInstructionVersions: [{ versionId: 'v1' }],
			adminAccess: true
		});
	});
});

describe('admin actions', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('blocks non-admin users from write actions', async () => {
		const formData = new FormData();
		formData.append('email', 'new@example.com');
		formData.append('displayName', 'New User');

		const result = await actions.createUser(makeEvent(formData, 'recruiter'));
		expect(result).toMatchObject({
			status: 403,
			data: { error: 'Admin role is required.' }
		});
	});

	it('creates users', async () => {
		const formData = new FormData();
		formData.append('userId', 'user_2');
		formData.append('email', 'new@example.com');
		formData.append('displayName', 'New User');
		formData.append('role', 'recruiter');
		formData.append('preferencesJson', '{}');

		const result = await actions.createUser(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'User New User created.'
		});
		expect(firestoreRepository.upsertUser).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user_2',
				companyId: 'company_1',
				email: 'new@example.com',
				displayName: 'New User'
			})
		);
	});

	it('creates prompt templates', async () => {
		const formData = new FormData();
		formData.append('templateId', 'tmpl_1');
		formData.append('stage', 'initial_outreach');
		formData.append('channel', 'email');
		formData.append('promptVersion', '1');
		formData.append('basePrompt', 'Use concise outreach language and include a CTA.');
		formData.append('editableFields', 'tone, cta');
		formData.append('maxLengthWords', '120');
		formData.append('deprecated', 'false');

		const result = await actions.createPromptTemplate(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Prompt template tmpl_1 created.'
		});
		expect(firestoreRepository.upsertPromptTemplate).toHaveBeenCalledWith(
			expect.objectContaining({
				templateId: 'tmpl_1',
				editableFields: ['tone', 'cta']
			})
		);
	});

	it('mints bootstrap session cookie snippets for admin users', async () => {
		vi.mocked(verifyIdToken).mockResolvedValue({
			uid: 'user_admin',
			email: 'admin@example.com',
			companyId: 'company_1',
			role: 'admin'
		});
		vi.mocked(createSessionTokenFromIdToken).mockResolvedValue('mock_session_cookie');

		const formData = new FormData();
		formData.append('idToken', 'header.payload.signature');
		formData.append('companyId', 'company_1');
		formData.append('expiresDays', '7');

		const result = await actions.mintBootstrapSessionCookie(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Bootstrap session cookie generated.',
			companyId: 'company_1',
			expiresDays: 7
		});
		expect(result).toMatchObject({
			bootstrapSnippet: expect.stringContaining('AUTH_BOOTSTRAP_SESSION_COOKIE=mock_session_cookie')
		});
		expect(createSessionTokenFromIdToken).toHaveBeenCalledWith('header.payload.signature', 7);
	});
});
