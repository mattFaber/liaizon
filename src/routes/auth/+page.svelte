<script lang="ts">
	import { browser } from '$app/environment';
	import { tick } from 'svelte';

	let { form } = $props();
	let idToken = $state('');
	let clientError = $state('');
	let error = $derived(clientError || form?.error || '');
	let isGoogleSigningIn = $state(false);

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
		if (!idToken.trim()) {
			event.preventDefault();
			clientError = 'Failed to get Firebase ID token.';
		}
	}
</script>

<main class="auth-page">
	<h1>Auth Setup</h1>
	<p>Sign in with your Google account to get started.</p>

	<form id="auth-form" method="POST" onsubmit={handleSubmit}>
		<input name="idToken" type="hidden" bind:value={idToken} />

		<button type="button" onclick={signInWithGoogle} disabled={isGoogleSigningIn}>
			{isGoogleSigningIn ? 'Signing In...' : 'Continue With Google'}
		</button>

		{#if error}
			<p class="error" role="alert" aria-live="assertive">{error}</p>
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
</style>
