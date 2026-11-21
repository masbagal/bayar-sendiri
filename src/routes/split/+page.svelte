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
		else if (getUsers().length === 0) goto(resolve('/players'));
	});

	const selectedName = $derived(getUsers().find((u) => u.id === getSelectedUserId())?.fullName);

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
	<title>Split items · Bayar Sendiri</title>
</svelte:head>

<section>
	<div class="party">
		<div class="party-head">
			<h2 id="players-label">Select player · {getUsers().length}</h2>
			<a class="link" href={resolve('/players')}>Edit players</a>
		</div>
		<div class="avatar-list" role="group" aria-labelledby="players-label">
			{#each getUsers() as user (user.id)}
				<Avatar
					fullName={user.fullName}
					selected={user.id === getSelectedUserId()}
					onclick={() => setSelectedUserId(user.id)}
				/>
			{/each}
		</div>
	</div>

	{#if selectedName}
		<p class="dialog prompt" aria-live="polite">
			What did <strong>{selectedName}</strong> have?<br />Tick their items.
		</p>
	{/if}

	{#if receiptData}
		<div class="orders">
			<h2>Orders · {receiptData.items.length}</h2>
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
		</div>

		{#each chargeSections as section (section.kind)}
			{#if receiptData[section.kind].length > 0 || editing === NEW[section.kind]}
				<div class="charges">
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
								class="charge-row"
								onclick={() => (editing = charge.id)}
								aria-label="Edit {charge.label}"
							>
								<span>{charge.label}</span>
								<span
									>{section.prefix}{formatMoney(charge.amount, receiptData)}<span aria-hidden="true"
										>✎</span
									></span
								>
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
			<button class="link" onclick={() => (editing = NEW.discounts)}>+ Disc</button>
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
			<div class="dialog alert" role="status">
				Receipt says
				<button class="inline-edit" onclick={() => (editing = PRINTED_TOTAL)}>
					{formatMoney(receiptData.printedTotal, receiptData)}<span aria-hidden="true">✎</span>
				</button>
				but the lines add up to {formatMoney(
					receiptData.reconciliation.computedTotal,
					receiptData
				)}. Tap ✎ on any line that doesn't match.
			</div>
		{/if}

		<div class="footer">
			{#if submitError && unassignedItemIds.length > 0}
				<div class="dialog alert" role="alert">
					{unassignedItemIds.length} item{unassignedItemIds.length > 1 ? 's' : ''} nobody claimed yet.
				</div>
			{/if}
			<button class="btn" onclick={goToSummary}>View summary ▶</button>
		</div>
	{/if}
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: var(--s3);
	}

	.party {
		position: sticky;
		top: 0;
		z-index: 2;
		margin: calc(-1 * var(--s3)) calc(-1 * var(--s3)) 0;
		padding: var(--s2) var(--s3) var(--s1);
		background: var(--paper);
		background-image: linear-gradient(to right, var(--ink) 50%, transparent 50%);
		background-size: 4px 2px;
		background-repeat: repeat-x;
		background-position: bottom;
	}

	.party-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.avatar-list {
		display: flex;
		gap: var(--s1);
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		padding-block: var(--s1);
	}

	.avatar-list::-webkit-scrollbar {
		display: none;
	}

	.orders,
	.charges {
		display: flex;
		flex-direction: column;
	}

	.orders h2 {
		padding-bottom: var(--s1);
	}

	.charge-row {
		display: flex;
		justify-content: space-between;
		gap: var(--s3);
		padding: var(--s2);
		text-align: left;
		background-image: linear-gradient(to right, var(--ink) 50%, transparent 50%);
		background-size: 4px 2px;
		background-repeat: repeat-x;
		background-position: bottom;
	}

	.charge-row:hover {
		background-color: var(--paper-raised);
	}

	.add-lines {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--s1) var(--s3);
		padding-inline: var(--s2);
	}

	.add-lines span {
		margin-right: auto;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.1em;
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

	.inline-edit {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 4px;
	}

	.footer {
		position: sticky;
		bottom: 0;
		display: grid;
		gap: var(--s2);
		margin-inline: calc(-1 * var(--s3));
		padding: var(--s2) var(--s3) var(--s3);
		background: var(--paper);
	}
</style>
