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
				goto(resolve('/split'));
				return;
			}

			const response = await fetch(resolve('/api/analyze'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ image })
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({ message: 'Unknown error' }));
				throw new Error(err.message ?? `Server error: ${response.status}`);
			}

			const data = await response.json();
			sessionStorage.setItem(cacheKey, JSON.stringify(data));
			setReceiptData(data);
			goto(resolve('/split'));
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

<section>
	{#if errorMessage}
		<div class="icon">( ; _ ; )</div>
		<h1>{errorMessage}</h1>
		<button onclick={() => goto(resolve('/camera'))}>Try Again</button>
	{:else}
		<div class="icon loading">{sprites[step]}</div>
		<h1>Reading your image...</h1>
	{/if}
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 1;
		text-align: center;
		gap: 1rem;

		animation: slideup 0.2s ease-out normal;
	}

	.icon {
		font-size: 2rem;
	}

	.loading {
		animation: pulse 1.5s ease-in-out infinite;
	}

	h1 {
		font-size: 1.5rem;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
	@keyframes slideup {
		0% {
			transform: translateY(200%);
		}

		100% {
			transform: translateY(0);
		}
	}
</style>
