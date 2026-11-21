<script lang="ts">
	import { PALETTES, getPalette, setPalette } from './palette.svelte.js';
</script>

<fieldset class="picker">
	<legend>Palette</legend>
	<div class="options">
		{#each PALETTES as palette (palette.id)}
			<label class="option" data-palette={palette.id}>
				<input
					class="visually-hidden"
					type="radio"
					name="palette"
					value={palette.id}
					checked={getPalette().id === palette.id}
					onchange={() => setPalette(palette.id)}
				/>
				<span class="swatches" aria-hidden="true">
					<span style="background: var(--ink)"></span>
					<span style="background: var(--ink-decor)"></span>
					<span style="background: var(--paper-raised)"></span>
					<span style="background: var(--paper)"></span>
				</span>
				<span class="name">{palette.name}</span>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.picker {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	legend {
		margin-bottom: var(--s2);
		font-size: var(--text-xs);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.options {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s3);
	}

	/* Each option renders in its own palette, like a tiny screen. */
	.option {
		display: grid;
		gap: var(--s2);
		padding: var(--s2);
		margin: 3px;
		cursor: pointer;
		background: var(--paper);
		color: var(--ink);
		box-shadow:
			0 -3px 0 0 var(--ink),
			0 3px 0 0 var(--ink),
			-3px 0 0 0 var(--ink),
			3px 0 0 0 var(--ink);
	}

	.swatches {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		height: var(--s3);
		box-shadow: inset 0 0 0 2px var(--ink);
	}

	.name {
		font-size: var(--text-xs);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.name::before {
		content: '  ';
		white-space: pre;
	}

	.option:has(input:checked) {
		box-shadow:
			0 -3px 0 0 var(--ink),
			0 3px 0 0 var(--ink),
			-3px 0 0 0 var(--ink),
			3px 0 0 0 var(--ink),
			6px 6px 0 0 var(--ink-decor);
	}

	.option:has(input:checked) .name::before {
		content: '▶ ';
	}

	.option:has(input:focus-visible) {
		outline: 2px dashed var(--ink);
		outline-offset: 6px;
	}
</style>
