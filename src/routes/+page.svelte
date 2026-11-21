<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PalettePicker from '$lib/palette-picker.svelte';
</script>

<svelte:head>
	<title>Bayar Sendiri Sendiri</title>
	<meta name="description" content="Snap a receipt and split the bill with friends." />
</svelte:head>

<section>
	<div class="title">
		<div class="sprite" aria-hidden="true">┐(︶▽︶)┌</div>
		<h1>Bayar<br />Sendiri<br />Sendiri<span class="tilde">~</span></h1>
		<p class="tagline">Split the bill, not the friendship.</p>
	</div>

	<ol class="how">
		<li><span class="num">1</span> Snap the receipt</li>
		<li><span class="num">2</span> Enter players</li>
		<li><span class="num">3</span> Pick who ate what</li>
	</ol>

	<PalettePicker />

	<button class="btn" onclick={() => goto(resolve('/camera'))}>
		<span class="cursor" aria-hidden="true">▶</span> Press start
	</button>
</section>

<style>
	section {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: var(--s5);
		padding-block: var(--s5) var(--s3);
	}

	.title {
		display: flex;
		flex-direction: column;
		gap: var(--s3);
	}

	.sprite {
		font-size: var(--text-md);
		animation: bob 1.2s steps(2) infinite;
		width: max-content;
	}

	h1 {
		font-size: var(--text-xl);
		line-height: 1;
		letter-spacing: -0.02em;
	}

	.tilde {
		display: inline-block;
		animation: blink 1s steps(1) infinite;
	}

	.tagline {
		font-size: var(--text-sm);
	}

	.how {
		display: grid;
		gap: var(--s2);
		margin: 0;
		padding: var(--s3);
		list-style: none;
		background: var(--paper-raised);
		text-transform: uppercase;
		font-size: var(--text-xs);
		letter-spacing: 0.1em;
	}

	.how li {
		display: flex;
		align-items: center;
		gap: var(--s2);
	}

	.num {
		display: inline-grid;
		place-items: center;
		width: 22px;
		height: 22px;
		background: var(--ink);
		color: var(--paper);
	}

	@keyframes bob {
		50% {
			transform: translateY(-4px);
		}
	}
</style>
