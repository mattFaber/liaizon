<script lang="ts">
	import Toast from '$lib/components/Toast.svelte';

	let { data, form } = $props();
	let toastMessage = $derived(form?.error ?? form?.successMessage ?? '');
	let toastTone = $derived((form?.error ? 'error' : 'success') as 'error' | 'success');
	let optimisticProjectUpdatesById: Record<
		string,
		{
			name: string;
			description: string | null;
			status: (typeof statuses)[number];
			ownerUserId: string;
			collaboratorUserIds: string[];
			applicationIds: string[];
			tags: string[];
			isActive: boolean;
		}
	> = $state({});
	let optimisticHiddenById: Record<string, boolean> = $state({});

	let archiveConfirmById: Record<string, boolean> = $state({});
	let deleteConfirmById: Record<string, boolean> = $state({});
	let archiveSubmittingById: Record<string, boolean> = $state({});
	let deleteSubmittingById: Record<string, boolean> = $state({});

	const statuses = ['draft', 'active', 'on_hold', 'completed', 'archived'] as const;

	function listToCsv(items: string[]): string {
		return items.join(', ');
	}

	function parseSelectedValues(formElement: HTMLFormElement, fieldName: string): string {
		const selected = Array.from(
			formElement.querySelectorAll<HTMLInputElement>(`input[name="${fieldName}"]:checked`)
		);
		return selected.map((input) => input.value).join(', ');
	}

	function parseCsv(value: string): string[] {
		return value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	function viewProject(project: (typeof data.projects)[number]) {
		const optimistic = optimisticProjectUpdatesById[project.projectId];
		if (!optimistic) {
			return project;
		}

		return {
			...project,
			...optimistic
		};
	}

	function handleUpdateSubmit(event: SubmitEvent) {
		const formElement = event.currentTarget as HTMLFormElement;
		const applicationIdsInput = formElement.querySelector<HTMLInputElement>(
			'input[name="applicationIds"]'
		);
		const collaboratorInput = formElement.querySelector<HTMLInputElement>(
			'input[name="collaboratorUserIds"]'
		);
		const projectId = String(new FormData(formElement).get('projectId') ?? '');
		if (applicationIdsInput) {
			applicationIdsInput.value = parseSelectedValues(formElement, 'applicationIdSelected');
		}
		if (collaboratorInput) {
			collaboratorInput.value = parseSelectedValues(formElement, 'collaboratorUserIdSelected');
		}

		const formData = new FormData(formElement);
		const status = String(formData.get('status') ?? 'draft') as (typeof statuses)[number];
		optimisticProjectUpdatesById = {
			...optimisticProjectUpdatesById,
			[projectId]: {
				name: String(formData.get('name') ?? ''),
				description: String(formData.get('description') ?? '').trim() || null,
				status,
				ownerUserId: String(formData.get('ownerUserId') ?? ''),
				collaboratorUserIds: parseCsv(String(formData.get('collaboratorUserIds') ?? '')),
				applicationIds: parseCsv(String(formData.get('applicationIds') ?? '')),
				tags: parseCsv(String(formData.get('tags') ?? '')),
				isActive: status !== 'archived'
			}
		};
	}

	function handleArchive(event: SubmitEvent, projectId: string) {
		if (!archiveConfirmById[projectId]) {
			event.preventDefault();
			archiveConfirmById = { ...archiveConfirmById, [projectId]: true };
			return;
		}

		const current = data.projects.find((project) => project.projectId === projectId);
		if (current) {
			optimisticProjectUpdatesById = {
				...optimisticProjectUpdatesById,
				[projectId]: {
					...viewProject(current),
					isActive: false,
					status: 'archived'
				}
			};
		}

		archiveSubmittingById = { ...archiveSubmittingById, [projectId]: true };
	}

	function handleDelete(event: SubmitEvent, projectId: string) {
		if (!deleteConfirmById[projectId]) {
			event.preventDefault();
			deleteConfirmById = { ...deleteConfirmById, [projectId]: true };
			return;
		}

		optimisticHiddenById = { ...optimisticHiddenById, [projectId]: true };
		deleteSubmittingById = { ...deleteSubmittingById, [projectId]: true };
	}

	$effect(() => {
		form;
		optimisticProjectUpdatesById = {};
		optimisticHiddenById = {};
	});
</script>

<h2>Projects</h2>
<p>Company scope: {data.companyId}</p>
<Toast message={toastMessage} tone={toastTone} />

<section>
	<h3>Create Project</h3>
	<form method="POST" action="?/createProject">
		<label>
			Name
			<input name="name" required />
		</label>
		<label>
			Description
			<textarea name="description" rows="3"></textarea>
		</label>
		<label>
			Owner
			<select name="ownerUserId">
				{#each data.users as user (user.userId)}
					<option value={user.userId}>{user.displayName || user.email || user.userId}</option>
				{/each}
			</select>
		</label>
		<label>
			Collaborator IDs (comma separated)
			<input name="collaboratorUserIds" placeholder="user_1, user_2" />
		</label>
		<label>
			Application IDs (comma separated)
			<input name="applicationIds" placeholder="app_1, app_2" />
		</label>
		<label>
			Tags (comma separated)
			<input name="tags" placeholder="priority, outbound" />
		</label>
		<button type="submit">Create Project</button>
	</form>
</section>

<section>
	<h3>Existing Projects</h3>
	{#if data.projects.length === 0}
		<p>No projects yet.</p>
	{:else}
		<ul>
			{#each data.projects as project (project.projectId)}
				{#if !optimisticHiddenById[project.projectId]}
					{@const displayProject = viewProject(project)}
					<li>
						<div class="entry-title">
							<strong>{displayProject.name}</strong> ({displayProject.projectId})
							{#if !displayProject.isActive}
								<span class="status-chip">Archived</span>
							{/if}
						</div>
						<form
							method="POST"
							action="?/updateProject"
							onsubmit={handleUpdateSubmit}
							class="entry-form"
						>
							<input type="hidden" name="projectId" value={displayProject.projectId} />
							<input name="name" value={displayProject.name} required />
							<textarea name="description" rows="2">{displayProject.description ?? ''}</textarea>
							<select name="status">
								{#each statuses as status (status)}
									<option value={status} selected={displayProject.status === status}
										>{status}</option
									>
								{/each}
							</select>
							<select name="ownerUserId">
								{#each data.users as user (user.userId)}
									<option value={user.userId} selected={displayProject.ownerUserId === user.userId}>
										{user.displayName || user.email || user.userId}
									</option>
								{/each}
							</select>
							<details>
								<summary>Project relationships</summary>
								<p>Collaborators</p>
								{#each data.users as user (user.userId)}
									<label class="checkbox-row">
										<input
											type="checkbox"
											name="collaboratorUserIdSelected"
											value={user.userId}
											checked={displayProject.collaboratorUserIds.includes(user.userId)}
										/>
										{user.displayName || user.email || user.userId}
									</label>
								{/each}
								<p>Applications</p>
								{#each data.applications as application (application.applicationId)}
									<label class="checkbox-row">
										<input
											type="checkbox"
											name="applicationIdSelected"
											value={application.applicationId}
											checked={displayProject.applicationIds.includes(application.applicationId)}
										/>
										{application.applicationId}
									</label>
								{/each}
							</details>
							<input
								type="hidden"
								name="collaboratorUserIds"
								value={listToCsv(displayProject.collaboratorUserIds)}
							/>
							<input
								type="hidden"
								name="applicationIds"
								value={listToCsv(displayProject.applicationIds)}
							/>
							<input
								name="tags"
								value={listToCsv(displayProject.tags)}
								placeholder="tag_1, tag_2"
							/>
							<button type="submit">Update</button>
						</form>
						<div class="action-row">
							<form
								method="POST"
								action="?/archiveProject"
								onsubmit={(event) => handleArchive(event, displayProject.projectId)}
							>
								<input type="hidden" name="projectId" value={displayProject.projectId} />
								<button
									type="submit"
									disabled={!displayProject.isActive ||
										archiveSubmittingById[displayProject.projectId]}
								>
									{#if archiveSubmittingById[displayProject.projectId]}
										Archiving...
									{:else if archiveConfirmById[displayProject.projectId]}
										Confirm Archive
									{:else}
										Archive
									{/if}
								</button>
							</form>
							<form
								method="POST"
								action="?/deleteProject"
								onsubmit={(event) => handleDelete(event, displayProject.projectId)}
							>
								<input type="hidden" name="projectId" value={displayProject.projectId} />
								<button type="submit" disabled={deleteSubmittingById[displayProject.projectId]}>
									{#if deleteSubmittingById[displayProject.projectId]}
										Deleting...
									{:else if deleteConfirmById[displayProject.projectId]}
										Confirm Delete
									{:else}
										Delete
									{/if}
								</button>
							</form>
						</div>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
</section>

<style>
	section {
		display: grid;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	form {
		display: grid;
		gap: 0.5rem;
	}

	label {
		display: grid;
		gap: 0.35rem;
	}

	ul {
		display: grid;
		gap: 1rem;
		padding: 0;
		list-style: none;
	}

	li {
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 0.5rem;
		display: grid;
		gap: 0.75rem;
	}

	.entry-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.entry-form {
		display: grid;
		gap: 0.5rem;
	}

	.action-row {
		display: flex;
		gap: 0.5rem;
	}

	.status-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.1rem 0.4rem;
		border-radius: 9999px;
		background: #f3f4f6;
		font-size: 0.75rem;
	}

	.checkbox-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
</style>
