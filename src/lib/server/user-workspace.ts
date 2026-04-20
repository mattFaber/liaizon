import { serverEnv } from '$lib/env/server';
import { firestoreRepository } from '$server/firestore';
import type { Company, User } from '$lib/types';
import type { SessionUser } from '$server/auth';

/**
 * Builds a deterministic personal company ID from a user's UID.
 * Format: "personal__{uid}"
 */
export function buildPersonalCompanyId(uid: string): string {
	return `personal__${uid}`;
}

/**
 * Builds a human-readable workspace name from an email.
 * Example: "personal@example.com" → "Personal Workspace (personal@example.com)"
 */
export function buildPersonalWorkspaceName(email: string | null): string {
	if (!email) {
		return 'Personal Workspace';
	}
	return `Personal Workspace (${email})`;
}

/**
 * Provisions a new user workspace on first login, or returns the existing company ID if already set.
 * This ensures every user gets an isolated personal workspace instead of a shared demo tenant.
 */
export async function provisionUserWorkspace(sessionUser: SessionUser): Promise<string> {
	const personalCompanyId = buildPersonalCompanyId(sessionUser.uid);

	// Check if this company already exists for this user
	const existingCompany = await firestoreRepository.getCompany(personalCompanyId);

	if (existingCompany) {
		// Company already exists, reuse it
		return personalCompanyId;
	}

	// Create new personal company
	const newCompany: Company = {
		companyId: personalCompanyId,
		name: buildPersonalWorkspaceName(sessionUser.email),
		plan: 'free',
		defaultLanguage: 'en',
		defaultStyleStrength: serverEnv.defaultStyleStrength,
		monthlyGenerationQuota: 10_000,
		settings: {},
		createdBy: sessionUser.uid,
		createdAt: new Date(),
		isActive: true
	};

	await firestoreRepository.upsertCompany(newCompany);

	// Create user record in the new company
	const newUser: User = {
		userId: sessionUser.uid,
		companyId: personalCompanyId,
		email: sessionUser.email ?? '',
		displayName: sessionUser.email?.split('@')[0] ?? 'User',
		role: 'admin',
		preferences: {},
		lastLoginAt: new Date(),
		createdAt: new Date(),
		isActive: true
	};

	await firestoreRepository.upsertUser(newUser);

	return personalCompanyId;
}
