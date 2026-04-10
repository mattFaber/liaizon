<script lang="ts">
	let { data, form } = $props();
	let idToken = $state('');
	let expiresDays = $state('7');
	let isSubmitting = $state(false);
	let copiedToClipboard = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		const target = event.currentTarget as HTMLFormElement;
		if (!target.checkValidity()) {
			return;
		}

		isSubmitting = true;
		copiedToClipboard = false;
	}

	function copyToClipboard() {
		if (!form?.sessionCookie) {
			return;
		}

		navigator.clipboard.writeText(`AUTH_BOOTSTRAP_SESSION_COOKIE=${form.sessionCookie}`);
		copiedToClipboard = true;
		setTimeout(() => {
			copiedToClipboard = false;
		}, 2000);
	}
</script>

<main class="debug-page">
	<h1>🔧 Debug: Mint Session Cookie</h1>
	<p class="hint">Development-only utility to generate Firebase session cookies for local testing.</p>

	<section class="panel">
		<h2>Exchange ID Token for Session Cookie</h2>
		<form method="POST" action="?/mint" onsubmit={handleSubmit}>
			<label for="id-token">Firebase ID Token</label>
			<textarea
				id="id-token"
				name="idToken"
				bind:value={idToken}
				placeholder="Paste your Firebase ID token here"
				required
				rows="4"
			></textarea>

			<label for="expires-days">Expires in (days)</label>
			<input
				id="expires-days"
				name="expiresDays"
				type="number"
				bind:value={expiresDays}
				min="1"
				max="14"
				required
			/>

			<button type="submit" disabled={isSubmitting || !idToken.trim()}>
				{isSubmitting ? 'Generating...' : 'Mint Session Cookie'}
			</button>
		</form>

		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}

		{#if form?.success}
			<div class="success">
				<p class="message">{form.message}</p>
				<div class="cookie-output">
					<p class="label">Session Cookie (for .env.local):</p>
					<textarea readonly rows="3">{`AUTH_BOOTSTRAP_SESSION_COOKIE=${form.sessionCookie}`}</textarea>
					<button type="button" onclick={copyToClipboard} class="copy-btn">
						{copiedToClipboard ? '✓ Copied' : 'Copy to Clipboard'}
					</button>
				</div>
				<p class="instruction">Set <code>AUTH_BOOTSTRAP_ENABLED=true</code> to activate bootstrap auth.</p>
			</div>
		{/if}
	</section>
</main>

<style>
	.debug-page {
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

	.panel {
		border: 1px solid #e4e4e7;
		border-radius: 0.75rem;
		padding: 1rem;
		margin-bottom: 1rem;
		display: grid;
		gap: 0.75rem;
	}

	h2 {
		font-size: 1.25rem;
		margin-bottom: 0.5rem;
	}

	form {
		display: grid;
		gap: 0.75rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
		font-weight: 500;
	}

	input,
	textarea {
		padding: 0.6rem;
		border: 1px solid #d4d4d8;
		border-radius: 0.5rem;
		font-family: inherit;
	}

	textarea {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		resize: vertical;
	}

	button {
		width: fit-content;
		padding: 0.6rem 0.9rem;
		border: 1px solid currentColor;
		border-radius: 0.5rem;
		background: transparent;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error {
		color: #b91c1c;
		padding: 0.75rem;
		border: 1px solid #fecaca;
		border-radius: 0.5rem;
		background: #fef2f2;
	}

	.success {
		display: grid;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid #86efac;
		border-radius: 0.5rem;
		background: #f0fdf4;
	}

	.success .message {
		color: #166534;
		font-weight: 500;
	}

	.success .label {
		font-size: 0.9rem;
		color: #4b5563;
		margin-bottom: 0.25rem;
	}

	.cookie-output {
		display: grid;
		gap: 0.5rem;
	}

	.cookie-output textarea {
		background: white;
		border: 1px solid #d4d4d8;
		font-size: 0.85rem;
		max-height: 8rem;
	}

	.copy-btn {
		width: fit-content;
		padding: 0.5rem 0.75rem;
		font-size: 0.9rem;
		border: 1px solid #d4d4d8;
		background: white;
	}

	.copy-btn:hover:not(:disabled) {
		background: #f4f4f5;
	}

	.instruction {
		font-size: 0.9rem;
		color: #52525b;
		margin: 0;
	}

	code {
		background: #f4f4f5;
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
	}

	.hint {
		color: #52525b;
		font-size: 0.9rem;
		margin: 0;
	}
</style>
