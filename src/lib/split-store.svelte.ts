import { SvelteMap } from 'svelte/reactivity';
import type { User, ItemAssignments, UserTotal, UserItemShare, UserBreakdown, ReceiptData } from './types.js';

// ─── State ───
let users = $state<User[]>([]);
let selectedUserId = $state<string | null>(null);
let assignments = $state<ItemAssignments>({});

// ─── Users ───
export function getUsers(): User[] {
	return users;
}

export function addUser(fullName: string): User | null {
	const duplicate = users.some((u) => u.fullName.toLowerCase() === fullName.toLowerCase());
	if (duplicate) return null;

	const user: User = { id: crypto.randomUUID(), fullName };
	users.push(user);

	if (users.length === 1) selectedUserId = user.id;
	return user;
}

export function removeUser(userId: string): void {
	users = users.filter((u) => u.id !== userId);

	for (const itemId in assignments) {
		assignments[itemId] = assignments[itemId].filter((id) => id !== userId);
	}

	if (selectedUserId === userId) {
		selectedUserId = users.length > 0 ? users[0].id : null;
	}
}

// ─── Selection ───
export function getSelectedUserId(): string | null {
	return selectedUserId;
}

export function setSelectedUserId(userId: string | null): void {
	selectedUserId = userId;
}

// ─── Assignments ───
export function getAssignedUsers(itemId: string): string[] {
	return assignments[itemId] ?? [];
}

export function toggleAssignment(itemId: string, userId: string): void {
	if (!assignments[itemId]) {
		assignments[itemId] = [userId];
		return;
	}

	const index = assignments[itemId].indexOf(userId);
	if (index === -1) {
		assignments[itemId].push(userId);
	} else {
		assignments[itemId].splice(index, 1);
	}
}

export function isAssigned(itemId: string, userId: string): boolean {
	return (assignments[itemId] ?? []).includes(userId);
}

// ─── Per-User Totals ───
export function calculateUserTotals(receiptData: ReceiptData): UserTotal[] {
	const totalsMap = new SvelteMap<string, number>();

	for (const user of users) {
		totalsMap.set(user.id, 0);
	}

	for (const item of receiptData.items) {
		const assignedUserIds = assignments[item.id] ?? [];
		if (assignedUserIds.length === 0) continue;

		const itemTotal = item.unitPrice * item.quantity;
		const perUserShare = itemTotal / assignedUserIds.length;

		for (const uid of assignedUserIds) {
			totalsMap.set(uid, (totalsMap.get(uid) ?? 0) + perUserShare);
		}
	}

	const totalFees = receiptData.fees.reduce((sum, f) => sum + f.amount, 0);
	const totalDiscounts = receiptData.discounts.reduce((sum, d) => sum + d.amount, 0);
	const subtotal = receiptData.subtotal;

	return users.map((user) => {
		const itemsSubtotal = totalsMap.get(user.id) ?? 0;
		const proportion = subtotal > 0 ? itemsSubtotal / subtotal : 0;
		const feeShare = totalFees * proportion;
		const discountShare = totalDiscounts * proportion;

		return {
			userId: user.id,
			fullName: user.fullName,
			itemsSubtotal,
			feeShare,
			discountShare,
			total: itemsSubtotal + feeShare - discountShare
		};
	});
}

// ─── Per-User Breakdown ───
export function calculateUserBreakdown(receiptData: ReceiptData): UserBreakdown[] {
	const totalFees = receiptData.fees.reduce((sum, f) => sum + f.amount, 0);
	const totalDiscounts = receiptData.discounts.reduce((sum, d) => sum + d.amount, 0);
	const subtotal = receiptData.subtotal;

	return users.map((user) => {
		const items: UserItemShare[] = [];
		let itemsSubtotal = 0;

		for (const item of receiptData.items) {
			const assignedUserIds = assignments[item.id] ?? [];
			if (!assignedUserIds.includes(user.id)) continue;

			const itemTotal = item.unitPrice * item.quantity;
			const userShare = itemTotal / assignedUserIds.length;
			itemsSubtotal += userShare;

			items.push({
				itemId: item.id,
				itemName: item.name,
				itemTotal,
				sharedBy: assignedUserIds.length,
				userShare
			});
		}

		const proportion = subtotal > 0 ? itemsSubtotal / subtotal : 0;
		const feeShare = totalFees * proportion;
		const discountShare = totalDiscounts * proportion;

		return {
			userId: user.id,
			fullName: user.fullName,
			items,
			itemsSubtotal,
			feeShare,
			discountShare,
			total: itemsSubtotal + feeShare - discountShare
		};
	});
}

// ─── Reset ───
export function resetSplit(): void {
	users = [];
	selectedUserId = null;
	assignments = {};
}
