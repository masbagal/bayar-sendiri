/** Integer amount in the receipt's minor unit (cents for USD, rupiah for IDR). */
export type Minor = number;

export interface MenuItem {
	id: string;
	name: string;
	quantity: number;
	/** Amount printed on the receipt line, i.e. quantity × unit price. */
	lineTotal: Minor;
}

export interface Charge {
	id: string;
	label: string;
	/** Fees may be negative (e.g. "pembulatan" rounding). Discounts are positive and get subtracted. */
	amount: Minor;
}

export interface Reconciliation {
	itemsTotal: Minor;
	computedTotal: Minor;
	/** printedSubtotal − itemsTotal, null when the receipt prints no subtotal. */
	subtotalGap: Minor | null;
	/** printedTotal − computedTotal. Zero means the extraction adds up. */
	totalGap: Minor;
}

export interface ReceiptData {
	currency: string;
	/** Digits after the decimal point; amounts are stored × 10^decimals. */
	decimals: number;
	items: MenuItem[];
	fees: Charge[];
	discounts: Charge[];
	printedSubtotal: Minor | null;
	printedTotal: Minor;
	reconciliation: Reconciliation;
}

export interface User {
	id: string;
	fullName: string;
}

/** Map from item ID to array of user IDs assigned to that item */
export type ItemAssignments = Record<string, string[]>;

export interface UserItemShare {
	itemId: string;
	itemName: string;
	lineTotal: Minor;
	sharedBy: number;
	userShare: Minor;
}

export interface UserBreakdown {
	userId: string;
	fullName: string;
	items: UserItemShare[];
	itemsSubtotal: Minor;
	feeShare: Minor;
	discountShare: Minor;
	total: Minor;
}
