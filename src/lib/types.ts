export interface MenuItem {
	id: string;
	name: string;
	unitPrice: number;
	quantity: number;
}

export interface Fee {
	label: string;
	amount: number;
}

export interface Discount {
	label: string;
	amount: number;
}

export interface ReceiptData {
	currency: string;
	items: MenuItem[];
	subtotal: number;
	fees: Fee[];
	discounts: Discount[];
	grandTotal: number;
}

export interface User {
	id: string;
	fullName: string;
}

/** Map from item ID to array of user IDs assigned to that item */
export type ItemAssignments = Record<string, string[]>;

export interface UserTotal {
	userId: string;
	fullName: string;
	itemsSubtotal: number;
	feeShare: number;
	discountShare: number;
	total: number;
}

export interface UserItemShare {
	itemId: string;
	itemName: string;
	itemTotal: number;
	sharedBy: number;
	userShare: number;
}

export interface UserBreakdown {
	userId: string;
	fullName: string;
	items: UserItemShare[];
	itemsSubtotal: number;
	feeShare: number;
	discountShare: number;
	total: number;
}
