<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { cyclePalette, getPalette, syncPalette } from '$lib/palette.svelte.js';

	let { children } = $props();

	const STEPS = [
		{ path: '/loading', label: 'Scan' },
		{ path: '/players', label: 'Players' },
		{ path: '/split', label: 'Split' },
		{ path: '/split/summary', label: 'Pay' }
	] as const;

	onMount(syncPalette);

	const current = $derived(STEPS.findIndex((step) => step.path === page.url.pathname));
</script>

<div class="screen">
	{#if current !== -1}
		<nav class="hud" aria-label="Progress">
			<span class="brand">Bayar·Sendiri</span>
			<ol>
				{#each STEPS as step, i (step.path)}
					<li
						class:done={i < current}
						class:here={i === current}
						aria-current={i === current ? 'step' : undefined}
					>
						{step.label}
					</li>
				{/each}
			</ol>
			<button
				class="palette"
				onclick={cyclePalette}
				aria-label="Palette: {getPalette().name}. Switch palette"
				title="Switch palette"
			>
				<span aria-hidden="true">◐</span>
			</button>
		</nav>
	{/if}
	<main>
		{@render children()}
	</main>
</div>

<style>
	.screen {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: var(--column);
		min-height: 100dvh;
		margin: 0 auto;
		background: var(--paper);
	}

	@media (min-width: 768px) {
		:global(body) {
			background-color: var(--paper-raised);
			background-image: radial-gradient(var(--ink-decor) 1px, transparent 1px);
			background-size: 8px 8px;
		}

		.screen {
			min-height: calc(100dvh - var(--s6) * 2);
			margin: var(--s6) auto;
			box-shadow:
				0 calc(-1 * var(--px)) 0 0 var(--ink),
				0 var(--px) 0 0 var(--ink),
				calc(-1 * var(--px)) 0 0 0 var(--ink),
				var(--px) 0 0 0 var(--ink),
				calc(var(--px) * 3) calc(var(--px) * 2) 0 0 var(--ink-decor),
				calc(var(--px) * 2) calc(var(--px) * 3) 0 0 var(--ink-decor);
		}
	}

	.hud {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--s2);
		padding: var(--s2) var(--s3);
		background: var(--ink);
		color: var(--paper);
		font-size: var(--text-xs);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.hud ol {
		display: flex;
		gap: var(--s2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.palette {
		padding: 0 var(--s1);
		font-size: var(--text-sm);
		line-height: 1;
	}

	.palette:focus-visible {
		outline-color: var(--paper);
		outline-offset: 2px;
	}

	.hud li.done {
		text-decoration: line-through;
	}

	.hud li.here::before {
		content: '▶';
		animation: blink 1s steps(1) infinite;
	}

	@media (max-width: 359px) {
		.brand {
			display: none;
		}
	}

	main {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--s3);
	}
</style>
