<script lang="ts">
	import { browser } from '$app/environment';
	import Toast from '$lib/components/Toast.svelte';

	let { data, form } = $props();
	let toastMessage = $derived(form?.error ?? form?.successMessage ?? '');
	let toastTone = $derived((form?.error ? 'error' : 'success') as 'error' | 'success');
	let optimisticHiddenUserById: Record<string, boolean> = $state({});
	let optimisticHiddenSettingsById: Record<string, boolean> = $state({});
	let optimisticHiddenSampleById: Record<string, boolean> = $state({});
	let optimisticHiddenTemplateById: Record<string, boolean> = $state({});
	let optimisticHiddenInstructionById: Record<string, boolean> = $state({});
	let bootstrapCompanyId = $state('');
	let bootstrapExpiresDays = $state('7');
	let bootstrapIdToken = $state('');
	let bootstrapClientError = $state('');
	let isPreparingBootstrapToken = $state(false);
	let isMintingBootstrapCookie = $state(false);
	let didCopyBootstrapSnippet = $state(false);

	const stages = [
		'initial_outreach',
		'follow_up',
		'interview_invite',
		'interview_follow_up',
		'offer_stage',
		'rejection'
	] as const;

	const channels = ['email', 'linkedin', 'sms'] as const;

	function hideUser(userId: string) {
		optimisticHiddenUserById = {
			...optimisticHiddenUserById,
			[userId]: true
		};
	}

	function hideSettings(settingsId: string) {
		optimisticHiddenSettingsById = {
			...optimisticHiddenSettingsById,
			[settingsId]: true
		};
	}

	function hideSample(sampleId: string) {
		optimisticHiddenSampleById = {
			...optimisticHiddenSampleById,
			[sampleId]: true
		};
	}

	function hideTemplate(templateId: string) {
		optimisticHiddenTemplateById = {
			...optimisticHiddenTemplateById,
			[templateId]: true
		};
	}

	function hideInstruction(versionId: string) {
		optimisticHiddenInstructionById = {
			...optimisticHiddenInstructionById,
			[versionId]: true
		};
	}

	async function prepareBootstrapIdToken() {
		if (!browser) {
			return;
		}

		bootstrapClientError = '';
		isPreparingBootstrapToken = true;

		try {
			const { signInWithGooglePopup } = await import('$lib/client/firebase');
			const result = await signInWithGooglePopup();
			bootstrapIdToken = await result.user.getIdToken();
		} catch (error) {
			bootstrapClientError =
				error instanceof Error ? error.message : 'Could not acquire Firebase ID token.';
		} finally {
			isPreparingBootstrapToken = false;
		}
	}

	function submitBootstrapMint(event: SubmitEvent) {
		bootstrapClientError = '';
		didCopyBootstrapSnippet = false;

		if (!bootstrapIdToken.trim()) {
			event.preventDefault();
			bootstrapClientError =
				'Generate a Firebase ID token first using the Google button in this panel.';
			return;
		}

		if (!bootstrapCompanyId.trim()) {
			event.preventDefault();
			bootstrapClientError = 'Company ID is required.';
			return;
		}

		isMintingBootstrapCookie = true;
	}

	function copyBootstrapSnippet() {
		if (!form?.bootstrapSnippet) {
			return;
		}

		navigator.clipboard.writeText(form.bootstrapSnippet);
		didCopyBootstrapSnippet = true;
		setTimeout(() => {
			didCopyBootstrapSnippet = false;
		}, 2000);
	}

	$effect(() => {
		form;
		if (!bootstrapCompanyId && data.company?.companyId) {
			bootstrapCompanyId = data.company.companyId;
		}
		optimisticHiddenUserById = {};
		optimisticHiddenSettingsById = {};
		optimisticHiddenSampleById = {};
		optimisticHiddenTemplateById = {};
		optimisticHiddenInstructionById = {};
		isMintingBootstrapCookie = false;
	});
</script>

<h2>Admin Console</h2>
<Toast message={toastMessage} tone={toastTone} />

