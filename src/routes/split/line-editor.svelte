<script lang="ts">
	import { untrack } from 'svelte';
	import { parseAmount } from '$lib/parse-amount.js';

	interface Props {
		label: string;
		amount: string;
		/** Validates the parsed amount; return an error message to keep the editor open. */
		validate?: (value: number) => string | null;
		onsave: (label: string, value: number) => void;
		oncancel: () => void;
		onremove?: () => void;
	}

	let { label, amount, validate, onsave, oncancel, onremove }: Props = $props();

	let labelValue = $state(untrack(() => label));
	let amountValue = $state(untrack(() => amount));
	let error = $state('');

	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		const value = parseAmount(amountValue);
		if (value === null) {
			error = 'Enter an amount, e.g. 25.000';
			return;
		}
		const problem = validate?.(value) ?? null;
		if (problem) {
			error = problem;
			return;
		}
		onsave(labelValue.trim() || label, value);
	};

	const cancelOnEscape = (event: KeyboardEvent) => {
		if (event.key === 'Escape') oncancel();
	};

	const focus = (node: HTMLInputElement) => {
		node.focus();
		node.select();
	};
</script>

<svelte:window onkeydown={cancelOnEscape} />

<form class="line-editor" onsubmit={submit}>
	<input class="field name" aria-label="Name" bind:value={labelValue} placeholder="Name" />
	<input
		class="field amount"
		aria-label="Amount"
		inputmode="decimal"
		bind:value={amountValue}
		use:focus
		aria-invalid={error !== ''}
		placeholder="0"
	/>
	{#if error}
		<p class="dialog alert" role="alert">{error}</p>
	{/if}
	<div class="actions">
		{#if onremove}
			<button type="button" class="link remove" onclick={onremove}>✕ Remove</button>
		{/if}
		<button type="button" class="link" onclick={oncancel}>Cancel</button>
		<button type="submit" class="btn save">Save</button>
	</div>
</form>

<style>
	.line-editor {
		display: grid;
		grid-template-columns: 1fr 8rem;
		gap: var(--s3);
		padding: var(--s3) var(--s2);
		background: var(--paper-raised);
	}

	.amount {
		text-align: right;
	}

	.dialog {
		grid-column: 1 / -1;
		font-size: var(--text-sm);
	}

	.actions {
		grid-column: 1 / -1;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: var(--s4);
	}

	.remove {
		margin-right: auto;
	}

	.save {
		width: auto;
		min-height: 0;
		padding: var(--s1) var(--s3);
	}
</style>
