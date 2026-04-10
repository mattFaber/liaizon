<script lang="ts">
	import { browser } from '$app/environment';
	import { tick } from 'svelte';

	let { data, form } = $props();
	let companyIdInput = $state('demo-company');
	let idToken = $state('');
	let clientError = $state('');
	let error = $derived(clientError || form?.error || '');
	let effectiveCompanyId = $derived(
		data.engineerAuthConfigured ? data.configuredCompanyId || 'demo-company' : companyIdInput
	);
	let isGoogleSigningIn = $state(false);
	let isManualSigningIn = $state(false);

	async function signInWithGoogle() {
		if (!browser) {
			return;
		}

		clientError = '';
		isGoogleSigningIn = true;

		try {
			const { signInWithGooglePopup } = await import('$lib/client/firebase');
			const result = await signInWithGooglePopup();
			idToken = await result.user.getIdToken();
			await tick();

			const form = document.getElementById('auth-form') as HTMLFormElement | null;
			form?.requestSubmit();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Google sign-in failed.';
			clientError = message;
		} finally {
			isGoogleSigningIn = false;
		}
	}

	function handleSubmit(event: SubmitEvent) {
		clientError = '';
		isManualSigningIn = false;

		if (data.engineerAuthConfigured) {
			isManualSigningIn = true;
			return;
		}

		const target = event.currentTarget as HTMLFormElement | null;
		const tokenInput = target?.elements.namedItem('idToken') as HTMLInputElement | null;

		if (!tokenInput?.value.trim()) {
			event.preventDefault();
			clientError = 'A Firebase ID token is required.';
			return;
		}

		if (!effectiveCompanyId.trim()) {
			event.preventDefault();
			clientError = 'A company ID is required.';
			return;
		}

		isManualSigningIn = true;
	}
</script>

<main class="auth-page">
	<h1>Auth Setup</h1>
	<p>
		Authentication sets secure cookies for Firebase session and tenant scope. When auth bootstrap is
		enabled, the Firebase ID token is supplied by server configuration instead of user input.
	</p>

	<form id="auth-form" method="POST" onsubmit={handleSubmit}>
		<label for="company-id">Company ID</label>
		{#if data.engineerAuthConfigured}
			<input id="company-id" name="companyId" value={effectiveCompanyId} required readonly />
		{:else}
			<input id="company-id" name="companyId" bind:value={companyIdInput} required />
		{/if}

		<input name="idToken" type="hidden" bind:value={idToken} />

		{#if data.engineerAuthConfigured}
			<p class="hint">
				Engineer-managed bootstrap is enabled. End users do not need to provide a Firebase ID token
				on this screen.
			</p>
			<button type="submit" disabled={isManualSigningIn}>
				{isManualSigningIn ? 'Signing In...' : 'Continue'}
			</button>
		{:else}
			<button type="button" onclick={signInWithGoogle} disabled={isGoogleSigningIn}>
				{isGoogleSigningIn ? 'Signing In...' : 'Sign In With Google'}
			</button>

			<p class="hint">Firebase ID tokens are acquired via Google sign-in in this mode.</p>
		{/if}

		{#if error}
			<p class="error" role="alert" aria-live="assertive">{error}</p>
		{/if}

		{#if data.bootstrapError}
			<p class="error" role="alert" aria-live="assertive">{data.bootstrapError}</p>
		{/if}
	</form>
</main>

<style>
	.auth-page {
		max-width: 48rem;
		margin: 2.5rem auto;
		padding: 0 1rem;
	}

	h1 {
		font-size: 2rem;
		margin-bottom: 0.75rem;
	}

	p {
		line-height: 1.6;
	}

	form {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	input {
		padding: 0.6rem;
		border: 1px solid #d4d4d8;
		border-radius: 0.5rem;
	}

	button {
		width: fit-content;
		padding: 0.6rem 0.9rem;
		border: 1px solid currentColor;
		border-radius: 0.5rem;
		background: transparent;
	}

	.error {
		color: #b91c1c;
	}

	.hint {
		margin: 0;
		font-size: 0.9rem;
		color: #52525b;
	}
</style>
