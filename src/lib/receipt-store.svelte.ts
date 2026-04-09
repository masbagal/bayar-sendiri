import type { ReceiptData } from './types.js';

let capturedImage = $state<string>('');
let receiptData = $state<ReceiptData | null>(null);

export function setCapturedImage(base64: string) {
	capturedImage = base64;
}

export function getCapturedImage(): string {
	return capturedImage;
}

export function setReceiptData(data: ReceiptData) {
	receiptData = data;
}

export function getReceiptData(): ReceiptData | null {
	return receiptData;
}
