<script lang="ts">
	import Toast from '$lib/components/Toast.svelte';

	let { data, form } = $props();
	let toastMessage = $derived(form?.error ?? form?.successMessage ?? '');
	let toastTone = $derived((form?.error ? 'error' : 'success') as 'error' | 'success');
	let optimisticHiddenCandidateById: Record<string, boolean> = $state({});
	let optimisticHiddenJobById: Record<string, boolean> = $state({});
	let optimisticHiddenApplicationById: Record<string, boolean> = $state({});
	let optimisticCandidateArchivedById: Record<string, boolean> = $state({});
	let optimisticJobArchivedById: Record<string, boolean> = $state({});
	let optimisticApplicationClosedById: Record<string, boolean> = $state({});

	const DEFAULT_VISIBLE_TRANSITIONS = 3;
	let expandedByApplication: Record<string, boolean> = {};
	let transitionSubmittingByApplication: Record<string, boolean> = {};
	let archiveCandidateSubmittingById: Record<string, boolean> = {};
	let archiveJobSubmittingById: Record<string, boolean> = {};
	let archiveApplicationSubmittingById: Record<string, boolean> = {};
	let deleteCandidateSubmittingById: Record<string, boolean> = {};
	let deleteJobSubmittingById: Record<string, boolean> = {};
	let deleteApplicationSubmittingById: Record<string, boolean> = {};
	let archiveCandidateConfirmById: Record<string, boolean> = {};
	let archiveJobConfirmById: Record<string, boolean> = {};
	let archiveApplicationConfirmById: Record<string, boolean> = {};
	let deleteCandidateConfirmById: Record<string, boolean> = {};
	let deleteJobConfirmById: Record<string, boolean> = {};
	let deleteApplicationConfirmById: Record<string, boolean> = {};

	const stages = [
		'initial_outreach',
		'follow_up',
		'interview_invite',
		'interview_follow_up',
		'offer_stage',
		'rejection'
	] as const;

	function transitionsFor(applicationId: string) {
		return data.stageTransitionsByApplication?.[applicationId] ?? [];
	}

	function viewCandidate(candidate: (typeof data.candidates)[number]) {
		if (!optimisticCandidateArchivedById[candidate.candidateId]) {
			return candidate;
		}

		return {
			...candidate,
			isActive: false
		};
	}

	function viewJob(job: (typeof data.jobs)[number]) {
		if (!optimisticJobArchivedById[job.jobId]) {
			return job;
		}

		return {
			...job,
			isOpen: false
		};
	}

	function viewApplication(application: (typeof data.applications)[number]) {
		if (!optimisticApplicationClosedById[application.applicationId]) {
			return application;
		}

		return {
			...application,
			status: 'closed' as const
		};
	}

	function isExpanded(applicationId: string): boolean {
		return expandedByApplication[applicationId] ?? false;
	}

	function visibleTransitionsFor(applicationId: string) {
		const transitions = transitionsFor(applicationId);
		if (isExpanded(applicationId)) {
			return transitions;
		}

		return transitions.slice(0, DEFAULT_VISIBLE_TRANSITIONS);
	}

	function toggleExpanded(applicationId: string) {
		expandedByApplication = {
			...expandedByApplication,
			[applicationId]: !isExpanded(applicationId)
		};
	}

	function isTransitionSubmitting(applicationId: string): boolean {
		return transitionSubmittingByApplication[applicationId] ?? false;
	}

	function setTransitionSubmitting(applicationId: string, isSubmitting: boolean) {
		transitionSubmittingByApplication = {
			...transitionSubmittingByApplication,
			[applicationId]: isSubmitting
		};
	}

	function isArchiveCandidateSubmitting(candidateId: string): boolean {
		return archiveCandidateSubmittingById[candidateId] ?? false;
	}

	function setArchiveCandidateSubmitting(candidateId: string, isSubmitting: boolean) {
		archiveCandidateSubmittingById = {
			...archiveCandidateSubmittingById,
			[candidateId]: isSubmitting
		};
	}

	function isArchiveCandidateConfirming(candidateId: string): boolean {
		return archiveCandidateConfirmById[candidateId] ?? false;
	}

	function setArchiveCandidateConfirming(candidateId: string, isConfirming: boolean) {
		archiveCandidateConfirmById = {
			...archiveCandidateConfirmById,
			[candidateId]: isConfirming
		};
	}

	function isArchiveJobSubmitting(jobId: string): boolean {
		return archiveJobSubmittingById[jobId] ?? false;
	}

	function setArchiveJobSubmitting(jobId: string, isSubmitting: boolean) {
		archiveJobSubmittingById = {
			...archiveJobSubmittingById,
			[jobId]: isSubmitting
		};
	}

	function isArchiveJobConfirming(jobId: string): boolean {
		return archiveJobConfirmById[jobId] ?? false;
	}

	function setArchiveJobConfirming(jobId: string, isConfirming: boolean) {
		archiveJobConfirmById = {
			...archiveJobConfirmById,
			[jobId]: isConfirming
		};
	}

	function isArchiveApplicationSubmitting(applicationId: string): boolean {
		return archiveApplicationSubmittingById[applicationId] ?? false;
	}

	function setArchiveApplicationSubmitting(applicationId: string, isSubmitting: boolean) {
		archiveApplicationSubmittingById = {
			...archiveApplicationSubmittingById,
			[applicationId]: isSubmitting
		};
	}

	function isArchiveApplicationConfirming(applicationId: string): boolean {
		return archiveApplicationConfirmById[applicationId] ?? false;
	}

	function setArchiveApplicationConfirming(applicationId: string, isConfirming: boolean) {
		archiveApplicationConfirmById = {
			...archiveApplicationConfirmById,
			[applicationId]: isConfirming
		};
	}

	function isDeleteCandidateSubmitting(candidateId: string): boolean {
		return deleteCandidateSubmittingById[candidateId] ?? false;
	}

	function setDeleteCandidateSubmitting(candidateId: string, isSubmitting: boolean) {
		deleteCandidateSubmittingById = {
			...deleteCandidateSubmittingById,
			[candidateId]: isSubmitting
		};
	}

	function isDeleteCandidateConfirming(candidateId: string): boolean {
		return deleteCandidateConfirmById[candidateId] ?? false;
	}

	function setDeleteCandidateConfirming(candidateId: string, isConfirming: boolean) {
		deleteCandidateConfirmById = {
			...deleteCandidateConfirmById,
			[candidateId]: isConfirming
		};
	}

	function handleArchiveCandidateSubmit(event: SubmitEvent, candidateId: string) {
		if (!isArchiveCandidateConfirming(candidateId)) {
			event.preventDefault();
			setArchiveCandidateConfirming(candidateId, true);
			return;
		}

		optimisticCandidateArchivedById = {
			...optimisticCandidateArchivedById,
			[candidateId]: true
		};
		setArchiveCandidateSubmitting(candidateId, true);
	}

	function handleDeleteCandidateSubmit(event: SubmitEvent, candidateId: string) {
		if (!isDeleteCandidateConfirming(candidateId)) {
			event.preventDefault();
			setDeleteCandidateConfirming(candidateId, true);
			return;
		}

		optimisticHiddenCandidateById = {
			...optimisticHiddenCandidateById,
			[candidateId]: true
		};
		setDeleteCandidateSubmitting(candidateId, true);
	}

	function isDeleteJobSubmitting(jobId: string): boolean {
		return deleteJobSubmittingById[jobId] ?? false;
	}

	function setDeleteJobSubmitting(jobId: string, isSubmitting: boolean) {
		deleteJobSubmittingById = {
			...deleteJobSubmittingById,
			[jobId]: isSubmitting
		};
	}

	function isDeleteJobConfirming(jobId: string): boolean {
		return deleteJobConfirmById[jobId] ?? false;
	}

	function setDeleteJobConfirming(jobId: string, isConfirming: boolean) {
		deleteJobConfirmById = {
			...deleteJobConfirmById,
			[jobId]: isConfirming
		};
	}

	function handleArchiveJobSubmit(event: SubmitEvent, jobId: string) {
		if (!isArchiveJobConfirming(jobId)) {
			event.preventDefault();
			setArchiveJobConfirming(jobId, true);
			return;
		}

		optimisticJobArchivedById = {
			...optimisticJobArchivedById,
			[jobId]: true
		};
		setArchiveJobSubmitting(jobId, true);
	}

	function handleDeleteJobSubmit(event: SubmitEvent, jobId: string) {
		if (!isDeleteJobConfirming(jobId)) {
			event.preventDefault();
			setDeleteJobConfirming(jobId, true);
			return;
		}

		optimisticHiddenJobById = {
			...optimisticHiddenJobById,
			[jobId]: true
		};
		setDeleteJobSubmitting(jobId, true);
	}

	function isDeleteApplicationSubmitting(applicationId: string): boolean {
		return deleteApplicationSubmittingById[applicationId] ?? false;
	}

	function setDeleteApplicationSubmitting(applicationId: string, isSubmitting: boolean) {
		deleteApplicationSubmittingById = {
			...deleteApplicationSubmittingById,
			[applicationId]: isSubmitting
		};
	}

	function isDeleteApplicationConfirming(applicationId: string): boolean {
		return deleteApplicationConfirmById[applicationId] ?? false;
	}

	function setDeleteApplicationConfirming(applicationId: string, isConfirming: boolean) {
		deleteApplicationConfirmById = {
			...deleteApplicationConfirmById,
			[applicationId]: isConfirming
		};
	}

	function handleArchiveApplicationSubmit(event: SubmitEvent, applicationId: string) {
		if (!isArchiveApplicationConfirming(applicationId)) {
			event.preventDefault();
			setArchiveApplicationConfirming(applicationId, true);
			return;
		}

		optimisticApplicationClosedById = {
			...optimisticApplicationClosedById,
			[applicationId]: true
		};
		setArchiveApplicationSubmitting(applicationId, true);
	}

	function handleDeleteApplicationSubmit(event: SubmitEvent, applicationId: string) {
		if (!isDeleteApplicationConfirming(applicationId)) {
			event.preventDefault();
			setDeleteApplicationConfirming(applicationId, true);
			return;
		}

		optimisticHiddenApplicationById = {
			...optimisticHiddenApplicationById,
			[applicationId]: true
		};
		setDeleteApplicationSubmitting(applicationId, true);
	}

	$effect(() => {
		form;
		transitionSubmittingByApplication = {};
		archiveCandidateSubmittingById = {};
		archiveJobSubmittingById = {};
		archiveApplicationSubmittingById = {};
		deleteCandidateSubmittingById = {};
		deleteJobSubmittingById = {};
		deleteApplicationSubmittingById = {};
		archiveCandidateConfirmById = {};
		archiveJobConfirmById = {};
		archiveApplicationConfirmById = {};
		deleteCandidateConfirmById = {};
		deleteJobConfirmById = {};
		deleteApplicationConfirmById = {};
		optimisticHiddenCandidateById = {};
		optimisticHiddenJobById = {};
		optimisticHiddenApplicationById = {};
		optimisticCandidateArchivedById = {};
		optimisticJobArchivedById = {};
		optimisticApplicationClosedById = {};
	});

	function actorNameFor(userId: string): string {
		return data.actorDisplayByUserId?.[userId] ?? userId;
	}

	function formatTransitionTime(value: unknown): string {
		if (value instanceof Date) {
			return value.toLocaleString();
		}

		if (typeof value === 'string' || typeof value === 'number') {
			const parsed = new Date(value);
			if (!Number.isNaN(parsed.getTime())) {
				return parsed.toLocaleString();
			}
		}

		if (typeof value === 'object' && value !== null && 'toDate' in value) {
			const maybeToDate = (value as { toDate?: () => Date }).toDate;
			if (typeof maybeToDate === 'function') {
				const parsed = maybeToDate();
				if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
					return parsed.toLocaleString();
				}
			}
		}

		return 'Unknown time';
	}
