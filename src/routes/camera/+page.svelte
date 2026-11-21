<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { setCapturedImage } from '$lib/receipt-store.svelte.js';

	let streaming = $state(false);
	let imageSrc = $state('');
	let sending = $state(false);
	let cameraError = $state(false);

	// svelte-ignore non_reactive_update
	let video: HTMLVideoElement;
	let videoStream: MediaStream | undefined;

	const stopStream = () => videoStream?.getTracks().forEach((track) => track.stop());

	const initCamera = () => {
		imageSrc = '';
		cameraError = false;
		navigator.mediaDevices
			.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
			.then((stream) => {
				video.srcObject = stream;
				video.play();
				videoStream = stream;
			})
			.catch((error) => {
				console.error('Error occured while initializing camera', error);
				cameraError = true;
			});
	};

	// Receipts are tall and narrow; 1024px left long receipts ~300px wide and unreadable.
	const MAX_DIMENSION = 1600;

	const toJpeg = (source: CanvasImageSource, width: number, height: number) => {
		const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(width * scale);
		canvas.height = Math.round(height * scale);
		canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
		return canvas.toDataURL('image/jpeg', 0.85);
	};

	const takePicture = () => {
		if (!streaming) return;
		imageSrc = toJpeg(video, video.videoWidth, video.videoHeight);
		streaming = false;
		stopStream();
	};

	const pickFile = async (event: Event) => {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const bitmap = await createImageBitmap(file);
		imageSrc = toJpeg(bitmap, bitmap.width, bitmap.height);
		bitmap.close();
		streaming = false;
		stopStream();
	};

	const handleProceed = () => {
		sending = true;
		setCapturedImage(imageSrc);
		setTimeout(() => goto(resolve('/loading')), 400);
	};

	onMount(initCamera);
	onDestroy(stopStream);
</script>

<svelte:head>
	<title>Snap receipt · Bayar Sendiri</title>
</svelte:head>

<div class="camera-app">
	<div class="viewfinder">
		{#if imageSrc}
			<img class:sending src={imageSrc} alt="Captured receipt" />
		{:else}
			<video
				oncanplay={() => (streaming = true)}
				bind:this={video}
				playsinline
				muted
				aria-label="Camera preview"
			></video>
			{#if streaming}
				<div class="corners" aria-hidden="true">
					<span></span><span></span><span></span><span></span>
				</div>
			{/if}
		{/if}
		<div class="lcd" aria-hidden="true"></div>
	</div>

	{#if !sending}
		<div class="dialog instruction" class:alert={cameraError} role="status">
			{#if cameraError}
				No camera found. Choose a photo of your receipt instead.
			{:else if imageSrc}
				Can you read the prices? Then let's split it up!
			{:else}
				Fit the whole receipt in the frame.
			{/if}
		</div>

		<div class="controls">
			{#if imageSrc}
				<div class="row">
					<button class="btn secondary" onclick={initCamera}>⟲ Retake</button>
					<button class="btn" onclick={handleProceed}>OK ▶</button>
				</div>
			{:else}
				<label class="link gallery">
					<input class="visually-hidden" type="file" accept="image/*" onchange={pickFile} />
					Choose photo
				</label>
				<button
					class="shutter"
					onclick={takePicture}
					disabled={!streaming}
					aria-label="Take a picture"
				>
					A
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.camera-app {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--ink);
	}

	.viewfinder {
		position: relative;
		flex: 1;
		overflow: hidden;
	}

	video,
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: grayscale(1) contrast(1.15);
	}

	/* Duotone the grayscale feed into the LCD shades while keeping it readable. */
	.lcd {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			repeating-linear-gradient(
				to bottom,
				transparent 0 2px,
				color-mix(in srgb, var(--tint-ink) 18%, transparent) 2px 3px
			),
			var(--tint);
		mix-blend-mode: multiply;
	}

	img {
		animation: flash 0.15s steps(3);
		transition: transform 0.4s steps(6);
	}

	img.sending {
		transform: translateY(-110%);
	}

	.corners span {
		position: absolute;
		width: var(--s5);
		height: var(--s5);
		border: var(--px) solid var(--tint);
		z-index: 1;
	}
	.corners span:nth-child(1) {
		top: 18%;
		left: 10%;
		border-right: 0;
		border-bottom: 0;
	}
	.corners span:nth-child(2) {
		top: 18%;
		right: 10%;
		border-left: 0;
		border-bottom: 0;
	}
	.corners span:nth-child(3) {
		bottom: 22%;
		left: 10%;
		border-right: 0;
		border-top: 0;
	}
	.corners span:nth-child(4) {
		bottom: 22%;
		right: 10%;
		border-left: 0;
		border-top: 0;
	}

	.instruction {
		position: absolute;
		top: var(--s3);
		left: var(--s3);
		right: var(--s3);
		font-size: var(--text-sm);
	}

	.controls {
		position: absolute;
		left: var(--s3);
		right: var(--s3);
		bottom: var(--s4);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--s3);
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s3);
		width: 100%;
	}

	.gallery {
		padding: var(--s1) var(--s2);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
	}

	.gallery:focus-within {
		outline: 2px dashed var(--paper);
		outline-offset: 4px;
	}

	/* Round button drawn as a stepped pixel circle. */
	.shutter {
		width: 80px;
		height: 80px;
		background: var(--paper);
		color: var(--ink);
		font-size: var(--text-lg);
		clip-path: polygon(
			30% 0,
			70% 0,
			70% 5%,
			85% 5%,
			85% 15%,
			95% 15%,
			95% 30%,
			100% 30%,
			100% 70%,
			95% 70%,
			95% 85%,
			85% 85%,
			85% 95%,
			70% 95%,
			70% 100%,
			30% 100%,
			30% 95%,
			15% 95%,
			15% 85%,
			5% 85%,
			5% 70%,
			0 70%,
			0 30%,
			5% 30%,
			5% 15%,
			15% 15%,
			15% 5%,
			30% 5%
		);
	}

	.shutter:active {
		transform: translateY(var(--px));
		background: var(--paper-raised);
	}

	.shutter:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	@keyframes flash {
		0% {
			filter: grayscale(1) brightness(10);
		}
		100% {
			filter: grayscale(1) contrast(1.15);
		}
	}
</style>
