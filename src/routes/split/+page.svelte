<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from './avatar.svelte';
	import MenuItem from './menu-item.svelte';
	import { getReceiptData } from '$lib/receipt-store.svelte.js';
	import {
		getUsers,
		addUser,
		getSelectedUserId,
		setSelectedUserId,
		toggleAssignment,
		getAssignedUsers,
		isAssigned
	} from '$lib/split-store.svelte.js';
	import type { ReceiptData } from '$lib/types.js';

	let receiptData = $state<ReceiptData | null>(null);
	let submitError = $state(false);

	const unassignedItemIds = $derived(
		receiptData
			? receiptData.items
					.filter((item) => getAssignedUsers(item.id).length === 0)
					.map((item) => item.id)
			: []
	);

	onMount(() => {
		const data = getReceiptData();

		if (!data || data.items.length === 0) {
			goto(resolve('/camera'));
			return;
		}
		receiptData = data;
	});

	const addPeople = () => {
		const name = prompt('Add people');
		if (name !== null) {
			const result = addUser(name);
			if (!result) {
				alert('Same name already exists');
			}
		}
	};

	const goToSummary = () => {
		if (unassignedItemIds.length > 0) {
			submitError = true;
			return;
		}
		submitError = false;
		goto(resolve('/split/summary'));
	};
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
	{#if getUsers().length > 0}
		<div style="font-size: 0.74rem;">Total: {getUsers().length} people</div>
	{/if}
	<div class="avatar-list">
		{#each getUsers() as user (user.id)}
			<Avatar
				id={user.id}
				fullName={user.fullName}
				selected={user.id === getSelectedUserId()}
				onclick={() => {
					setSelectedUserId(user.id);
				}}
			/>
		{/each}
		<button class="add-people" onclick={addPeople}>+Add</button>
	</div>

	{#if getUsers().length === 0}
		<div class="instruction">
			<p>Start by adding people, then select each person and check the items they ordered.</p>
		</div>
	{/if}

	<h2>Orders</h2>
	{#if receiptData}
		{#each receiptData.items as item (item.id)}
			<MenuItem
				id={item.id}
				menuName={item.name}
				price={item.unitPrice}
				quantity={item.quantity}
				disabled={!getSelectedUserId()}
				checked={getSelectedUserId() ? isAssigned(item.id, getSelectedUserId()!) : false}
				error={submitError && unassignedItemIds.includes(item.id)}
				assignedUsers={getAssignedUsers(item.id)
					.map((uid) => getUsers().find((u) => u.id === uid))
					.filter((u) => u !== undefined)}
				toggle={() => {
					const sel = getSelectedUserId();
					if (sel) toggleAssignment(item.id, sel);
				}}
			/>
		{/each}

		{#if receiptData.fees.length > 0}
			<div class="summary-section">
				{#each receiptData.fees as fee (fee.label)}
					<div class="summary-row">
						<span>{fee.label}</span>
						<span>{Intl.NumberFormat('id-ID').format(fee.amount)}</span>
					</div>
				{/each}
			</div>
		{/if}

		{#if receiptData.discounts.length > 0}
			<div class="summary-section">
				{#each receiptData.discounts as discount (discount.label)}
					<div class="summary-row discount">
						<span>{discount.label}</span>
						<span>-{Intl.NumberFormat('id-ID').format(discount.amount)}</span>
					</div>
				{/each}
			</div>
		{/if}

		<div class="grand-total">
			<span>Total</span>
			<span>{Intl.NumberFormat('id-ID').format(receiptData.grandTotal)}</span>
		</div>

		{#if getUsers().length > 0}
			{#if submitError && unassignedItemIds.length > 0}
				<div class="error-message">
					{unassignedItemIds.length} item{unassignedItemIds.length > 1 ? 's' : ''} not assigned to anyone
					yet.
				</div>
			{/if}
			<button class="summary-btn" onclick={goToSummary}> View Summary </button>
		{/if}
	{/if}
</section>

<style>
	h2 {
		font-size: 1.5rem;
	}

	.avatar-list {
		display: flex;
		flex-wrap: nowrap;
		width: 100%;
		overflow-x: scroll;
		overflow-y: visible;
		gap: 0.5em;
		scroll-snap-type: x mandatory;
		-ms-overflow-style: none;
		scrollbar-width: none;
		padding-bottom: 8px;
		margin-bottom: 1rem;
		margin-top: 1rem;
	}

	.summary-section {
		padding: 0.75rem 1rem;
		border-bottom: 1px dashed var(--color-divider);
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		padding: 0.25rem 0;
	}

	.discount {
		color: var(--color-theme-2);
	}

	.grand-total {
		display: flex;
		justify-content: space-between;
		font-weight: bold;
		font-size: 1.2rem;
		padding: 1rem;
	}

	.instruction {
		text-align: center;
		font-size: 0.85rem;
		opacity: 0.7;
		padding: 1rem;
		border: 1px dashed var(--color-divider);
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.instruction p {
		margin: 0;
	}

	.error-message {
		color: #d20f39;
		font-size: 0.85rem;
		text-align: center;
		padding: 0.5rem 1rem;
		margin-top: 0.5rem;
	}

	button.summary-btn {
		width: 100%;
		margin-top: 1rem;
	}

	button.add-people {
		height: 68px;
		width: 68px;
		font-size: 0.8rem;
		display: flex;
		flex-basis: 60px;
		align-items: center;
		justify-content: center;
		scroll-snap-align: start;
	}
</style>
