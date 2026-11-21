<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getReceiptData } from '$lib/receipt-store.svelte.js';
	import { getUsers, calculateUserBreakdown } from '$lib/split-store.svelte.js';
	import { formatMoney } from '$lib/bill.js';
	import { avatarUri } from '$lib/avatar.js';
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
	const splitTotal = $derived(breakdown.reduce((sum, person) => sum + person.total, 0));

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
	<title>Summary · Bayar Sendiri</title>
</svelte:head>

<section>
	<a class="link back" href={resolve('/split')}>◀ Back to items</a>

	{#if receiptData}
		<div class="share-card" bind:this={cardElement}>
			<div class="ticket">
				<header>
					<h1>Bill summary</h1>
					<p class="date">{new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
				</header>
				<hr class="rule" />

				{#each breakdown as person, i (person.userId)}
					<article class="person">
						<div class="person-header">
							<img src={avatarUri(person.fullName)} alt="" class="person-avatar" />
							<h2><span class="slot">P{i + 1}</span> {person.fullName}</h2>
						</div>
						{#each person.items as item (item.itemId)}
							<div class="row">
								<span class="item-name">
									{item.itemName}
									{#if item.sharedBy > 1}
										<span class="badge" aria-label="split {item.sharedBy} ways"
											>÷{item.sharedBy}</span
										>
									{/if}
								</span>
								<span>{formatMoney(item.userShare, receiptData)}</span>
							</div>
						{/each}
						{#if person.feeShare !== 0}
							<div class="row">
								<span>Tax / fees</span>
								<span>{formatMoney(person.feeShare, receiptData)}</span>
							</div>
						{/if}
						{#if person.discountShare > 0}
							<div class="row">
								<span>Discount</span>
								<span>-{formatMoney(person.discountShare, receiptData)}</span>
							</div>
						{/if}
						<div class="person-total">
							<span>Pays</span>
							<span>{formatMoney(person.total, receiptData)}</span>
						</div>
					</article>
					<hr class="rule" />
				{/each}

				<div class="grand-total">
					<span>Grand total</span>
					<span>{formatMoney(splitTotal, receiptData)}</span>
				</div>
				<p class="footer-note">Bayar sendiri sendiri~ ┐(︶▽︶)┌</p>
			</div>
		</div>

		<button class="btn" onclick={shareAsImage} disabled={sharing}>
			{sharing ? 'Printing...' : 'Share as image ▶'}
		</button>
	{/if}
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: var(--s3);
	}

	.back {
		align-self: flex-start;
	}

	/* Padding keeps the pixel frame inside the element html-to-image captures. */
	.share-card {
		padding: var(--s2);
		background-color: var(--paper);
	}

	.ticket {
		display: grid;
		gap: var(--s3);
		padding: var(--s4) var(--s3);
		background: var(--paper);
		box-shadow:
			0 calc(-1 * var(--px)) 0 0 var(--ink),
			0 var(--px) 0 0 var(--ink),
			calc(-1 * var(--px)) 0 0 0 var(--ink),
			var(--px) 0 0 0 var(--ink),
			inset 0 0 0 var(--px) var(--paper),
			inset 0 0 0 calc(var(--px) + 2px) var(--ink);
	}

	header {
		display: grid;
		gap: var(--s1);
		text-align: center;
	}

	h1 {
		font-size: var(--text-md);
	}

	.date,
	.footer-note {
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-align: center;
	}

	.person {
		display: grid;
		gap: var(--s1);
	}

	.person-header {
		display: flex;
		align-items: center;
		gap: var(--s2);
		margin-bottom: var(--s1);
	}

	.person-avatar {
		width: 32px;
		height: 32px;
	}

	.person h2 {
		font-size: var(--text-sm);
		letter-spacing: 0;
	}

	.slot {
		padding: 0 var(--s1);
		background: var(--ink);
		color: var(--paper);
		font-size: var(--text-xs);
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: var(--s3);
		font-size: var(--text-sm);
	}

	.item-name {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--s1);
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.badge {
		padding: 0 var(--s1);
		font-size: var(--text-xs);
		box-shadow: inset 0 0 0 2px var(--ink);
	}

	.person-total {
		display: flex;
		justify-content: space-between;
		margin-top: var(--s1);
		padding: var(--s1) var(--s2);
		background: var(--paper-raised);
		text-transform: uppercase;
	}

	.grand-total {
		display: flex;
		justify-content: space-between;
		gap: var(--s3);
		padding: var(--s2) var(--s3);
		background: var(--ink);
		color: var(--paper);
		font-size: var(--text-md);
		text-transform: uppercase;
	}
</style>
