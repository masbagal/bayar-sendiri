<script lang="ts">
	import { avatarUri } from '$lib/avatar.js';

	interface Props {
		fullName: string;
		selected?: boolean;
		onclick: () => void;
	}

	let { fullName, selected = false, onclick }: Props = $props();
</script>

<button class="player" class:selected aria-pressed={selected} {onclick}>
	<span class="cursor" aria-hidden="true">▼</span>
	<img src={avatarUri(fullName)} alt="" width="48" height="48" />
	<span class="name">{fullName}</span>
</button>

<style>
	.player {
		flex: none;
		display: grid;
		justify-items: center;
		gap: var(--s1);
		width: 72px;
		padding: var(--s1);
		scroll-snap-align: start;
	}

	.cursor {
		font-size: var(--text-xs);
		visibility: hidden;
	}

	img {
		width: 48px;
		height: 48px;
		margin: 3px;
		box-shadow:
			0 -3px 0 0 var(--paper-raised),
			0 3px 0 0 var(--paper-raised),
			-3px 0 0 0 var(--paper-raised),
			3px 0 0 0 var(--paper-raised);
	}

	.name {
		width: 100%;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.selected .cursor {
		visibility: visible;
		animation: bob 0.8s steps(2) infinite;
	}

	.selected img {
		box-shadow:
			0 -3px 0 0 var(--ink),
			0 3px 0 0 var(--ink),
			-3px 0 0 0 var(--ink),
			3px 0 0 0 var(--ink);
	}

	.selected .name {
		background: var(--ink);
		color: var(--paper);
	}

	@keyframes bob {
		50% {
			transform: translateY(2px);
		}
	}
</style>