{#if !data.adminAccess}
	<p class="status status-error">Admin role required for write operations.</p>
{/if}

{#if data.adminAccess}
	<section class="panel panel-bootstrap">
		<h3>Bootstrap Auth</h3>
		<p class="hint">
			Generate a fresh <code>AUTH_BOOTSTRAP_SESSION_COOKIE</code> directly in the admin console. The
			mint action only accepts an ID token from the currently signed-in admin user.
		</p>
		<form method="POST" action="?/mintBootstrapSessionCookie" onsubmit={submitBootstrapMint}>
			<label>
				Company ID
				<input name="companyId" bind:value={bootstrapCompanyId} required />
			</label>
			<label>
				Expires in days
				<input name="expiresDays" type="number" bind:value={bootstrapExpiresDays} min="1" max="14" required />
			</label>
			<input name="idToken" type="hidden" bind:value={bootstrapIdToken} />

			<div class="actions-inline">
				<button type="button" onclick={prepareBootstrapIdToken} disabled={isPreparingBootstrapToken}>
					{isPreparingBootstrapToken ? 'Preparing Token...' : 'Acquire Firebase ID Token'}
				</button>
				<button type="submit" disabled={isMintingBootstrapCookie}>
					{isMintingBootstrapCookie ? 'Generating...' : 'Mint Bootstrap Session Cookie'}
				</button>
			</div>
		</form>

		{#if bootstrapClientError}
			<p class="status status-error">{bootstrapClientError}</p>
		{/if}

		{#if form?.bootstrapSnippet}
			<label>
				.env.local snippet
				<textarea rows="6" readonly>{form.bootstrapSnippet}</textarea>
			</label>
			<button type="button" onclick={copyBootstrapSnippet}>
				{didCopyBootstrapSnippet ? 'Copied' : 'Copy snippet'}
			</button>
		{/if}
	</section>

	<section class="panel">
		<h3>Company</h3>
		<form method="POST" action="?/upsertCompany">
			<label>
				Name
				<input name="name" value={data.company?.name ?? ''} required />
			</label>
			<label>
				Plan
				<select name="plan">
					<option value="free" selected={data.company?.plan === 'free'}>free</option>
					<option value="pro" selected={data.company?.plan === 'pro'}>pro</option>
					<option value="enterprise" selected={data.company?.plan === 'enterprise'}>enterprise</option>
				</select>
			</label>
			<label>
				Default style strength
				<select name="defaultStyleStrength">
					<option value="low" selected={data.company?.defaultStyleStrength === 'low'}>low</option>
					<option value="medium" selected={data.company?.defaultStyleStrength === 'medium'}>medium</option>
					<option value="high" selected={data.company?.defaultStyleStrength === 'high'}>high</option>
				</select>
			</label>
			<label>
				Monthly generation quota
				<input name="monthlyGenerationQuota" type="number" min="0" value={data.company?.monthlyGenerationQuota ?? 0} />
			</label>
			<label>
				Settings JSON
				<textarea name="settingsJson" rows="3">{JSON.stringify(data.company?.settings ?? {}, null, 2)}</textarea>
			</label>
			<label>
				Active
				<select name="isActive">
					<option value="true" selected={data.company?.isActive !== false}>true</option>
					<option value="false" selected={data.company?.isActive === false}>false</option>
				</select>
			</label>
			<button type="submit">Save Company</button>
		</form>
		<form method="POST" action="?/deactivateCompany">
			<button type="submit">Deactivate Company</button>
		</form>
	</section>

	<section class="panel">
		<h3>Users</h3>
		<form method="POST" action="?/createUser">
			<label>
				User ID (optional)
				<input name="userId" placeholder="user id (optional)" />
			</label>
			<label>
				Email
				<input name="email" type="email" placeholder="email" required />
			</label>
			<label>
				Display name
				<input name="displayName" placeholder="display name" required />
			</label>
			<label>
				Role
				<select name="role">
					<option value="admin">admin</option>
					<option value="recruiter" selected>recruiter</option>
					<option value="hiring_manager">hiring_manager</option>
				</select>
			</label>
			<label>
				Preferences JSON
				<textarea name="preferencesJson" rows="2" placeholder={`{"timezone":"UTC"}`}></textarea>
			</label>
			<p class="hint">Tip: leave preferences empty to use defaults.</p>
			<button type="submit">Create User</button>
		</form>
		<ul>
			{#each data.users as user (user.userId)}
				{#if !optimisticHiddenUserById[user.userId]}
					<li>
						<form method="POST" action="?/updateUser">
							<input type="hidden" name="userId" value={user.userId} />
							<input name="displayName" value={user.displayName} required />
							<select name="role">
								<option value="admin" selected={user.role === 'admin'}>admin</option>
								<option value="recruiter" selected={user.role === 'recruiter'}>recruiter</option>
								<option value="hiring_manager" selected={user.role === 'hiring_manager'}>
									hiring_manager
								</option>
							</select>
							<select name="isActive">
								<option value="true" selected={user.isActive}>true</option>
								<option value="false" selected={!user.isActive}>false</option>
							</select>
							<textarea name="preferencesJson" rows="2">{JSON.stringify(user.preferences ?? {}, null, 2)}</textarea>
							<button type="submit">Update</button>
						</form>
						<form method="POST" action="?/deleteUser" onsubmit={() => hideUser(user.userId)}>
							<input type="hidden" name="userId" value={user.userId} />
							<button type="submit">Delete</button>
						</form>
					</li>
				{/if}
			{/each}
		</ul>
	</section>

	<section class="panel">
		<h3>Application Settings</h3>
		<form method="POST" action="?/createSettings">
			<label>
				Settings ID (optional)
				<input name="settingsId" placeholder="settings id (optional)" />
			</label>
			<select name="defaultChannel">
				{#each channels as channel (channel)}
					<option value={channel}>{channel}</option>
				{/each}
			</select>
			<select name="defaultStage">
				{#each stages as stage (stage)}
					<option value={stage}>{stage}</option>
				{/each}
			</select>
			<select name="defaultStyleStrength">
				<option value="low">low</option>
				<option value="medium" selected>medium</option>
				<option value="high">high</option>
			</select>
			<label>
				Feature flags JSON
				<textarea name="featureFlagsJson" rows="2" placeholder={`{"betaWorkflow":true}`}></textarea>
			</label>
			<label>
				Notification preferences JSON
				<textarea name="notificationPreferencesJson" rows="2" placeholder={`{"digest":"daily"}`}></textarea>
			</label>
			<p class="hint">JSON fields are optional. Empty values default to {'{}'}.</p>
			<button type="submit">Create Settings</button>
		</form>
		<ul>
			{#each data.settings as settings (settings.settingsId)}
				{#if !optimisticHiddenSettingsById[settings.settingsId]}
					<li>
						<form method="POST" action="?/updateSettings">
							<input type="hidden" name="settingsId" value={settings.settingsId} />
							<select name="defaultChannel">
								{#each channels as channel (channel)}
									<option value={channel} selected={settings.defaultChannel === channel}>{channel}</option>
								{/each}
							</select>
							<select name="defaultStage">
								{#each stages as stage (stage)}
									<option value={stage} selected={settings.defaultStage === stage}>{stage}</option>
								{/each}
							</select>
							<select name="defaultStyleStrength">
								<option value="low" selected={settings.defaultStyleStrength === 'low'}>low</option>
								<option value="medium" selected={settings.defaultStyleStrength === 'medium'}>medium</option>
								<option value="high" selected={settings.defaultStyleStrength === 'high'}>high</option>
							</select>
							<textarea name="featureFlagsJson" rows="2">{JSON.stringify(settings.featureFlags ?? {}, null, 2)}</textarea>
							<textarea name="notificationPreferencesJson" rows="2">{JSON.stringify(settings.notificationPreferences ?? {}, null, 2)}</textarea>
							<button type="submit">Update</button>
						</form>
						<form method="POST" action="?/deleteSettings" onsubmit={() => hideSettings(settings.settingsId)}>
							<input type="hidden" name="settingsId" value={settings.settingsId} />
							<button type="submit">Delete</button>
						</form>
					</li>
				{/if}
			{/each}
		</ul>
	</section>

	<section class="panel">
		<h3>Writing Samples</h3>
		<form method="POST" action="?/createWritingSample">
			<input name="sampleId" placeholder="sample id (optional)" />
			<input name="recruiterId" placeholder="recruiter id (optional)" />
			<select name="scope">
				<option value="company" selected>company</option>
				<option value="recruiter">recruiter</option>
			</select>
			<select name="channel">
				{#each channels as channel (channel)}
					<option value={channel}>{channel}</option>
				{/each}
			</select>
			<select name="stage">
				<option value="">all stages</option>
				{#each stages as stage (stage)}
					<option value={stage}>{stage}</option>
				{/each}
			</select>
			<textarea name="text" rows="3" placeholder="minimum 50 characters" required></textarea>
			<select name="isActive">
				<option value="true" selected>true</option>
				<option value="false">false</option>
			</select>
			<input name="sourceMessageId" placeholder="source message id (optional)" />
			<button type="submit">Create Writing Sample</button>
		</form>
		<ul>
			{#each data.writingSamples as sample (sample.sampleId)}
				{#if !optimisticHiddenSampleById[sample.sampleId]}
					<li>
						<form method="POST" action="?/updateWritingSample">
							<input type="hidden" name="sampleId" value={sample.sampleId} />
							<input name="recruiterId" value={sample.recruiterId ?? ''} />
							<select name="scope">
								<option value="company" selected={sample.scope === 'company'}>company</option>
								<option value="recruiter" selected={sample.scope === 'recruiter'}>recruiter</option>
							</select>
							<select name="channel">
								{#each channels as channel (channel)}
									<option value={channel} selected={sample.channel === channel}>{channel}</option>
								{/each}
							</select>
							<select name="stage">
								<option value="" selected={sample.stage === null}>all stages</option>
								{#each stages as stage (stage)}
									<option value={stage} selected={sample.stage === stage}>{stage}</option>
								{/each}
							</select>
							<textarea name="text" rows="3">{sample.text}</textarea>
							<select name="isActive">
								<option value="true" selected={sample.isActive}>true</option>
								<option value="false" selected={!sample.isActive}>false</option>
							</select>
							<button type="submit">Update</button>
						</form>
						<form method="POST" action="?/deleteWritingSample" onsubmit={() => hideSample(sample.sampleId)}>
							<input type="hidden" name="sampleId" value={sample.sampleId} />
							<button type="submit">Delete</button>
						</form>
					</li>
				{/if}
			{/each}
		</ul>
	</section>

	<section class="panel">
		<h3>Prompt Templates</h3>
		<form method="POST" action="?/createPromptTemplate">
			<input name="templateId" placeholder="template id (optional)" />
			<select name="stage">
				{#each stages as stage (stage)}
					<option value={stage}>{stage}</option>
				{/each}
			</select>
			<select name="channel">
				{#each channels as channel (channel)}
					<option value={channel}>{channel}</option>
				{/each}
			</select>
			<input name="promptVersion" type="number" min="1" value="1" />
			<input name="editableFields" placeholder="field_1, field_2" />
			<input name="maxLengthWords" type="number" min="1" value="120" />
			<select name="deprecated">
				<option value="false" selected>false</option>
				<option value="true">true</option>
			</select>
			<textarea name="basePrompt" rows="4" required></textarea>
			<button type="submit">Create Template</button>
		</form>
		<ul>
			{#each data.promptTemplates as template (template.templateId)}
				{#if !optimisticHiddenTemplateById[template.templateId]}
					<li>
						<form method="POST" action="?/updatePromptTemplate">
							<input type="hidden" name="templateId" value={template.templateId} />
							<select name="stage">
								{#each stages as stage (stage)}
									<option value={stage} selected={template.stage === stage}>{stage}</option>
								{/each}
							</select>
							<select name="channel">
								{#each channels as channel (channel)}
									<option value={channel} selected={template.channel === channel}>{channel}</option>
								{/each}
							</select>
							<input name="promptVersion" type="number" min="1" value={template.promptVersion} />
							<input name="editableFields" value={template.editableFields.join(', ')} />
							<input name="maxLengthWords" type="number" min="1" value={template.maxLengthWords} />
							<select name="deprecated">
								<option value="false" selected={!template.deprecated}>false</option>
								<option value="true" selected={template.deprecated}>true</option>
							</select>
							<textarea name="basePrompt" rows="4">{template.basePrompt}</textarea>
							<button type="submit">Update</button>
						</form>
						<form method="POST" action="?/deletePromptTemplate" onsubmit={() => hideTemplate(template.templateId)}>
							<input type="hidden" name="templateId" value={template.templateId} />
							<button type="submit">Delete</button>
						</form>
					</li>
				{/if}
			{/each}
		</ul>
	</section>

	<section class="panel">
		<h3>System Instruction Versions</h3>
		<form method="POST" action="?/createSystemInstructionVersion">
			<input name="versionId" placeholder="version id (optional)" />
			<input name="versionLabel" placeholder="version label" required />
			<input name="instructionUri" placeholder="gs://... or repo path" required />
			<select name="lifecycle">
				<option value="active" selected>active</option>
				<option value="deprecated">deprecated</option>
			</select>
			<textarea name="notes" rows="2"></textarea>
			<button type="submit">Create System Instruction Version</button>
		</form>
		<ul>
			{#each data.systemInstructionVersions as version (version.versionId)}
				{#if !optimisticHiddenInstructionById[version.versionId]}
					<li>
						<form method="POST" action="?/updateSystemInstructionVersion">
							<input type="hidden" name="versionId" value={version.versionId} />
							<input name="versionLabel" value={version.versionLabel} required />
							<input name="instructionUri" value={version.instructionUri} required />
							<select name="lifecycle">
								<option value="active" selected={version.lifecycle === 'active'}>active</option>
								<option value="deprecated" selected={version.lifecycle === 'deprecated'}>
									deprecated
								</option>
							</select>
							<textarea name="notes" rows="2">{version.notes ?? ''}</textarea>
							<button type="submit">Update</button>
						</form>
						<form method="POST" action="?/deleteSystemInstructionVersion" onsubmit={() => hideInstruction(version.versionId)}>
							<input type="hidden" name="versionId" value={version.versionId} />
							<button type="submit">Delete</button>
						</form>
					</li>
				{/if}
			{/each}
		</ul>
	</section>
{:else}
	<section class="panel">
		<h3>Company</h3>
		<p><strong>Name:</strong> {data.company?.name ?? 'Unavailable'}</p>
		<p><strong>Plan:</strong> {data.company?.plan ?? 'Unavailable'}</p>
		<p><strong>Default style strength:</strong> {data.company?.defaultStyleStrength ?? 'Unavailable'}</p>
		<p><strong>Monthly generation quota:</strong> {data.company?.monthlyGenerationQuota ?? 'Unavailable'}</p>
	</section>

	<section class="panel">
		<h3>Users (Read-only)</h3>
		<ul>
			{#each data.users as user (user.userId)}
				<li>
					<strong>{user.displayName}</strong> ({user.email}) - {user.role} - {user.isActive ? 'active' : 'inactive'}
				</li>
			{/each}
		</ul>
	</section>

	<section class="panel">
		<h3>Application Settings (Read-only)</h3>
		<ul>
			{#each data.settings as settings (settings.settingsId)}
				<li>
					<strong>{settings.settingsId}</strong> - channel: {settings.defaultChannel}, stage: {settings.defaultStage}, style: {settings.defaultStyleStrength}
				</li>
			{/each}
		</ul>
	</section>

	<section class="panel">
		<h3>Writing Samples (Read-only)</h3>
		<ul>
			{#each data.writingSamples as sample (sample.sampleId)}
				<li>
					<strong>{sample.sampleId}</strong> - {sample.scope}/{sample.channel} - {sample.isActive ? 'active' : 'inactive'}
				</li>
			{/each}
		</ul>
	</section>

	<section class="panel">
		<h3>Prompt Templates (Read-only)</h3>
		<ul>
			{#each data.promptTemplates as template (template.templateId)}
				<li>
					<strong>{template.templateId}</strong> - {template.stage}/{template.channel} v{template.promptVersion} {template.deprecated ? '(deprecated)' : ''}
				</li>
			{/each}
		</ul>
	</section>

	<section class="panel">
		<h3>System Instruction Versions (Read-only)</h3>
		<ul>
			{#each data.systemInstructionVersions as version (version.versionId)}
				<li>
					<strong>{version.versionLabel}</strong> - {version.lifecycle} - {version.instructionUri}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.panel {
		border: 1px solid #e4e4e7;
		border-radius: 0.75rem;
		padding: 1rem;
		margin-bottom: 1rem;
		display: grid;
		gap: 0.75rem;
	}

	form {
		display: grid;
		gap: 0.5rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
	}

	input,
	select,
	textarea,
	button {
		padding: 0.45rem 0.55rem;
		border: 1px solid #d4d4d8;
		border-radius: 0.5rem;
	}

	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}

	li {
		border: 1px solid #f1f5f9;
		border-radius: 0.5rem;
		padding: 0.6rem;
		display: grid;
		gap: 0.5rem;
	}

	.status {
		padding: 0.65rem 0.8rem;
		border-radius: 0.5rem;
		border: 1px solid;
	}

	.status-error {
		background: #fef2f2;
		border-color: #fecaca;
		color: #991b1b;
	}

	.panel-bootstrap code {
		background: #f4f4f5;
		padding: 0.1rem 0.25rem;
		border-radius: 0.25rem;
	}

	.actions-inline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.hint {
		margin: 0;
		font-size: 0.86rem;
		color: #52525b;
	}

</style>
