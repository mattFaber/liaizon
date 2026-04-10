import { generateRecruiterMessage } from '$server/ai';
import { log } from '$lib/logging';
import { requireSessionUser } from '$server/auth';
import { firestoreRepository } from '$server/firestore';
import { generatedMessageSchema, recruiterMessageRequestSchema } from '$validation/schemas';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const CHANNEL_FILTERS = ['all', 'email', 'linkedin', 'sms'] as const;
const STAGE_FILTERS = [
	'all',
	'initial_outreach',
	'follow_up',
	'interview_invite',
	'interview_follow_up',
	'offer_stage',
	'rejection'
] as const;
const SORT_OPTIONS = ['newest', 'oldest', 'tokens_desc'] as const;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const MAX_MESSAGE_SCAN = 500;

function parseOneOf<T extends readonly string[]>(
	value: string | null,
	allowed: T,
	fallback: T[number]
): T[number] {
	if (value && allowed.includes(value)) {
		return value;
	}

	return fallback;
}

function parsePositiveInt(
	value: string | null,
	fallback: number,
	min: number,
	max: number
): number {
	const parsed = Number.parseInt(value ?? '', 10);
	if (Number.isNaN(parsed)) {
		return fallback;
	}

	return Math.max(min, Math.min(max, parsed));
}

function now(): Date {
	return new Date();
}

