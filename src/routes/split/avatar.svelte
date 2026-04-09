<script lang="ts">
	import { createAvatar } from '@dicebear/core';
	import { bottts } from '@dicebear/collection';

	interface Props {
		id: string;
		fullName: string;
		selected?: boolean;
		onclick: () => void;
	}

	let { id = '0', fullName = 'Unknown', selected = false, onclick }: Props = $props();

	const avatar = $derived(
		createAvatar(bottts, {
			seed: fullName,
			size: 60
		}).toDataUri()
	);
</script>

<div class={['item', { selected }]}>
	<button data-id={id} class="avatar" {onclick}>
		<img src={avatar} alt={fullName} />
	</button>
	<div class="name">{fullName}</div>
</div>

<style>
	.item {
		scroll-snap-align: start;
	}
	.avatar {
		display: inline-block;
		margin: 0;
		border: none;
		background: none;
		padding: 0;
		border-bottom: 6px solid transparent;
	}

	.item.selected .avatar {
		border-bottom: 6px solid var(--color-theme-2);
	}

	.avatar img {
		height: 60px;
		width: 60px;
		object-fit: contain;
		opacity: 0.7;
		filter: grayscale(0.45);
	}

	.name {
		margin-top: 0.5em;
		text-align: center;
		font-size: 0.7em;
		opacity: 0.4;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		width: 60px;
	}

	.item.selected .name,
	.item.selected img {
		opacity: 1;
		color: var(--color-theme-2);
	}

	.item.selected img {
		transform-origin: center;
		animation: float 1s steps(2) infinite;
		filter: grayscale(0);
	}

	@keyframes float {
		0% {
			transform: translateY(-2px);
		}
		25% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(2px);
		}
		75% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(-2px);
		}
	}
</style>
