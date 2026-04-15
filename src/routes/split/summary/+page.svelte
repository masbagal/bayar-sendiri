<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createAvatar } from '@dicebear/core';
	import { bottts } from '@dicebear/collection';
	import { getReceiptData } from '$lib/receipt-store.svelte.js';
	import { getUsers, calculateUserBreakdown } from '$lib/split-store.svelte.js';
	import type { ReceiptData } from '$lib/types.js';

	let receiptData = $state<ReceiptData | null>(null);
	let cardElement = $state<HTMLDivElement | undefined>(undefined);
	let sharing = $state(false);

	onMount(() => {
		const data = getReceiptData();
		if (!data || data.items.length === 0) {
			goto(resolve('/camera'));
			return;
		}
		if (getUsers().length === 0) {
			goto(resolve('/split'));
			return;
		}
		receiptData = data;
	});

	const breakdown = $derived(receiptData ? calculateUserBreakdown(receiptData) : []);

	function avatarUri(name: string) {
		return createAvatar(bottts, { seed: name, size: 28, clip: false, translateY: 6 }).toDataUri();
	}

	async function shareAsImage() {
		if (!cardElement) return;
		sharing = true;
		try {
			const bg = getComputedStyle(cardElement).backgroundColor;
			const { toBlob } = await import('html-to-image');
			const blob = await toBlob(cardElement, { pixelRatio: 2, backgroundColor: bg });
			if (!blob) return;

			const file = new File([blob], 'bill-summary.png', { type: 'image/png' });

			if (navigator.canShare?.({ files: [file] })) {
				await navigator.share({ files: [file] });
			} else {
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'bill-summary.png';
				a.click();
				URL.revokeObjectURL(url);
			}
		} catch (e) {
			if (e instanceof Error && e.name !== 'AbortError') {
				console.error('Share failed:', e);
			}
		} finally {
			sharing = false;
		}
	}
</script>

<svelte:head>
	<title>Summary</title>
</svelte:head>

<section>
	<button class="back" onclick={() => goto(resolve('/split'))}>&#8592; Back</button>

	{#if receiptData}
		<div class="share-card" bind:this={cardElement}>
			<h1>Bill Summary</h1>
			<div class="date">{new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</div>
			<div class="divider"></div>

			{#each breakdown as person (person.userId)}
				<div class="person-section">
					<div class="person-header">
						<img src={avatarUri(person.fullName)} alt={person.fullName} class="person-avatar" />
						<h2>{person.fullName}</h2>
					</div>
					{#each person.items as item (item.itemId)}
						<div class="item-row">
							<span class="item-name">
								{item.itemName}
								{#if item.sharedBy > 1}
									<span class="shared-badge">÷{item.sharedBy}</span>
								{/if}
							</span>
							<span>{Intl.NumberFormat('id-ID').format(item.userShare)}</span>
						</div>
					{/each}
					{#if person.feeShare > 0}
						<div class="item-row fee">
							<span>Tax/Extra Fee</span>
							<span>{Intl.NumberFormat('id-ID').format(person.feeShare)}</span>
						</div>
					{/if}
					{#if person.discountShare > 0}
						<div class="item-row discount">
							<span>Discount</span>
							<span>-{Intl.NumberFormat('id-ID').format(person.discountShare)}</span>
						</div>
					{/if}
					<div class="person-total">
						<span>Total</span>
						<span>{Intl.NumberFormat('id-ID').format(person.total)}</span>
					</div>
				</div>
				<div class="divider"></div>
			{/each}

			<div class="grand-total">
				<span>Grand Total</span>
				<span>{Intl.NumberFormat('id-ID').format(receiptData.grandTotal)}</span>
			</div>
		</div>

		<button class="share-btn" onclick={shareAsImage} disabled={sharing}>
			{sharing ? 'Generating...' : 'Share as Image'}
		</button>
	{/if}
</section>

<style>
	section {
		max-width: min(900px, 100vw);
		margin: 0 auto;
		padding: 1rem;
	}

	button.back {
		color: var(--color-text);
		padding: 0;
		margin-bottom: 1rem;
		text-transform: none;
	}

	.share-card {
		background-color: var(--color-bg-1);
		padding: 1.5rem;
		border-radius: 4px;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.08),
			0 4px 12px rgba(0, 0, 0, 0.04);
	}

	.date {
		font-size: 0.75rem;
		opacity: 0.6;
		margin: 0 auto 0.25rem;
		text-align: center;
	}

	.share-card h1 {
		font-size: 1.4rem;
		margin: 0 0 0.5rem;
	}

	.divider {
		border-bottom: 1px dashed var(--color-divider);
		margin: 0.75rem 0;
	}

	.person-section {
		padding: 0.5rem 0;
	}

	.person-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.person-avatar {
		width: 28px;
		height: 28px;
	}

	.person-section h2 {
		font-size: 1rem;
		margin: 0;
	}

	.item-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.85rem;
		padding: 0.2rem 0;
	}

	.item-name {
		display: flex;
		align-items: center;
		gap: 0.4em;
	}

	.shared-badge {
		font-size: 0.7rem;
		color: var(--color-bg-1);
		background: var(--color-theme-2);
		padding: 0.1em 0.35em;
		border-radius: 2px;
	}

	.fee {
		opacity: 0.7;
	}

	.discount {
		color: var(--color-theme-2);
	}

	.person-total {
		display: flex;
		justify-content: space-between;
		font-weight: bold;
		font-size: 0.95rem;
		padding: 0.3rem 0 0;
	}

	.grand-total {
		display: flex;
		justify-content: space-between;
		font-weight: bold;
		font-size: 1.2rem;
		padding: 0.5rem 0;
	}

	button.share-btn {
		width: 100%;
		margin-top: 1rem;
	}

	button.share-btn:disabled {
		opacity: 0.6;
	}
</style>
