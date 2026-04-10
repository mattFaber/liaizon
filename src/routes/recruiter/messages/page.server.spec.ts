import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$server/ai', () => ({
	generateRecruiterMessage: vi.fn()
}));

vi.mock('$lib/logging', () => ({
	log: vi.fn()
}));

vi.mock('$server/firestore', () => ({
	firestoreRepository: {
		listApplications: vi.fn(),
		listGeneratedMessages: vi.fn(),
		getGeneratedMessage: vi.fn(),
		getApplication: vi.fn(),
		getCandidate: vi.fn(),
		getJob: vi.fn(),
		getCompany: vi.fn(),
		getLatestPromptTemplate: vi.fn(),
		createGeneratedMessage: vi.fn(),
		upsertGeneratedMessage: vi.fn(),
		deleteGeneratedMessage: vi.fn(),
		upsertApplication: vi.fn()
	}
}));

import { actions, load } from './+page.server';
import { generateRecruiterMessage } from '$server/ai';
import { firestoreRepository } from '$server/firestore';
import { log } from '$lib/logging';

function makeEvent(formData: FormData) {
	return {
		request: new Request('http://localhost/recruiter/messages', {
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

describe('messages actions', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('returns 502 when AI generation fails', async () => {
		const formData = new FormData();
		formData.append('applicationId', 'app_1');
		formData.append('channel', 'email');
		formData.append('constraints', 'Keep concise');
		formData.append('writingSamples', '');
		formData.append('styleStrength', 'medium');

		vi.mocked(firestoreRepository.getApplication).mockResolvedValue({
			applicationId: 'app_1',
			companyId: 'company_1',
			candidateId: 'cand_1',
			jobId: 'job_1',
			stage: 'initial_outreach',
			status: 'active'
		} as any);
		vi.mocked(firestoreRepository.getCandidate).mockResolvedValue({
			candidateId: 'cand_1',
			fullName: 'Alex Doe',
			highlights: ['5 years in backend engineering']
		} as any);
		vi.mocked(firestoreRepository.getJob).mockResolvedValue({
			jobId: 'job_1',
			title: 'Senior Engineer',
			description: 'Great role',
			keyResponsibilities: ['Build APIs']
		} as any);
		vi.mocked(firestoreRepository.getCompany).mockResolvedValue({ name: 'Acme' } as any);
		vi.mocked(firestoreRepository.getLatestPromptTemplate).mockResolvedValue(null);
		vi.mocked(generateRecruiterMessage).mockRejectedValue(new Error('Vertex error'));

		const result = await actions.generateMessage(makeEvent(formData));

		expect(result).toMatchObject({
			status: 502,
			data: { error: 'Message generation failed. Please retry.' }
		});
		expect(firestoreRepository.createGeneratedMessage).not.toHaveBeenCalled();
		expect(firestoreRepository.upsertApplication).not.toHaveBeenCalled();
	});

	it('updates an existing generated message', async () => {
		const formData = new FormData();
		formData.append('messageId', 'msg_1');
		formData.append('subject', 'Updated subject');
		formData.append('message', 'Updated body');
		formData.append('wasApproved', 'true');

		vi.mocked(firestoreRepository.getGeneratedMessage).mockResolvedValue({
			messageId: 'msg_1',
			companyId: 'company_1',
			applicationId: 'app_1',
			candidateId: 'cand_1',
			jobId: 'job_1',
			recruiterId: 'user_1',
			stage: 'initial_outreach',
			channel: 'email',
			subject: 'Original subject',
			message: 'Original body',
			sourceMessageId: null,
			isEditedVariant: false,
			templateVersionUsed: 1,
			systemPromptVersionUsed: '2026-04-06',
			generationModel: 'gemini-2.5-flash',
			generationLatencyMs: 123,
			tokens: { inputTokens: 1, outputTokens: 1 },
			rationale: ['a'],
			styleAlignmentNotes: [],
			qualityChecks: {
				factuallyGrounded: true,
				stageAligned: true,
				clearCta: true,
				withinLengthLimit: true,
				styleAlignedToSamples: true,
				professionalTone: true
			},
			writingSampleIds: [],
			candidateName: 'Alex Doe',
			jobTitle: 'Senior Engineer',
			wasApproved: false,
			sentAt: null,
			sentVia: null,
			createdAt: new Date('2026-04-01T00:00:00.000Z'),
			expiresAt: null
		} as any);

		const result = await actions.updateMessage(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Message msg_1 updated.'
		});
		expect(firestoreRepository.upsertGeneratedMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				messageId: 'msg_1',
				subject: 'Updated subject',
				message: 'Updated body',
				wasApproved: true,
				isEditedVariant: true
			})
		);
	});

	it('deletes a generated message and clears latest application pointer', async () => {
		const formData = new FormData();
		formData.append('messageId', 'msg_1');

		vi.mocked(firestoreRepository.getGeneratedMessage).mockResolvedValue({
			messageId: 'msg_1',
			applicationId: 'app_1'
		} as any);
		vi.mocked(firestoreRepository.getApplication).mockResolvedValue({
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
			latestMessageId: 'msg_1',
			lastActivityAt: new Date('2026-04-01T00:00:00.000Z'),
			createdAt: new Date('2026-04-01T00:00:00.000Z'),
			updatedAt: new Date('2026-04-01T00:00:00.000Z'),
			archivedAt: null
		} as any);

		const result = await actions.deleteMessage(makeEvent(formData));

		expect(result).toMatchObject({
			success: true,
			successMessage: 'Message msg_1 deleted.'
		});
		expect(firestoreRepository.deleteGeneratedMessage).toHaveBeenCalledWith('company_1', 'msg_1');
		expect(firestoreRepository.upsertApplication).toHaveBeenCalledWith(
			expect.objectContaining({
				applicationId: 'app_1',
				latestMessageId: null
			})
		);
	});
});

