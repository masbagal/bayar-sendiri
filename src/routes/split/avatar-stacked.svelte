<script lang="ts">
	import { createAvatar } from '@dicebear/core';
	import { bottts } from '@dicebear/collection';

	interface Props {
		fullName: string;
	}

	let { fullName = 'Unknown' }: Props = $props();

	const avatar = $derived(
		createAvatar(bottts, {
			seed: fullName,
			size: 30,
			clip: false,
			translateY: 6
		}).toDataUri()
	);
</script>

<img class="avatar-stacked" src={avatar} alt={fullName} />

<style>
	img.avatar-stacked {
		margin-right: 2px;
	}
</style>
