<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from './avatar.svelte';
	import MenuItem from './menu-item.svelte';
	import LineEditor from './line-editor.svelte';
	import {
		getReceiptData,
		removeLine,
		saveLine,
		setPrintedTotal,
		type LineKind
	} from '$lib/receipt-store.svelte.js';
	import {
		getUsers,
		addUser,
		getSelectedUserId,
		setSelectedUserId,
		toggleAssignment,
		getAssignedUsers,
		isAssigned
	} from '$lib/split-store.svelte.js';
	import { formatEditable, formatMoney } from '$lib/bill.js';

	const receiptData = $derived(getReceiptData());
	let submitError = $state(false);

	// ─── Corrections ───
	const NEW = { items: 'new:items', fees: 'new:fees', discounts: 'new:discounts' } as const;
	const PRINTED_TOTAL = 'printed-total';
	/** Id of the line being edited, one of NEW for a line being added, or PRINTED_TOTAL. */
	let editing = $state<string | null>(null);

	const chargeSections = [
		{ kind: 'fees', prefix: '', fallbackLabel: 'Fee', sign: (v: number) => v },
		{ kind: 'discounts', prefix: '-', fallbackLabel: 'Discount', sign: Math.abs }
	] as const;

	const positive = (value: number) => (value > 0 ? null : 'Amount must be more than 0');
	const nonZero = (value: number) => (value !== 0 ? null : 'Use Remove to delete this line');
	const close = () => (editing = null);
	const save = (kind: LineKind, id: string | null, label: string, value: number) => {
		saveLine(kind, id, label, value);
		close();
	};
	const remove = (kind: LineKind, id: string) => {
		removeLine(kind, id);
		close();
	};

	const unassignedItemIds = $derived(
		receiptData
			? receiptData.items
					.filter((item) => getAssignedUsers(item.id).length === 0)
					.map((item) => item.id)
			: []
	);

	onMount(() => {
		const data = getReceiptData();
		if (!data || data.items.length === 0) goto(resolve('/camera'));
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
			{#if editing === item.id}
				<LineEditor
					label={item.name}
					amount={formatEditable(item.lineTotal, receiptData)}
					validate={positive}
					onsave={(label, value) => save('items', item.id, label, value)}
					oncancel={close}
					onremove={() => remove('items', item.id)}
				/>
			{:else}
				<MenuItem
					id={item.id}
					menuName={item.name}
					price={formatMoney(item.lineTotal, receiptData)}
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
					onedit={() => (editing = item.id)}
				/>
			{/if}
		{/each}

		{#if editing === NEW.items}
			<LineEditor
				label=""
				amount=""
				validate={positive}
				onsave={(label, value) => save('items', null, label || 'Item', value)}
				oncancel={close}
			/>
		{/if}

		{#each chargeSections as section (section.kind)}
			{#if receiptData[section.kind].length > 0 || editing === NEW[section.kind]}
				<div class="summary-section">
					{#each receiptData[section.kind] as charge (charge.id)}
						{#if editing === charge.id}
							<LineEditor
								label={charge.label}
								amount={formatEditable(charge.amount, receiptData)}
								validate={nonZero}
								onsave={(label, value) => save(section.kind, charge.id, label, section.sign(value))}
								oncancel={close}
								onremove={() => remove(section.kind, charge.id)}
							/>
						{:else}
							<button
								class="summary-row"
								class:discount={section.kind === 'discounts'}
								onclick={() => (editing = charge.id)}
								aria-label="Edit {charge.label}"
							>
								<span>{charge.label}</span>
								<span>{section.prefix}{formatMoney(charge.amount, receiptData)} ✎</span>
							</button>
						{/if}
					{/each}
					{#if editing === NEW[section.kind]}
						<LineEditor
							label=""
							amount=""
							validate={nonZero}
							onsave={(label, value) =>
								save(section.kind, null, label || section.fallbackLabel, section.sign(value))}
							oncancel={close}
						/>
					{/if}
				</div>
			{/if}
		{/each}

		<div class="add-lines">
			<span>Missing something?</span>
			<button class="link" onclick={() => (editing = NEW.items)}>+ Item</button>
			<button class="link" onclick={() => (editing = NEW.fees)}>+ Fee</button>
			<button class="link" onclick={() => (editing = NEW.discounts)}>+ Discount</button>
		</div>

		<div class="grand-total">
			<span>Total</span>
			<span>{formatMoney(receiptData.reconciliation.computedTotal, receiptData)}</span>
		</div>
		{#if editing === PRINTED_TOTAL}
			<LineEditor
				label="Total printed on receipt"
				amount={formatEditable(receiptData.printedTotal, receiptData)}
				onsave={(_, value) => {
					setPrintedTotal(value);
					close();
				}}
				oncancel={close}
			/>
		{:else if receiptData.reconciliation.totalGap !== 0}
			<div class="error-message" role="status">
				The receipt says
				<button class="link" onclick={() => (editing = PRINTED_TOTAL)}>
					{formatMoney(receiptData.printedTotal, receiptData)} ✎
				</button>, but the lines above add up to {formatMoney(
					receiptData.reconciliation.computedTotal,
					receiptData
				)}. Tap ✎ on any line that doesn't match the receipt to fix it.
			</div>
		{/if}

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

	button.summary-row {
		width: 100%;
		border: none;
		background: none;
		text-transform: none;
		color: inherit;
		text-align: left;
	}

	button.summary-row.discount {
		color: var(--color-theme-2);
	}

	button.summary-row::before,
	button.link::before {
		display: none;
	}

	button.link {
		width: auto;
		padding: 0.25rem 0;
		border: none;
		background: none;
		color: inherit;
		text-transform: none;
		text-decoration: underline;
		font-size: inherit;
	}

	.add-lines {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		font-size: 0.85rem;
	}

	.add-lines span {
		opacity: 0.7;
		margin-right: auto;
	}

	.add-lines button {
		white-space: nowrap;
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
