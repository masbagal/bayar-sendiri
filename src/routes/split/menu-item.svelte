<script lang="ts">
	import AvatarSmall from './avatar-stacked.svelte';

	interface Props {
		id: string;
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
		id = '0',
		menuName = 'Unknown',
		price = '0',
		quantity = 1,
		checked = false,
		disabled = false,
		error = false,
		assignedUsers = [],
		toggle,
		onedit
	}: Props = $props();
	const uid = $props.id();
</script>

<div data-id={id} class="menu-item" class:active={checked} class:error>
	<div class="title">
		<label for="{uid}-title">{menuName}</label>
		<input id="{uid}-title" type="checkbox" {checked} {disabled} onchange={toggle} />
	</div>
	<div class="data">
		<div class="avatar">
			{#each assignedUsers as user (user.fullName)}
				<AvatarSmall fullName={user.fullName} />
			{/each}
		</div>
		<div class="amount">x{quantity}</div>
		<button class="price" onclick={onedit} aria-label="Edit {menuName}, {price}">{price} ✎</button>
	</div>
</div>

<style>
	.menu-item {
		padding: 1rem 1rem;
		border-bottom: 1px dashed var(--color-divider);
		position: relative;
	}

	.menu-item.active::before,
	.menu-item.error::before {
		content: '';
		position: absolute;
		inset: 0.3rem -0.25rem;
		border-radius: 2px;
		z-index: -1;
	}

	.menu-item.active::before {
		background-image: url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2340a02b' fill-opacity='0.41' fill-rule='evenodd'%3E%3Cpath d='M5 0h1L0 6V5zM6 5v1H5z'/%3E%3C/g%3E%3C/svg%3E");
	}

	.menu-item.error::before {
		background-image: url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23f47f67' fill-opacity='0.57' fill-rule='evenodd'%3E%3Cpath d='M5 0h1L0 6V5zM6 5v1H5z'/%3E%3C/g%3E%3C/svg%3E");
	}
	.menu-item label {
		font-weight: bold;
		font-size: 0.9rem;
		margin-bottom: 1rem;
		text-shadow:
			-1px -1px 0 var(--color-bg-1),
			1px -1px 0 var(--color-bg-1),
			-1px 1px 0 var(--color-bg-1),
			1px 1px 0 var(--color-bg-1);
	}

	.menu-item .title {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.menu-item .avatar {
		height: 36px;
	}

	.menu-item .data {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		align-items: center;
	}

	.menu-item .data .price,
	.menu-item .data .amount {
		text-align: right;
	}

	.menu-item .data button.price {
		width: auto;
		justify-self: end;
		padding: 0.25rem 0;
		border: none;
		background: none;
		text-transform: none;
		font-size: inherit;
	}

	.menu-item .data button.price::before {
		display: none;
	}
</style>
