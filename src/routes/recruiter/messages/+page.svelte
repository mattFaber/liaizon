<script lang="ts">
	import { resolve } from '$app/paths';
	import Toast from '$lib/components/Toast.svelte';

	let { data, form } = $props();
	let isGenerating = $state(false);
	let toastMessage = $derived(form?.error ?? form?.successMessage ?? (form?.success ? 'Message generated successfully.' : ''));
	let toastTone = $derived((form?.error ? 'error' : 'success') as 'error' | 'success');
	let optimisticHiddenById: Record<string, boolean> = $state({});
	let optimisticUpdatedById: Record<
		string,
		{ subject: string; message: string; wasApproved: boolean }
	> = $state({});

	const stages = [
		'initial_outreach',
		'follow_up',
		'interview_invite',
		'interview_follow_up',
		'offer_stage',
		'rejection'
	] as const;

	type MessageFilters = {
		channel: 'all' | 'email' | 'linkedin' | 'sms';
		stage:
			| 'all'
			| 'initial_outreach'
			| 'follow_up'
			| 'interview_invite'
			| 'interview_follow_up'
			| 'offer_stage'
			| 'rejection';
		q: string;
		sort: 'newest' | 'oldest' | 'tokens_desc';
	};

	type MessagePagination = {
		page: number;
		pageSize: number;
	};

	function formatTokens(totalTokens: number | undefined): string {
		return typeof totalTokens === 'number' ? `${totalTokens} tokens` : 'Token usage unavailable';
	}

	function viewMessage(message: (typeof data.messages)[number]) {
		const optimistic = optimisticUpdatedById[message.messageId];
		if (!optimistic) {
			return message;
		}

		return {
			...message,
			subject: optimistic.subject,
			message: optimistic.message,
			wasApproved: optimistic.wasApproved
		};
	}

	function handleOptimisticUpdateSubmit(event: SubmitEvent, messageId: string) {
		const formElement = event.currentTarget as HTMLFormElement;
		const formData = new FormData(formElement);
		optimisticUpdatedById = {
			...optimisticUpdatedById,
			[messageId]: {
				subject: String(formData.get('subject') ?? ''),
				message: String(formData.get('message') ?? ''),
				wasApproved: String(formData.get('wasApproved') ?? 'false') === 'true'
			}
		};
	}

	function handleOptimisticDeleteSubmit(messageId: string) {
		optimisticHiddenById = {
			...optimisticHiddenById,
			[messageId]: true
		};
	}

	$effect(() => {
		form;
		optimisticHiddenById = {};
		optimisticUpdatedById = {};
	});
</script>

<h2>Message Generation</h2>
<Toast message={toastMessage} tone={toastTone} />

