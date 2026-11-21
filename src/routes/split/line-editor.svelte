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
	<input class="name" aria-label="Name" bind:value={labelValue} />
	<input
		class="amount"
		aria-label="Amount"
		inputmode="decimal"
		bind:value={amountValue}
		use:focus
		aria-invalid={error !== ''}
	/>
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
	<div class="actions">
		{#if onremove}
			<button type="button" class="link danger" onclick={onremove}>Remove</button>
		{/if}
		<button type="button" class="link" onclick={oncancel}>Cancel</button>
		<button type="submit" class="link save">Save</button>
	</div>
</form>

<style>
	.line-editor {
		display: grid;
		grid-template-columns: 1fr 9rem;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px dashed var(--color-divider);
	}

	input {
		font: inherit;
		font-size: 0.9rem;
		padding: 0.5rem;
		border: 2px solid var(--color-text);
		background: var(--color-bg-1);
		color: var(--color-text);
		min-width: 0;
	}

	.amount {
		text-align: right;
	}

	.error {
		grid-column: 1 / -1;
		margin: 0;
		color: #d20f39;
		font-size: 0.8rem;
	}

	.actions {
		grid-column: 1 / -1;
		display: flex;
		justify-content: flex-end;
		gap: 1.25rem;
	}

	button.link {
		width: auto;
		padding: 0.25rem 0;
		border: none;
		background: none;
		text-transform: none;
		text-decoration: underline;
		font-size: 0.85rem;
	}

	button.link::before {
		display: none;
	}

	button.save {
		font-weight: bold;
	}

	button.danger {
		color: #d20f39;
		margin-right: auto;
	}
</style>
