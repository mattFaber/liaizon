<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	const SESSION_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
	let sessionRefreshState = $state<'idle' | 'success' | 'error'>('idle');
	let sessionRefreshError = $state('');
	let lastSessionRefreshAt = $state<Date | null>(null);
	let lastSessionRefreshLabel = $derived(
		lastSessionRefreshAt
			? lastSessionRefreshAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			: 'not yet'
	);

	async function refreshSessionCookie(forceRefresh: boolean = false): Promise<void> {
		if (!browser) {
			return;
		}

		const { getCurrentUserIdToken } = await import('$lib/client/firebase');
		const idToken = await getCurrentUserIdToken(forceRefresh);
		if (!idToken) {
			return;
		}

		const payload = new FormData();
		payload.append('idToken', idToken);

		const response = await fetch('/auth/refresh', {
			method: 'POST',
			body: payload
		});

		if (!response.ok) {
			throw new Error('Session refresh request failed.');
		}

		sessionRefreshState = 'success';
		sessionRefreshError = '';
		lastSessionRefreshAt = new Date();
	}

	onMount(() => {
		void refreshSessionCookie(false).catch(() => {
			sessionRefreshState = 'error';
			sessionRefreshError = 'Session refresh failed. You may need to sign in again soon.';
		});

		const intervalId = window.setInterval(() => {
			void refreshSessionCookie(true).catch(() => {
				sessionRefreshState = 'error';
				sessionRefreshError = 'Session refresh failed. You may need to sign in again soon.';
			});
		}, SESSION_REFRESH_INTERVAL_MS);

		return () => {
			window.clearInterval(intervalId);
		};
	});
</script>

<main class="shell">
	<header>
		<h1>Recruiter Workspace</h1>
		<div class="meta">
			<span>{data.user.email ?? data.user.uid}</span>
			<p
				class="session-refresh"
				class:session-refresh-success={sessionRefreshState === 'success'}
				class:session-refresh-error={sessionRefreshState === 'error'}
				aria-live="polite"
			>
				{#if sessionRefreshState === 'error'}
					{sessionRefreshError}
				{:else if sessionRefreshState === 'success'}
					Session refreshed at {lastSessionRefreshLabel}
				{:else}
					Session refresh pending
				{/if}
			</p>
			<form method="POST" action="/auth/signout">
				<button type="submit">Sign Out</button>
			</form>
		</div>
	</header>

	<nav>
		<a href={resolve('/recruiter')}>Overview</a>
		<a href={resolve('/recruiter/pipeline')}>Pipeline</a>
		<a href={resolve('/recruiter/projects')}>Projects</a>
		{#if data.user.role === 'admin'}
			<a href={resolve('/recruiter/admin')}>Admin</a>
		{/if}
		<a href={resolve('/recruiter/messages')}>Messages</a>
	</nav>

	<section>
		{@render children()}
	</section>
</main>

<style>
	.shell {
		max-width: 68rem;
		margin: 2rem auto;
		padding: 0 1rem;
		display: grid;
		gap: 1rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.session-refresh {
		margin: 0;
		font-size: 0.82rem;
		color: #52525b;
	}

	.session-refresh-success {
		color: #166534;
	}

	.session-refresh-error {
		color: #b91c1c;
	}

	button,
	a {
		padding: 0.4rem 0.7rem;
		border: 1px solid currentColor;
		border-radius: 0.5rem;
		background: transparent;
		text-decoration: none;
	}

	nav {
		display: flex;
		gap: 0.5rem;
	}

	section {
		padding: 1rem;
		border: 1px solid #ddd;
		border-radius: 0.75rem;
	}
</style>