<section class="panel">
	<h3>Generate Message</h3>
	<form method="POST" action="?/generateMessage" onsubmit={() => (isGenerating = true)}>
		<label>
			Application
			<select name="applicationId" required>
				<option value="">Select application</option>
				{#each data.applications as application (application.applicationId)}
					<option value={application.applicationId}>
						{application.applicationId} - {application.stage} ({application.status})
					</option>
				{/each}
			</select>
		</label>

		<label>
			Channel
			<select name="channel" required>
				<option value="email" selected>Email</option>
				<option value="linkedin">LinkedIn</option>
				<option value="sms">SMS</option>
			</select>
		</label>

		<label>
			Style strength
			<select name="styleStrength" required>
				<option value="low">Low</option>
				<option value="medium" selected>Medium</option>
				<option value="high">High</option>
			</select>
		</label>

		<label>
			Constraints (one per line)
			<textarea name="constraints" placeholder="Keep under 120 words"></textarea>
		</label>

		<label>
			Writing samples (one sample per line)
			<textarea name="writingSamples" placeholder="Optional style examples to guide tone"
			></textarea>
		</label>

		<button type="submit" disabled={data.applications.length === 0 || isGenerating}>
			{isGenerating ? 'Generating...' : 'Generate Message'}
		</button>
	</form>
</section>

<section class="panel">
	<h3>Generated Messages</h3>
	<form class="filters" method="GET">
		<input type="hidden" name="page" value="1" />

		<label>
			Channel
			<select name="channel">
				<option value="all" selected={data.initialFilters.channel === 'all'}>All channels</option>
				<option value="email" selected={data.initialFilters.channel === 'email'}>Email</option>
				<option value="linkedin" selected={data.initialFilters.channel === 'linkedin'}>
					LinkedIn
				</option>
				<option value="sms" selected={data.initialFilters.channel === 'sms'}>SMS</option>
			</select>
		</label>

		<label>
			Stage
			<select name="stage">
				<option value="all" selected={data.initialFilters.stage === 'all'}>All stages</option>
				{#each stages as stage (stage)}
					<option value={stage} selected={data.initialFilters.stage === stage}>{stage}</option>
				{/each}
			</select>
		</label>

		<label>
			Search
			<input type="search" name="q" value={data.initialFilters.q} placeholder="Candidate, job, subject, or body" />
		</label>

		<label>
			Sort by
			<select name="sort">
				<option value="newest" selected={data.initialFilters.sort === 'newest'}>Newest first</option>
				<option value="oldest" selected={data.initialFilters.sort === 'oldest'}>Oldest first</option>
				<option value="tokens_desc" selected={data.initialFilters.sort === 'tokens_desc'}>
					Highest token usage
				</option>
			</select>
		</label>

		<label>
			Page size
			<select name="pageSize">
				<option value="10" selected={data.initialPagination.pageSize === 10}>10</option>
				<option value="25" selected={data.initialPagination.pageSize === 25}>25</option>
				<option value="50" selected={data.initialPagination.pageSize === 50}>50</option>
			</select>
		</label>

		<div class="filter-actions">
			<button type="submit">Apply</button>
			<a href={resolve('/recruiter/messages')}>Clear</a>
		</div>
	</form>

	{#if data.messages.length === 0}
		{#if data.totalFilteredMessages === 0 && data.initialFilters.q.length === 0 && data.initialFilters.channel === 'all' && data.initialFilters.stage === 'all'}
			<p>No generated messages yet.</p>
		{:else}
			<p>No messages match the selected filters.</p>
		{/if}
	{:else}
		{#if data.pageAdjusted}
			<p class="page-adjusted-note">
				Requested page {data.requestedPage} is out of range. Showing page {data.currentPage} instead.
			</p>
		{/if}
		{#if data.scanLimitReached}
			<p class="scan-warning">
				Showing results from the first {data.scannedMessageCount} scanned messages. Refine filters to narrow results.
				<span class="scan-counter">Scanned {data.scannedMessageCount} / {data.scanLimit}</span>
				{#if data.hasMoreApprox}
					There may be additional matching messages outside this window.
				{/if}
			</p>
		{/if}
		<p class="result-summary">
			Showing {data.resultStart} to {data.resultEnd} of {data.totalFilteredMessages} messages (page {data.currentPage} of {data.totalPages})
			{#if data.scanLimitReached}
				<span class="partial-window-note">Partial result window</span>
				<details class="partial-window-help">
					<summary>What is this?</summary>
					<span>
						This list is computed from a capped scan window for performance, so additional matching messages may exist outside the current window.
					</span>
				</details>
			{/if}
		</p>
		<ul>
			{#each data.messages as message (message.messageId)}
				{#if !optimisticHiddenById[message.messageId]}
					{@const displayMessage = viewMessage(message)}
					<li>
					<div class="meta">
						<strong>{displayMessage.candidateName}</strong> for <strong>{displayMessage.jobTitle}</strong>
						<span>{displayMessage.stage} / {displayMessage.channel}</span>
					</div>
					<div class="meta-chips">
						<span>Template v{displayMessage.templateVersionUsed}</span>
						<span>{displayMessage.generationModel}</span>
						<span>{formatTokens(displayMessage.tokens?.totalTokens)}</span>
						<span>{displayMessage.generationLatencyMs} ms</span>
					</div>
					{#if displayMessage.subject}
						<p><strong>Subject:</strong> {displayMessage.subject}</p>
					{/if}
					<p>{displayMessage.message}</p>
					<form method="POST" action="?/updateMessage" class="inline-editor-form" onsubmit={(event) => handleOptimisticUpdateSubmit(event, message.messageId)}>
						<input type="hidden" name="messageId" value={displayMessage.messageId} />
						<input name="subject" value={displayMessage.subject ?? ''} placeholder="Subject" />
						<textarea name="message" rows="3">{displayMessage.message}</textarea>
						<select name="wasApproved">
							<option value="false" selected={!displayMessage.wasApproved}>false</option>
							<option value="true" selected={displayMessage.wasApproved}>true</option>
						</select>
						<button type="submit">Update Message</button>
					</form>
					<form method="POST" action="?/deleteMessage" class="inline-delete-form" onsubmit={() => handleOptimisticDeleteSubmit(message.messageId)}>
						<input type="hidden" name="messageId" value={message.messageId} />
						<button type="submit">Delete Message</button>
					</form>
					</li>
				{/if}
			{/each}
		</ul>

		{#if data.totalPages > 1}
			<nav class="pagination" aria-label="Message list pagination">
				<div class="pagination-actions">
					{#if data.currentPage > 1}
						<form method="GET" action={resolve('/recruiter/messages')}>
							<input type="hidden" name="channel" value={data.initialFilters.channel} />
							<input type="hidden" name="stage" value={data.initialFilters.stage} />
							<input type="hidden" name="q" value={data.initialFilters.q} />
							<input type="hidden" name="sort" value={data.initialFilters.sort} />
							<input type="hidden" name="pageSize" value={String(data.initialPagination.pageSize)} />
							<input type="hidden" name="page" value="1" />
							<button type="submit" class="pagination-button">First</button>
						</form>
						<form method="GET" action={resolve('/recruiter/messages')}>
							<input type="hidden" name="channel" value={data.initialFilters.channel} />
							<input type="hidden" name="stage" value={data.initialFilters.stage} />
							<input type="hidden" name="q" value={data.initialFilters.q} />
							<input type="hidden" name="sort" value={data.initialFilters.sort} />
							<input type="hidden" name="pageSize" value={String(data.initialPagination.pageSize)} />
							<input type="hidden" name="page" value={String(data.currentPage - 1)} />
							<button type="submit" class="pagination-button">Previous</button>
						</form>
					{:else}
						<span class="pagination-disabled">First</span>
						<span class="pagination-disabled">Previous</span>
					{/if}
				</div>

				<div class="pagination-center">
					<span>Page {data.currentPage} of {data.totalPages}</span>
					<form method="GET" action={resolve('/recruiter/messages')} class="page-jump-form">
						<input type="hidden" name="channel" value={data.initialFilters.channel} />
						<input type="hidden" name="stage" value={data.initialFilters.stage} />
						<input type="hidden" name="q" value={data.initialFilters.q} />
						<input type="hidden" name="sort" value={data.initialFilters.sort} />
						<input type="hidden" name="pageSize" value={String(data.initialPagination.pageSize)} />
						<label for="page-jump-input">Go to</label>
						<input
							id="page-jump-input"
							name="page"
							type="number"
							min="1"
							max={String(data.totalPages)}
							value={String(data.currentPage)}
						/>
						<button type="submit" class="pagination-button">Go</button>
					</form>
				</div>

				<div class="pagination-actions">
					{#if data.currentPage < data.totalPages}
						<form method="GET" action={resolve('/recruiter/messages')}>
							<input type="hidden" name="channel" value={data.initialFilters.channel} />
							<input type="hidden" name="stage" value={data.initialFilters.stage} />
							<input type="hidden" name="q" value={data.initialFilters.q} />
							<input type="hidden" name="sort" value={data.initialFilters.sort} />
							<input type="hidden" name="pageSize" value={String(data.initialPagination.pageSize)} />
							<input type="hidden" name="page" value={String(data.currentPage + 1)} />
							<button type="submit" class="pagination-button">Next</button>
						</form>
						<form method="GET" action={resolve('/recruiter/messages')}>
							<input type="hidden" name="channel" value={data.initialFilters.channel} />
							<input type="hidden" name="stage" value={data.initialFilters.stage} />
							<input type="hidden" name="q" value={data.initialFilters.q} />
							<input type="hidden" name="sort" value={data.initialFilters.sort} />
							<input type="hidden" name="pageSize" value={String(data.initialPagination.pageSize)} />
							<input type="hidden" name="page" value={String(data.totalPages)} />
							<button type="submit" class="pagination-button">Last</button>
						</form>
					{:else}
						<span class="pagination-disabled">Next</span>
						<span class="pagination-disabled">Last</span>
					{/if}
				</div>
			</nav>
		{/if}
	{/if}
</section>

<style>
	.panel {
		border: 1px solid #e4e4e7;
		border-radius: 0.75rem;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	form {
		display: grid;
		gap: 0.65rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
	}

	select,
	input,
	textarea,
	button {
		padding: 0.55rem 0.65rem;
		border: 1px solid #d4d4d8;
		border-radius: 0.5rem;
	}

	textarea {
		min-height: 5rem;
	}

	button {
		width: fit-content;
		background: white;
		cursor: pointer;
	}

	ul {
		margin: 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.75rem;
	}

	li {
		border: 1px solid #f1f5f9;
		border-radius: 0.5rem;
		padding: 0.6rem;
	}

	.inline-editor-form,
	.inline-delete-form {
		margin-top: 0.5rem;
	}

	.meta {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	.meta-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: 0.78rem;
		color: #52525b;
		margin: 0.35rem 0;
	}

	.meta-chips span {
		border: 1px solid #e4e4e7;
		border-radius: 999px;
		padding: 0.1rem 0.45rem;
		background: #fafafa;
	}

	.filters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.65rem;
		margin-bottom: 0.9rem;
	}

	.filter-actions {
		display: flex;
		align-items: end;
		gap: 0.5rem;
	}

	.filter-actions a {
		color: #0f172a;
		font-size: 0.9rem;
	}

	.result-summary {
		margin: 0 0 0.6rem;
		font-size: 0.9rem;
		color: #3f3f46;
	}

	.partial-window-note {
		margin-left: 0.45rem;
		padding: 0.08rem 0.38rem;
		border: 1px solid #facc15;
		border-radius: 999px;
		background: #fef9c3;
		color: #854d0e;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.partial-window-help {
		display: inline-block;
		margin-left: 0.35rem;
	}

	.partial-window-help summary {
		display: inline;
		cursor: pointer;
		font-size: 0.78rem;
		color: #7c2d12;
	}

	.partial-window-help span {
		display: block;
		margin-top: 0.35rem;
		padding: 0.45rem 0.55rem;
		border: 1px solid #fed7aa;
		border-radius: 0.45rem;
		background: #fff7ed;
		color: #7c2d12;
		font-size: 0.78rem;
		max-width: 38rem;
	}

	.scan-warning {
		margin: 0 0 0.6rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid #fde68a;
		border-radius: 0.5rem;
		background: #fffbeb;
		color: #92400e;
		font-size: 0.88rem;
	}

	.page-adjusted-note {
		margin: 0 0 0.6rem;
		padding: 0.45rem 0.62rem;
		border: 1px solid #bfdbfe;
		border-radius: 0.5rem;
		background: #eff6ff;
		color: #1e3a8a;
		font-size: 0.86rem;
	}

	.scan-counter {
		display: inline-block;
		margin: 0 0.35rem;
		padding: 0.08rem 0.38rem;
		border: 1px solid #facc15;
		border-radius: 999px;
		background: #fef9c3;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		margin-top: 0.8rem;
		flex-wrap: wrap;
	}

	.pagination-actions {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.pagination-center {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.page-jump-form {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.page-jump-form label {
		font-size: 0.85rem;
		color: #3f3f46;
	}

	.page-jump-form input[type='number'] {
		width: 4.5rem;
		padding: 0.3rem 0.45rem;
	}

	.pagination-button {
		padding: 0.35rem 0.55rem;
	}

	.pagination-disabled {
		color: #a1a1aa;
	}

</style>