function makeId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID()}`;
}

function parseLines(raw: string): string[] {
	return raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const initialFilters = {
		channel: parseOneOf(url.searchParams.get('channel'), CHANNEL_FILTERS, 'all'),
		stage: parseOneOf(url.searchParams.get('stage'), STAGE_FILTERS, 'all'),
		q: (url.searchParams.get('q') ?? '').slice(0, 200),
		sort: parseOneOf(url.searchParams.get('sort'), SORT_OPTIONS, 'newest')
	};
	const initialPagination = {
		page: parsePositiveInt(url.searchParams.get('page'), 1, 1, 10_000),
		pageSize: parsePositiveInt(url.searchParams.get('pageSize'), 25, 1, 500)
	};
	if (!PAGE_SIZE_OPTIONS.includes(initialPagination.pageSize as (typeof PAGE_SIZE_OPTIONS)[number])) {
		initialPagination.pageSize = 25;
	}

	if (!locals.user?.companyId) {
		return {
			applications: [],
			messages: [],
			totalFilteredMessages: 0,
			totalPages: 1,
			currentPage: 1,
			requestedPage: initialPagination.page,
			pageAdjusted: initialPagination.page !== 1,
			resultStart: 0,
			resultEnd: 0,
			scannedMessageCount: 0,
			scanLimit: MAX_MESSAGE_SCAN,
			scanLimitReached: false,
			hasMoreApprox: false,
			initialFilters,
			initialPagination
		};
	}

	const companyId = locals.user.companyId;
	const fetchLimit = Math.max(initialPagination.page * initialPagination.pageSize, initialPagination.pageSize);
	const scanLimit = Math.min(fetchLimit, MAX_MESSAGE_SCAN);
	const [applications, allMessages] = await Promise.all([
		firestoreRepository.listApplications(companyId),
		firestoreRepository.listGeneratedMessages(companyId, {
			limit: scanLimit,
			channel: initialFilters.channel === 'all' ? undefined : initialFilters.channel,
			stage: initialFilters.stage === 'all' ? undefined : initialFilters.stage,
			sortDirection:
				initialFilters.sort === 'oldest' ? 'asc' : 'desc'
		})
	]);

	const normalizedQuery = initialFilters.q.trim().toLowerCase();
	const filteredMessages = allMessages.filter((message) => {
		if (!normalizedQuery) {
			return true;
		}

		return (
			message.candidateName.toLowerCase().includes(normalizedQuery) ||
			message.jobTitle.toLowerCase().includes(normalizedQuery) ||
			message.message.toLowerCase().includes(normalizedQuery) ||
			message.subject?.toLowerCase().includes(normalizedQuery) === true
		);
	});

	if (initialFilters.sort === 'tokens_desc') {
		filteredMessages.sort((a, b) => {
			const aTokens = a.tokens?.totalTokens ?? 0;
			const bTokens = b.tokens?.totalTokens ?? 0;
			if (bTokens !== aTokens) {
				return bTokens - aTokens;
			}

			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	}

	const totalFilteredMessages = filteredMessages.length;
	const totalPages = Math.max(1, Math.ceil(totalFilteredMessages / initialPagination.pageSize));
	const requestedPage = initialPagination.page;
	const currentPage = Math.min(Math.max(initialPagination.page, 1), totalPages);
	const pageAdjusted = requestedPage !== currentPage;
	const start = (currentPage - 1) * initialPagination.pageSize;
	const messages = filteredMessages.slice(start, start + initialPagination.pageSize);
	const resultStart = totalFilteredMessages === 0 ? 0 : start + 1;
	const resultEnd = totalFilteredMessages === 0 ? 0 : start + messages.length;
	const scanLimitReached = fetchLimit > MAX_MESSAGE_SCAN && allMessages.length >= scanLimit;

	if (scanLimitReached) {
		log({
			level: 'info',
			message: 'Messages load reached scan limit window.',
			context: {
				companyId,
				requestedPage: initialPagination.page,
				pageSize: initialPagination.pageSize,
				scanLimit,
				scannedMessageCount: allMessages.length,
				channel: initialFilters.channel,
				stage: initialFilters.stage,
				sort: initialFilters.sort,
				hasSearchQuery: normalizedQuery.length > 0
			}
		});
	}

	return {
		applications,
		messages,
		totalFilteredMessages,
		totalPages,
		currentPage,
		requestedPage,
		pageAdjusted,
		resultStart,
		resultEnd,
		scannedMessageCount: allMessages.length,
		scanLimit: MAX_MESSAGE_SCAN,
		scanLimitReached,
		hasMoreApprox: scanLimitReached,
		initialFilters,
		initialPagination: {
			page: currentPage,
			pageSize: initialPagination.pageSize
		}
	};
};

export const actions: Actions = {
	generateMessage: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for message generation.' });
		}

		const formData = await event.request.formData();
		const applicationId = String(formData.get('applicationId') ?? '').trim();
		const channel = String(formData.get('channel') ?? 'email').trim();
		const constraints = parseLines(String(formData.get('constraints') ?? ''));
		const writingSamples = parseLines(String(formData.get('writingSamples') ?? ''));
		const styleStrength = String(formData.get('styleStrength') ?? 'medium').trim();

		const application = await firestoreRepository.getApplication(user.companyId, applicationId);
		if (!application) {
			return fail(404, { error: 'Application not found.' });
		}

		const [candidate, job, company] = await Promise.all([
			firestoreRepository.getCandidate(user.companyId, application.candidateId),
			firestoreRepository.getJob(user.companyId, application.jobId),
			firestoreRepository.getCompany(user.companyId)
		]);

		if (!candidate || !job) {
			return fail(400, { error: 'Candidate or job record not found for this application.' });
		}

		const payloadResult = recruiterMessageRequestSchema.safeParse({
			channel,
			stage: application.stage,
			recruiterName: user.email ?? user.uid,
			companyName: company?.name ?? 'Your Company',
			roleTitle: job.title,
			keyRoleValueProp:
				job.description ??
				job.keyResponsibilities.slice(0, 3).join('; ') ??
				'Opportunity to contribute to a high-impact role.',
			candidateName: candidate.fullName,
			candidateHighlights: candidate.highlights,
			previousContactSummary: '',
			ctaType: 'reply',
			constraints,
			writingSamples,
			styleStrength
		});

		if (!payloadResult.success) {
			return fail(400, { error: 'Invalid message generation input. Check constraints and samples.' });
		}

		const requestPayload = payloadResult.data;
		const promptTemplate = await firestoreRepository.getLatestPromptTemplate(
			user.companyId,
			application.stage,
			requestPayload.channel
		);

		let aiResult;
		let generationLatencyMs;
		try {
			const startedAt = performance.now();
			aiResult = await generateRecruiterMessage({
				...requestPayload,
				templateGuidance: promptTemplate?.basePrompt
			});
			generationLatencyMs = Math.round(performance.now() - startedAt);
		} catch {
			return fail(502, { error: 'Message generation failed. Please retry.' });
		}

		const timestamp = now();
		const messageId = makeId('msg');

		const generatedMessage = generatedMessageSchema.parse({
			messageId,
			companyId: user.companyId,
			applicationId: application.applicationId,
			candidateId: candidate.candidateId,
			jobId: job.jobId,
			recruiterId: user.uid,
			stage: application.stage,
			channel: requestPayload.channel,
			subject: requestPayload.channel === 'email' ? aiResult.subject : '',
			message: aiResult.message,
			sourceMessageId: null,
			isEditedVariant: false,
			templateVersionUsed: promptTemplate?.promptVersion ?? 1,
			systemPromptVersionUsed: process.env.SYSTEM_PROMPT_VERSION ?? '2026-04-06',
			generationModel: aiResult.model,
			generationLatencyMs,
			tokens: aiResult.tokens,
			rationale: aiResult.rationale,
			styleAlignmentNotes: aiResult.styleAlignmentNotes,
			qualityChecks: aiResult.qualityChecks,
			writingSampleIds: [],
			candidateName: candidate.fullName,
			jobTitle: job.title,
			wasApproved: false,
			sentAt: null,
			sentVia: null,
			createdAt: timestamp,
			expiresAt: null
		});

		await firestoreRepository.createGeneratedMessage(generatedMessage);

		await firestoreRepository.upsertApplication({
			...application,
			latestMessageId: messageId,
			lastActivityAt: timestamp,
			updatedAt: timestamp
		});

		return {
			success: true,
			messageId
		};
	},

	updateMessage: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for message update.' });
		}

		const formData = await event.request.formData();
		const messageId = String(formData.get('messageId') ?? '').trim();
		const subject = String(formData.get('subject') ?? '').trim();
		const messageBody = String(formData.get('message') ?? '').trim();
		const wasApproved = String(formData.get('wasApproved') ?? 'false') === 'true';

		const existingMessage = await firestoreRepository.getGeneratedMessage(user.companyId, messageId);
		if (!existingMessage) {
			return fail(404, { error: 'Generated message not found.' });
		}

		const updatedMessage = generatedMessageSchema.parse({
			...existingMessage,
			subject: subject || existingMessage.subject,
			message: messageBody || existingMessage.message,
			wasApproved,
			isEditedVariant: true
		});

		await firestoreRepository.upsertGeneratedMessage(updatedMessage);

		return {
			success: true,
			successMessage: `Message ${messageId} updated.`
		};
	},

	deleteMessage: async (event) => {
		const user = requireSessionUser(event);
		if (!user.companyId) {
			return fail(400, { error: 'Missing company scope for message delete.' });
		}

		const formData = await event.request.formData();
		const messageId = String(formData.get('messageId') ?? '').trim();
		const existingMessage = await firestoreRepository.getGeneratedMessage(user.companyId, messageId);
		if (!existingMessage) {
			return fail(404, { error: 'Generated message not found.' });
		}

		await firestoreRepository.deleteGeneratedMessage(user.companyId, messageId);

		const linkedApplication = await firestoreRepository.getApplication(
			user.companyId,
			existingMessage.applicationId
		);
		if (linkedApplication?.latestMessageId === messageId) {
			const timestamp = now();
			await firestoreRepository.upsertApplication({
				...linkedApplication,
				latestMessageId: null,
				updatedAt: timestamp,
				lastActivityAt: timestamp
			});
		}

		return {
			success: true,
			successMessage: `Message ${messageId} deleted.`
		};
	}
};