describe('messages load', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('parses valid filter params and returns data', async () => {
		vi.mocked(firestoreRepository.listApplications).mockResolvedValue([
			{ applicationId: 'app_1' }
		] as any);
		vi.mocked(firestoreRepository.listGeneratedMessages).mockResolvedValue([
			{
				messageId: 'msg_1',
				candidateName: 'Senior Backend Candidate',
				jobTitle: 'Staff Backend Engineer',
				message: 'Interested in discussing a senior backend role?',
				subject: 'Senior Backend Role',
				tokens: { totalTokens: 123 },
				createdAt: new Date('2026-04-01T00:00:00.000Z')
			}
		] as any);

		const result = await load({
			locals: {
				user: {
					companyId: 'company_1'
				}
			},
			url: new URL(
				'http://localhost/recruiter/messages?channel=linkedin&stage=follow_up&q=senior%20backend&sort=tokens_desc&page=3&pageSize=50'
			)
		} as any);

		expect(result).toMatchObject({
			applications: [{ applicationId: 'app_1' }],
			messages: [{ messageId: 'msg_1' }],
			totalFilteredMessages: 1,
			totalPages: 1,
			currentPage: 1,
			requestedPage: 3,
			pageAdjusted: true,
			resultStart: 1,
			resultEnd: 1,
			scannedMessageCount: 1,
			scanLimit: 500,
			scanLimitReached: false,
			hasMoreApprox: false,
			initialFilters: {
				channel: 'linkedin',
				stage: 'follow_up',
				q: 'senior backend',
				sort: 'tokens_desc'
			},
			initialPagination: {
				page: 1,
				pageSize: 50
			}
		});
		expect(firestoreRepository.listApplications).toHaveBeenCalledWith('company_1');
		expect(firestoreRepository.listGeneratedMessages).toHaveBeenCalledWith('company_1', {
			limit: 150,
			channel: 'linkedin',
			stage: 'follow_up',
			sortDirection: 'desc'
		});
		expect(log).not.toHaveBeenCalled();
	});

	it('falls back to defaults for invalid filter params', async () => {
		vi.mocked(firestoreRepository.listApplications).mockResolvedValue([] as any);
		vi.mocked(firestoreRepository.listGeneratedMessages).mockResolvedValue([] as any);

		const result = await load({
			locals: {
				user: {
					companyId: 'company_1'
				}
			},
			url: new URL(
				'http://localhost/recruiter/messages?channel=carrier-pigeon&stage=offer&sort=alpha&q=test&page=0&pageSize=999'
			)
		} as any);

		expect(result).toMatchObject({
			initialFilters: {
				channel: 'all',
				stage: 'all',
				q: 'test',
				sort: 'newest'
			},
			resultStart: 0,
			resultEnd: 0,
			requestedPage: 1,
			pageAdjusted: false,
			scannedMessageCount: 0,
			scanLimit: 500,
			scanLimitReached: false,
			hasMoreApprox: false,
			initialPagination: {
				page: 1,
				pageSize: 25
			}
		});
	});

	it('flags scan limit when requested page depth exceeds server cap', async () => {
		vi.mocked(firestoreRepository.listApplications).mockResolvedValue([] as any);
		vi.mocked(firestoreRepository.listGeneratedMessages).mockResolvedValue(
			Array.from({ length: 500 }, (_, index) => ({ messageId: `msg_${index}` })) as any
		);

		const result = await load({
			locals: {
				user: {
					companyId: 'company_1'
				}
			},
			url: new URL('http://localhost/recruiter/messages?page=40&pageSize=50')
		} as any);

		expect(result).toMatchObject({
			requestedPage: 40,
			pageAdjusted: true,
			scannedMessageCount: 500,
			scanLimit: 500,
			scanLimitReached: true,
			hasMoreApprox: true,
			initialPagination: {
				pageSize: 50
			}
		});
		expect(firestoreRepository.listGeneratedMessages).toHaveBeenCalledWith('company_1', {
			limit: 500,
			channel: undefined,
			stage: undefined,
			sortDirection: 'desc'
		});
		expect(log).toHaveBeenCalledWith(
			expect.objectContaining({
				level: 'info',
				message: 'Messages load reached scan limit window.',
				context: expect.objectContaining({
					companyId: 'company_1',
					requestedPage: 40,
					pageSize: 50,
					scanLimit: 500,
					scannedMessageCount: 500,
					hasSearchQuery: false
				})
			})
		);
	});

	it('returns empty data with parsed defaults when company scope missing', async () => {
		const result = await load({
			locals: {
				user: null
			},
			url: new URL('http://localhost/recruiter/messages?channel=email')
		} as any);

		expect(result).toMatchObject({
			applications: [],
			messages: [],
			initialFilters: {
				channel: 'email',
				stage: 'all',
				q: '',
				sort: 'newest'
			},
			resultStart: 0,
			resultEnd: 0,
			requestedPage: 1,
			pageAdjusted: false,
			scannedMessageCount: 0,
			scanLimit: 500,
			scanLimitReached: false,
			hasMoreApprox: false,
			initialPagination: {
				page: 1,
				pageSize: 25
			}
		});
		expect(firestoreRepository.listApplications).not.toHaveBeenCalled();
		expect(firestoreRepository.listGeneratedMessages).not.toHaveBeenCalled();
		expect(log).not.toHaveBeenCalled();
	});
});
