<script lang="ts">
	let {
		message = '',
		tone = 'success',
		durationMs = 3000
	}: {
		message?: string;
		tone?: 'success' | 'error';
		durationMs?: number;
	} = $props();
</script>

{#if message}
	<div class={`toast toast-${tone}`} role="status" aria-live="polite" style={`--toast-duration: ${durationMs}ms;`}>
		{message}
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		right: 1rem;
		top: 1rem;
		max-width: 28rem;
		padding: 0.7rem 0.9rem;
		border-radius: 0.55rem;
		border: 1px solid;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
		z-index: 60;
		animation:
			toast-enter 140ms ease-out,
			toast-exit 220ms ease-in calc(var(--toast-duration) - 220ms) forwards;
	}

	@keyframes toast-enter {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes toast-exit {
		to {
			opacity: 0;
			transform: translateY(-4px);
		}
	}

	.toast-success {
		background: #ecfdf5;
		border-color: #a7f3d0;
		color: #065f46;
	}

	.toast-error {
		background: #fef2f2;
		border-color: #fecaca;
		color: #991b1b;
	}
</style>