</script>

<h2>Pipeline Setup</h2>
<p>Company scope: {data.companyId}</p>
<Toast message={toastMessage} tone={toastTone} />

<div class="grid">
	<section>
		<h3>Create Candidate</h3>
		<form method="POST" action="?/createCandidate">
			<label>
				First name
				<input name="firstName" required />
			</label>
			<label>
				Last name
				<input name="lastName" required />
			</label>
			<label>
				Email
				<input name="email" type="email" />
			</label>
			<label>
				Current title
				<input name="currentTitle" />
			</label>
			<button type="submit">Create Candidate</button>
		</form>

		<h4>Candidates</h4>
		<ul>
			{#if data.candidates.length === 0}
				<li>No candidates yet.</li>
			{:else}
				{#each data.candidates as candidate (candidate.candidateId)}
					{#if !optimisticHiddenCandidateById[candidate.candidateId]}
						{@const displayCandidate = viewCandidate(candidate)}
						<li>
						<div class="entry-title">
							<strong>{displayCandidate.fullName}</strong> ({displayCandidate.candidateId})
							{#if !displayCandidate.isActive}
								<span class="status-chip">Archived</span>
							{/if}
						</div>
						<form method="POST" action="?/updateCandidate" class="entry-form">
							<input type="hidden" name="candidateId" value={displayCandidate.candidateId} />
							<input name="firstName" value={displayCandidate.firstName} required />
							<input name="lastName" value={displayCandidate.lastName} required />
							<input
								name="currentTitle"
								value={displayCandidate.currentTitle ?? ''}
								placeholder="Current title"
							/>
							<button type="submit">Update</button>
						</form>
						<div class="inline-actions">
							<form
								method="POST"
								action="?/archiveCandidate"
								class="inline-form"
								onsubmit={(event) => handleArchiveCandidateSubmit(event, displayCandidate.candidateId)}
							>
								<input type="hidden" name="candidateId" value={displayCandidate.candidateId} />
								<button
									type="submit"
									disabled={!displayCandidate.isActive || isArchiveCandidateSubmitting(displayCandidate.candidateId)}
								>
									{#if isArchiveCandidateSubmitting(displayCandidate.candidateId)}
										Archiving...
									{:else if isArchiveCandidateConfirming(displayCandidate.candidateId)}
										Confirm Archive
									{:else}
										Archive
									{/if}
								</button>
							</form>
							<form
								method="POST"
								action="?/deleteCandidate"
								class="inline-form"
								onsubmit={(event) => handleDeleteCandidateSubmit(event, displayCandidate.candidateId)}
							>
								<input type="hidden" name="candidateId" value={displayCandidate.candidateId} />
								<button type="submit" disabled={isDeleteCandidateSubmitting(displayCandidate.candidateId)}>
									{#if isDeleteCandidateSubmitting(displayCandidate.candidateId)}
										Deleting...
									{:else if isDeleteCandidateConfirming(displayCandidate.candidateId)}
										Confirm Delete
									{:else}
										Delete
									{/if}
								</button>
							</form>
						</div>
						{#if isArchiveCandidateConfirming(displayCandidate.candidateId) &&
							!isArchiveCandidateSubmitting(displayCandidate.candidateId)}
							<p class="confirm-hint">Click again to confirm archive.</p>
						{/if}
						{#if isDeleteCandidateConfirming(displayCandidate.candidateId) &&
							!isDeleteCandidateSubmitting(displayCandidate.candidateId)}
							<p class="confirm-hint">Click again to confirm delete.</p>
						{/if}
						</li>
					{/if}
				{/each}
			{/if}
		</ul>
	</section>

	<section>
		<h3>Create Job</h3>
		<form method="POST" action="?/createJob">
			<label>
				Title
				<input name="title" required />
			</label>
			<label>
				Department
				<input name="department" />
			</label>
			<button type="submit">Create Job</button>
		</form>

		<h4>Jobs</h4>
		<ul>
			{#if data.jobs.length === 0}
				<li>No jobs yet.</li>
			{:else}
				{#each data.jobs as job (job.jobId)}
					{#if !optimisticHiddenJobById[job.jobId]}
						{@const displayJob = viewJob(job)}
						<li>
						<div class="entry-title">
							<strong>{displayJob.title}</strong> ({displayJob.jobId})
							{#if !displayJob.isOpen}
								<span class="status-chip">Archived</span>
							{/if}
						</div>
						<form method="POST" action="?/updateJob" class="entry-form">
							<input type="hidden" name="jobId" value={displayJob.jobId} />
							<input name="title" value={displayJob.title} required />
							<input name="department" value={displayJob.department ?? ''} placeholder="Department" />
							<button type="submit">Update</button>
						</form>
						<div class="inline-actions">
							<form
								method="POST"
								action="?/archiveJob"
								class="inline-form"
								onsubmit={(event) => handleArchiveJobSubmit(event, displayJob.jobId)}
							>
								<input type="hidden" name="jobId" value={displayJob.jobId} />
								<button type="submit" disabled={!displayJob.isOpen || isArchiveJobSubmitting(displayJob.jobId)}>
									{#if isArchiveJobSubmitting(displayJob.jobId)}
										Archiving...
									{:else if isArchiveJobConfirming(displayJob.jobId)}
										Confirm Archive
									{:else}
										Archive
									{/if}
								</button>
							</form>
							<form
								method="POST"
								action="?/deleteJob"
								class="inline-form"
								onsubmit={(event) => handleDeleteJobSubmit(event, displayJob.jobId)}
							>
								<input type="hidden" name="jobId" value={displayJob.jobId} />
								<button type="submit" disabled={isDeleteJobSubmitting(displayJob.jobId)}>
									{#if isDeleteJobSubmitting(displayJob.jobId)}
										Deleting...
									{:else if isDeleteJobConfirming(displayJob.jobId)}
										Confirm Delete
									{:else}
										Delete
									{/if}
								</button>
							</form>
						</div>
						{#if isArchiveJobConfirming(displayJob.jobId) && !isArchiveJobSubmitting(displayJob.jobId)}
							<p class="confirm-hint">Click again to confirm archive.</p>
						{/if}
						{#if isDeleteJobConfirming(displayJob.jobId) && !isDeleteJobSubmitting(displayJob.jobId)}
							<p class="confirm-hint">Click again to confirm delete.</p>
						{/if}
						</li>
					{/if}
				{/each}
			{/if}
		</ul>
	</section>

	<section>
		<h3>Create Application</h3>
		<form method="POST" action="?/createApplication">
			<label>
				Candidate
				<select name="candidateId" required>
					<option value="">Select candidate</option>
					{#each data.candidates as candidate (candidate.candidateId)}
						<option value={candidate.candidateId}>{candidate.fullName}</option>
					{/each}
				</select>
			</label>
			<label>
				Job
				<select name="jobId" required>
					<option value="">Select job</option>
					{#each data.jobs as job (job.jobId)}
						<option value={job.jobId}>{job.title}</option>
					{/each}
				</select>
			</label>
			<label>
				Priority
				<select name="priority" required>
					<option value="low">Low</option>
					<option value="medium" selected>Medium</option>
					<option value="high">High</option>
				</select>
			</label>
			<button type="submit" disabled={data.candidates.length === 0 || data.jobs.length === 0}
				>Create Application</button
			>
		</form>

		<h4>Applications</h4>
		<ul>
			{#if data.applications.length === 0}
				<li>No applications yet.</li>
			{:else}
				{#each data.applications as application (application.applicationId)}
					{#if !optimisticHiddenApplicationById[application.applicationId]}
						{@const displayApplication = viewApplication(application)}
						<li>
						<div class="entry-title">
							<strong>{displayApplication.applicationId}</strong>: {displayApplication.stage} ({displayApplication.status})
						</div>
						<form
							method="POST"
							action="?/transitionApplicationStage"
							class="entry-form"
							onsubmit={() => setTransitionSubmitting(displayApplication.applicationId, true)}
						>
							<input type="hidden" name="applicationId" value={displayApplication.applicationId} />
							<select name="stage" required>
								{#each stages as stage (stage)}
									<option value={stage} selected={stage === displayApplication.stage}>{stage}</option>
								{/each}
							</select>
							<input
								name="transitionNote"
								placeholder="Optional transition note"
								maxlength="500"
							/>
							<button
								type="submit"
								disabled={displayApplication.status === 'closed' || isTransitionSubmitting(displayApplication.applicationId)}
							>
								{isTransitionSubmitting(displayApplication.applicationId) ? 'Moving...' : 'Move Stage'}
							</button>
						</form>
						{#if transitionsFor(displayApplication.applicationId).length > 0}
							<div class="transition-history">
								<p class="transition-title">Recent stage transitions</p>
								<ul>
									{#each visibleTransitionsFor(displayApplication.applicationId) as transition (transition.transitionId)}
										<li>
											<span>{transition.fromStage} -> {transition.toStage}</span>
											<small>
												by {actorNameFor(transition.changedBy)} at {formatTransitionTime(transition.createdAt)}
											</small>
											{#if transition.note}
												<em>{transition.note}</em>
											{/if}
										</li>
									{/each}
								</ul>
								{#if transitionsFor(displayApplication.applicationId).length > DEFAULT_VISIBLE_TRANSITIONS}
									<button
										type="button"
										class="link-button"
										onclick={() => toggleExpanded(displayApplication.applicationId)}
									>
										{isExpanded(displayApplication.applicationId) ? 'Show less' : 'Show more'}
									</button>
								{/if}
							</div>
						{/if}
						<div class="inline-actions">
							<form
								method="POST"
								action="?/archiveApplication"
								class="inline-form"
								onsubmit={(event) =>
									handleArchiveApplicationSubmit(event, displayApplication.applicationId)}
							>
								<input type="hidden" name="applicationId" value={displayApplication.applicationId} />
								<button
									type="submit"
									disabled={
										displayApplication.status === 'closed' ||
										isArchiveApplicationSubmitting(displayApplication.applicationId)
									}
								>
									{#if isArchiveApplicationSubmitting(displayApplication.applicationId)}
										Archiving...
									{:else if isArchiveApplicationConfirming(displayApplication.applicationId)}
										Confirm Archive
									{:else}
										Archive
									{/if}
								</button>
							</form>
							<form
								method="POST"
								action="?/deleteApplication"
								class="inline-form"
								onsubmit={(event) =>
									handleDeleteApplicationSubmit(event, displayApplication.applicationId)}
							>
								<input type="hidden" name="applicationId" value={displayApplication.applicationId} />
								<button
									type="submit"
									disabled={isDeleteApplicationSubmitting(displayApplication.applicationId)}
								>
									{#if isDeleteApplicationSubmitting(displayApplication.applicationId)}
										Deleting...
									{:else if isDeleteApplicationConfirming(displayApplication.applicationId)}
										Confirm Delete
									{:else}
										Delete
									{/if}
								</button>
							</form>
						</div>
						{#if isArchiveApplicationConfirming(displayApplication.applicationId) &&
							!isArchiveApplicationSubmitting(displayApplication.applicationId)}
							<p class="confirm-hint">Click again to confirm archive.</p>
						{/if}
						{#if isDeleteApplicationConfirming(displayApplication.applicationId) &&
							!isDeleteApplicationSubmitting(displayApplication.applicationId)}
							<p class="confirm-hint">Click again to confirm delete.</p>
						{/if}
						</li>
					{/if}
				{/each}
			{/if}
		</ul>
	</section>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1rem;
	}

	section {
		border: 1px solid #e4e4e7;
		border-radius: 0.75rem;
		padding: 1rem;
	}

	form {
		display: grid;
		gap: 0.6rem;
		margin-bottom: 1rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.95rem;
	}

	input,
	select,
	button {
		padding: 0.5rem 0.65rem;
		border: 1px solid #d4d4d8;
		border-radius: 0.5rem;
	}

	button {
		background: white;
		cursor: pointer;
	}

	ul {
		padding-left: 1rem;
		margin: 0;
		display: grid;
		gap: 0.35rem;
	}

	.entry-title {
		margin-bottom: 0.35rem;
	}

	.entry-form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.45rem;
		margin-bottom: 0.35rem;
	}

	.inline-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.2rem;
	}

	.inline-form {
		display: inline;
	}

	.status-chip {
		display: inline-block;
		margin-left: 0.35rem;
		padding: 0.1rem 0.45rem;
		font-size: 0.8rem;
		border: 1px solid #a1a1aa;
		border-radius: 999px;
	}

	.transition-history {
		margin: 0.25rem 0 0.5rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid #e4e4e7;
		border-radius: 0.5rem;
		background: #fafafa;
	}

	.transition-title {
		margin: 0 0 0.35rem;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.transition-history ul {
		margin: 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.2rem;
	}

	.transition-history li {
		display: grid;
		gap: 0.1rem;
		font-size: 0.85rem;
	}

	.transition-history em {
		font-style: italic;
		color: #52525b;
	}

	.transition-history small {
		color: #71717a;
		font-size: 0.78rem;
	}

	.link-button {
		padding: 0;
		margin-top: 0.35rem;
		border: none;
		background: transparent;
		color: #2563eb;
		font-size: 0.82rem;
		text-decoration: underline;
		cursor: pointer;
	}

	.confirm-hint {
		margin: 0.2rem 0 0;
		font-size: 0.78rem;
		color: #a16207;
	}

</style>
