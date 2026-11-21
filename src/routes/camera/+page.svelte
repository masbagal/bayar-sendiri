<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { setCapturedImage } from '$lib/receipt-store.svelte.js';

	let streaming = $state(false);
	let imageSrc = $state('');
	let sending = $state(false);

	// svelte-ignore non_reactive_update
	let video: HTMLVideoElement;
	let canvas: HTMLCanvasElement;
	let videoStream: MediaStream;

	const initCamera = () => {
		imageSrc = '';
		navigator.mediaDevices
			.getUserMedia({
				video: { facingMode: 'environment' },
				audio: false
			})
			.then((stream) => {
				video.srcObject = stream;
				video.play();
				videoStream = stream;
			})
			.catch((error) => console.error('Error occured while initializing camera', error));
	};

	const handleVideoCanPlay = () => {
		if (!streaming) {
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			streaming = true;
		}
	};

	// Receipts are tall and narrow; 1024px left long receipts ~300px wide and unreadable.
	const MAX_DIMENSION = 1600;

	const takePicture = () => {
		const context = canvas.getContext('2d');
		if (context && streaming) {
			context.drawImage(video, 0, 0, canvas.width, canvas.height);

			// Resize for API: scale down to MAX_DIMENSION on the longest side
			const scale = Math.min(1, MAX_DIMENSION / Math.max(canvas.width, canvas.height));
			const outW = Math.round(canvas.width * scale);
			const outH = Math.round(canvas.height * scale);
			const offscreen = document.createElement('canvas');
			offscreen.width = outW;
			offscreen.height = outH;
			offscreen.getContext('2d')!.drawImage(canvas, 0, 0, outW, outH);

			const data = offscreen.toDataURL('image/jpeg', 0.85);
			imageSrc = data;
			streaming = false;
			videoStream.getTracks().forEach((track) => track.stop());
		}
	};

	const handleProceed = () => {
		sending = true;
		setCapturedImage(imageSrc);
		setTimeout(() => goto(resolve('/loading')), 400);
	};

	onMount(initCamera);
	onDestroy(() => videoStream?.getTracks().forEach((track) => track.stop()));
</script>

<div class="camera-app">
	{#if !sending}
		<div class="instruction">
			{#if imageSrc}
				Looking good? Let's split it up!
			{:else}
				Snap your receipt to split the bill
			{/if}
		</div>
	{/if}

	{#if imageSrc}
		<!-- svelte-ignore a11y_img_redundant_alt -->
		<img class:sending src={imageSrc} alt="captured image from camera" />
	{:else}
		<video oncanplay={handleVideoCanPlay} bind:this={video} playsinline
			>Video stream not available</video
		>
	{/if}
	<canvas bind:this={canvas} hidden></canvas>

	{#if !sending}
		<div class="controls">
			{#if imageSrc}
				<button onclick={initCamera} class="secondary">Retake ⟲</button>
				<button onclick={handleProceed}>Proceed →</button>
			{:else}
				<button class="shutter" onclick={takePicture} aria-label="Take a picture"></button>
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
	}

	video,
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		flex: 1;
	}

	img {
		animation: flash 0.1s linear normal;
		transition: transform 0.5s ease-in;
	}

	img.sending {
		transform: translateY(-200%);
		transform-origin: center;
	}

	.controls {
		position: absolute;
		bottom: 1rem;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		flex-direction: column;
		gap: 1rem;
		isolation: isolate;
	}

	.shutter {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		border: 4px solid white;
		outline: none;
		cursor: pointer;
	}

	.shutter:before {
		display: none;
	}

	.shutter:active {
		transform: scale(0.8);
	}

	.instruction {
		position: absolute;
		top: 2rem;
		left: 50%;
		transform: translateX(-50%);
		text-align: center;
		background: var(--color-bg-1);
		padding: 0.5rem 1rem;
		border: var(--color-text) 5px solid;
	}

	@keyframes flash {
		0% {
			filter: brightness(10);
		}

		100% {
			filter: brightness(1);
		}
	}
</style>
