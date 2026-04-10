<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<main class="page">
	<h1>Liaizon Recruiter Workspace</h1>
	<p>
		Foundations are in place for auth, Firestore-backed data, and stage-based message generation.
	</p>

	<div class="actions">
		<a href={resolve('/auth')}>Go To Auth</a>
		<a href={resolve('/recruiter')}>Open Recruiter Workspace</a>
	</div>
</main>

<style>
	.page {
		max-width: 48rem;
		margin: 4rem auto;
		padding: 0 1rem;
	}

	h1 {
		font-size: 2rem;
		margin-bottom: 0.75rem;
	}

	p {
		margin-bottom: 1.5rem;
		line-height: 1.6;
	}

	.actions {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	a {
		padding: 0.6rem 0.9rem;
		border: 1px solid currentColor;
		border-radius: 0.5rem;
		text-decoration: none;
	}

	a:hover {
		text-decoration: underline;
	}
</style>
