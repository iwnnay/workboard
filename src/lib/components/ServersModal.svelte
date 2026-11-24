<script lang="ts">
	import { page } from '$app/state';
	import Modal from '$lib/components/Modal.svelte';
	import ServersLauncher from '$lib/components/ServersLauncher.svelte';
	import type { Project } from '$lib/types';

	let { onClose }: { onClose: () => void } = $props();

	const projects = $derived<Project[]>(page.data.projects ?? []);
</script>

<Modal title="Servers" maxWidth="900px" {onClose}>
	<ServersLauncher {projects} />
</Modal>
