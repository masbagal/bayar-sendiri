<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getCapturedImage, setReceiptData } from '$lib/receipt-store.svelte.js';

	let errorMessage = $state('');

	let timeoutId: NodeJS.Timeout;
	let step = $state(0);
	const sprites = ['ヽ(･∀･)ﾉ', '(∀･ﾉ)', '(･ﾉ )', 'ヽ( )ﾉ', '( ヽ･)', '(ヽ･∀)', 'ヽ(･∀･)ﾉ'];

	const animate = () => {
		timeoutId = setTimeout(() => {
			step += 1;
			if (step > sprites.length - 1) {
				step = 0;
			}
			animate();
		}, 200);
	};

	/** " Scanning is back at 07.00." in the viewer's local time, or "" if unknown. */
	const resumeAt = (resetsAt: string | null | undefined) => {
		if (!resetsAt) return '';
		const at = new Date(resetsAt);
		if (Number.isNaN(at.getTime())) return '';
		const sameDay = at.toDateString() === new Date().toDateString();
		const when = at.toLocaleString('en-GB', {
			hour: '2-digit',
			minute: '2-digit',
			...(sameDay ? {} : { weekday: 'long' })
		});
		return ` Scanning is back at ${when}.`;
	};

	const getCacheKey = async (img: string) => {
		const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(img));
		const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
		return `receipt:v2:${hex}`;
	};

	onMount(async () => {
		const image = getCapturedImage();
		animate();

		if (!image) {
			goto(resolve('/camera'));
			return;
		}

		try {
			const cacheKey = await getCacheKey(image);
			const cached = sessionStorage.getItem(cacheKey);
			if (cached) {
				setReceiptData(JSON.parse(cached));
				goto(resolve('/players'));
				return;
			}

			const response = await fetch(resolve('/api/analyze'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ image })
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({ message: 'Unknown error' }));
				throw new Error(
					(err.message ?? `Server error: ${response.status}`) + resumeAt(err.resetsAt)
				);
			}

			const data = await response.json();
			sessionStorage.setItem(cacheKey, JSON.stringify(data));
			setReceiptData(data);
			goto(resolve('/players'));
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			clearTimeout(timeoutId);
			step = 0;
		}
	});

	onDestroy(() => {
		clearTimeout(timeoutId);
	});
</script>

<svelte:head>
	<title>Reading receipt · Bayar Sendiri</title>
</svelte:head>

<section>
	{#if errorMessage}
		<div class="sprite" aria-hidden="true">( ; _ ; )</div>
		<div class="dialog alert" role="alert">
			<h1 class="visually-hidden">Couldn't read the receipt</h1>
			{errorMessage}
		</div>
		<button class="btn" onclick={() => goto(resolve('/camera'))}>⟲ Try again</button>
	{:else}
		<div class="sprite" aria-hidden="true">{sprites[step]}</div>
		<h1>Reading receipt<span class="dots" aria-hidden="true">...</span></h1>
		<div class="bar" role="progressbar" aria-label="Reading receipt" aria-busy="true">
			{#each { length: 12 }, i (i)}
				<span style="animation-delay: {i * 120}ms"></span>
			{/each}
		</div>
		<p class="hint">Counting every rupiah. This takes a few seconds.</p>
	{/if}
</section>

<style>
	section {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: stretch;
		gap: var(--s4);
		text-align: center;
	}

	.sprite {
		font-size: var(--text-lg);
		min-height: 1.5em;
	}

	h1 {
		font-size: var(--text-md);
	}

	.dots {
		animation: blink 1s steps(1) infinite;
	}

	.bar {
		display: grid;
		grid-template-columns: repeat(12, 1fr);
		gap: var(--s1);
		padding: var(--s1);
		margin: var(--px);
		box-shadow:
			0 calc(-1 * var(--px)) 0 0 var(--ink),
			0 var(--px) 0 0 var(--ink),
			calc(-1 * var(--px)) 0 0 0 var(--ink),
			var(--px) 0 0 0 var(--ink);
	}

	.bar span {
		height: var(--s3);
		background: var(--ink);
		opacity: 0;
		animation: fill 1.44s steps(1) infinite;
	}

	.hint {
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.dialog {
		text-align: left;
	}

	@keyframes fill {
		0%,
		100% {
			opacity: 0;
		}
		10%,
		60% {
			opacity: 1;
		}
	}
</style>
