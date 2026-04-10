<script lang="ts">
	let { data } = $props();
</script>

<h2>Workspace Overview</h2>
<p>Authenticated as: {data.user.email ?? data.user.uid}</p>
<p>
	Phase 1 scaffolding is complete. Next implementation slices: Firestore CRUD routes, candidate and
	job forms, and stage-based generation actions.
</p>
