<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getReceiptData } from '$lib/receipt-store.svelte.js';
	import { addUser, getUsers, removeUser } from '$lib/split-store.svelte.js';
	import { avatarUri } from '$lib/avatar.js';

	let name = $state('');
	let error = $state('');
	let input: HTMLInputElement;

	onMount(() => {
		const data = getReceiptData();
		if (!data || data.items.length === 0) goto(resolve('/camera'));
	});

	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) {
			error = 'Type a name first';
		} else if (!addUser(trimmed)) {
			error = `${trimmed} is already playing`;
		} else {
			name = '';
			error = '';
		}
		input.focus();
	};
</script>

<svelte:head>
	<title>Players · Bayar Sendiri</title>
</svelte:head>

<section>
	<header>
		<h1>Who's<br />eating?</h1>
		<p>Add everyone at the table. You can come back to change this.</p>
	</header>

	<form onsubmit={submit} class="add">
		<label class="visually-hidden" for="player-name">Player name</label>
		<input
			id="player-name"
			class="field"
			bind:this={input}
			bind:value={name}
			oninput={() => (error = '')}
			placeholder="Name"
			autocomplete="off"
			autocapitalize="words"
			enterkeyhint="done"
			maxlength="24"
			aria-invalid={error !== ''}
			aria-describedby={error ? 'player-error' : undefined}
		/>
		<button class="btn add-btn" type="submit">+ Add</button>
	</form>
	{#if error}
		<p id="player-error" class="dialog alert" role="alert">{error}</p>
	{/if}

	<div class="roster">
		<h2>Players · {getUsers().length}</h2>
		{#if getUsers().length === 0}
			<p class="empty">No players yet. Start with yourself!</p>
		{:else}
			<ul>
				{#each getUsers() as user, i (user.id)}
					<li>
						<span class="slot">P{i + 1}</span>
						<img src={avatarUri(user.fullName)} alt="" width="48" height="48" />
						<span class="name">{user.fullName}</span>
						<button
							class="link"
							onclick={() => removeUser(user.id)}
							aria-label="Remove {user.fullName}">✕ Drop</button
						>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<button
		class="btn next"
		disabled={getUsers().length === 0}
		onclick={() => goto(resolve('/split'))}
	>
		{getUsers().length === 0 ? 'Add a player to continue' : 'Next: split items ▶'}
	</button>
</section>

<style>
	section {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--s4);
	}

	header {
		display: grid;
		gap: var(--s2);
	}

	.add {
		display: flex;
		align-items: stretch;
		gap: var(--s3);
	}

	.add .field {
		flex: 1;
		font-size: var(--text-md);
	}

	.add-btn {
		width: auto;
		margin: var(--px) calc(var(--px) * 2) calc(var(--px) * 2) 0;
		white-space: nowrap;
	}

	.roster {
		display: grid;
		gap: var(--s2);
		flex: 1;
		align-content: start;
	}

	.empty {
		padding: var(--s4) var(--s3);
		background: var(--paper-raised);
		text-align: center;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: var(--s2);
		padding-block: var(--s2);
		background-image: linear-gradient(to right, var(--ink) 50%, transparent 50%);
		background-size: 4px 2px;
		background-repeat: repeat-x;
		background-position: bottom;
		animation: pop 0.2s steps(2);
	}

	.slot {
		width: 3ch;
		font-size: var(--text-xs);
	}

	li img {
		width: 48px;
		height: 48px;
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.next {
		position: sticky;
		bottom: var(--s3);
	}

	.next:disabled {
		cursor: not-allowed;
	}

	@keyframes pop {
		from {
			transform: translateX(-8px);
		}
	}
</style>
