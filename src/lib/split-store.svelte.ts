import { splitBill } from './bill.js';
import type { User, ItemAssignments, UserBreakdown, ReceiptData } from './types.js';

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

// ─── Breakdown ───
export function calculateUserBreakdown(receiptData: ReceiptData): UserBreakdown[] {
	return splitBill(receiptData, users, assignments);
}

// ─── Reset ───
export function resetSplit(): void {
	users = [];
	selectedUserId = null;
	assignments = {};
}
