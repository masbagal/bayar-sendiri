<script lang="ts">
	import { avatarUri } from '$lib/avatar.js';

	interface Props {
		menuName: string;
		price: string;
		quantity: number;
		checked: boolean;
		disabled: boolean;
		error: boolean;
		assignedUsers: { fullName: string }[];
		toggle: () => void;
		onedit: () => void;
	}

	let {
		menuName,
		price,
		quantity,
		checked,
		disabled,
		error,
		assignedUsers,
		toggle,
		onedit
	}: Props = $props();
	const uid = $props.id();
</script>

<div class="menu-item" class:active={checked} class:error>
	<input id={uid} type="checkbox" {checked} {disabled} onchange={toggle} />
	<div class="body">
		<label for={uid}>
			{#if error}<span class="flag">!</span>{/if}
			{menuName}
		</label>
		<div class="meta">
			<span class="qty">×{quantity}</span>
			<span class="avatars">
				{#each assignedUsers as user (user.fullName)}
					<img src={avatarUri(user.fullName)} alt={user.fullName} title={user.fullName} />
				{/each}
			</span>
		</div>
	</div>
	<button class="price" onclick={onedit} aria-label="Edit {menuName}, {price}">
		{price}<span aria-hidden="true">✎</span>
	</button>
</div>

<style>
	.menu-item {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: start;
		gap: var(--s3);
		padding: var(--s3) var(--s2);
		background-image: linear-gradient(to right, var(--ink) 50%, transparent 50%);
		background-size: 4px 2px;
		background-repeat: repeat-x;
		background-position: bottom;
	}

	.menu-item.active {
		background-color: var(--paper-raised);
	}

	.menu-item.error {
		background-image:
			linear-gradient(to right, var(--ink) 50%, transparent 50%),
			repeating-linear-gradient(
				-45deg,
				transparent 0 6px,
				color-mix(in srgb, var(--ink) 15%, transparent) 6px 8px
			);
		background-size:
			4px 2px,
			auto;
		background-repeat: repeat-x, repeat;
		background-position:
			bottom,
			0 0;
	}

	.body {
		display: grid;
		gap: var(--s1);
		min-width: 0;
	}

	label {
		cursor: pointer;
		overflow-wrap: anywhere;
	}

	.flag {
		display: inline-block;
		padding: 0 var(--s1);
		background: var(--ink);
		color: var(--paper);
	}

	.meta {
		display: flex;
		align-items: center;
		gap: var(--s2);
		min-height: 24px;
	}

	.qty {
		font-size: var(--text-xs);
	}

	.avatars {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
	}

	.avatars img {
		width: 24px;
		height: 24px;
	}

	.price {
		display: flex;
		gap: var(--s1);
		padding: 0 0 var(--s1);
		text-align: right;
		white-space: nowrap;
		border-bottom: 2px solid transparent;
	}

	.price:hover {
		border-bottom-color: var(--ink);
	}
</style>
