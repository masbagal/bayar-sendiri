<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
	<div class="icon">┐(︶▽︶)┌</div>
	<h1>Bayar Sendiri Sendiri~</h1>

	<button onclick={() => goto(resolve('/camera'))}>Start →</button>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		flex: 1;
	}

	h1 {
		text-transform: uppercase;
		font-size: 3rem;
		text-wrap: balance;
		text-align: left;
	}

	.icon {
		font-size: 2rem;
	}

	button {
		width: 100%;
	}
</style>
