/**
 * Plan configuration
 * Defines the available subscription plans and their limits
 */

export type PlanId = 'free' | 'pro' | 'enterprise';

export interface Plan {
	id: PlanId;
	name: string;
	displayName: string;
	description: string;
	priceMonthly: number; // in cents
	priceYearly: number; // in cents
	imagesPerMonth: number; // -1 for unlimited
	maxImageSizeMb: number;
	priorityProcessing: boolean;
	apiAccess: boolean;
	retentionDays: number;
}

export const PLANS: Record<PlanId, Plan> = {
	free: {
		id: 'free',
		name: 'free',
		displayName: 'Free',
		description: 'Perfect for trying out the service',
		priceMonthly: 0,
		priceYearly: 0,
		imagesPerMonth: 10,
		maxImageSizeMb: 5,
		priorityProcessing: false,
		apiAccess: true,
		retentionDays: 7
	},
	pro: {
		id: 'pro',
		name: 'pro',
		displayName: 'Pro',
		description: 'For individuals and small teams',
		priceMonthly: 999, // $9.99
		priceYearly: 9990, // $99.90 (2 months free)
		imagesPerMonth: 500,
		maxImageSizeMb: 20,
		priorityProcessing: true,
		apiAccess: true,
		retentionDays: 90
	},
	enterprise: {
		id: 'enterprise',
		name: 'enterprise',
		displayName: 'Enterprise',
		description: 'For large teams with advanced needs',
		priceMonthly: 4999, // $49.99
		priceYearly: 49990, // $499.90 (2 months free)
		imagesPerMonth: -1, // unlimited
		maxImageSizeMb: 50,
		priorityProcessing: true,
		apiAccess: true,
		retentionDays: 365
	}
};

export const PLAN_LIST = Object.values(PLANS);

export function getPlan(planId: PlanId | string | null | undefined): Plan {
	if (planId && planId in PLANS) {
		return PLANS[planId as PlanId];
	}
	return PLANS.free;
}
