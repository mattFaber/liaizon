import { runtimeConfig } from '$server/config';
import { ExternalServiceError, ValidationError } from '$validation/errors';
import { logError } from '$lib/logging';
import { VertexAI } from '@google-cloud/vertexai';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

const responseSchema = z.object({
	subject: z.string(),
	message: z.string(),
	rationale: z.array(z.string()),
	style_alignment_notes: z.array(z.string()),
	quality_checks: z.object({
		factually_grounded: z.boolean(),
		stage_aligned: z.boolean(),
		clear_cta: z.boolean(),
		within_length_limit: z.boolean(),
		style_aligned_to_samples: z.boolean(),
		professional_tone: z.boolean()
	})
});

export interface GenerateRecruiterMessageInput {
	channel: 'email' | 'linkedin' | 'sms';
	stage:
		| 'initial_outreach'
		| 'follow_up'
		| 'interview_invite'
		| 'interview_follow_up'
		| 'offer_stage'
		| 'rejection';
	recruiterName: string;
	companyName: string;
	roleTitle: string;
	keyRoleValueProp: string;
	candidateName: string;
	candidateHighlights: string[];
	previousContactSummary?: string;
	ctaType: 'reply' | 'schedule' | 'confirm_interest';
	constraints?: string[];
	writingSamples?: string[];
	styleStrength?: 'low' | 'medium' | 'high';
	templateGuidance?: string;
}

export interface GenerateRecruiterMessageResult {
	subject: string;
	message: string;
	rationale: string[];
	styleAlignmentNotes: string[];
	qualityChecks: {
		factuallyGrounded: boolean;
		stageAligned: boolean;
		clearCta: boolean;
		withinLengthLimit: boolean;
		styleAlignedToSamples: boolean;
		professionalTone: boolean;
	};
	rawText: string;
	model: string;
	tokens: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
}

let systemPromptCache: string | null = null;

function loadSystemPrompt(): string {
	if (systemPromptCache) {
		return systemPromptCache;
	}

	const promptPath = path.resolve(process.cwd(), 'SYSTEM_PROMPT.md');
	if (!fs.existsSync(promptPath)) {
		throw new ValidationError('SYSTEM_PROMPT.md was not found at repository root.');
	}

	systemPromptCache = fs.readFileSync(promptPath, 'utf-8');
	return systemPromptCache;
}

function buildUserPrompt(input: GenerateRecruiterMessageInput): string {
	return [
		`Generate one ${input.channel} message for stage ${input.stage}.`,
		'',
		'Context:',
		`- Recruiter: ${input.recruiterName}`,
		`- Company: ${input.companyName}`,
		`- Role: ${input.roleTitle}`,
		`- Candidate: ${input.candidateName}`,
		`- Candidate highlights: ${input.candidateHighlights.join('; ')}`,
		`- Value proposition: ${input.keyRoleValueProp}`,
		`- Previous contact: ${input.previousContactSummary ?? ''}`,
		`- CTA type: ${input.ctaType}`,
		`- Constraints: ${(input.constraints ?? []).join('; ')}`,
		`- Writing samples: ${(input.writingSamples ?? []).join('\n---\n')}`,
		`- Style strength: ${input.styleStrength ?? runtimeConfig.app.defaultStyleStrength}`,
		`- Template guidance: ${input.templateGuidance ?? ''}`,
		'',
		'Follow the system instruction exactly and return valid JSON only.'
	].join('\n');
}

function extractJsonPayload(raw: string): unknown {
	const trimmed = raw.trim();

	const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fencedMatch?.[1]) {
		return JSON.parse(fencedMatch[1].trim());
	}

	const first = trimmed.indexOf('{');
	const last = trimmed.lastIndexOf('}');
	if (first >= 0 && last > first) {
		return JSON.parse(trimmed.slice(first, last + 1));
	}

	return JSON.parse(trimmed);
}

function getResponseText(
	response: Awaited<ReturnType<ReturnType<VertexAI['getGenerativeModel']>['generateContent']>>
): string {
	const candidate = response.response.candidates?.[0];
	const parts = candidate?.content?.parts;
	const textPart = parts?.find((part) => typeof part.text === 'string');

	if (!textPart?.text) {
		throw new ExternalServiceError('Model response did not include text output.', 'vertex-ai');
	}

	return textPart.text;
}

function getTokenUsage(
	response: Awaited<ReturnType<ReturnType<VertexAI['getGenerativeModel']>['generateContent']>>
): { inputTokens: number; outputTokens: number; totalTokens: number } {
	const usage = response.response.usageMetadata;
	const inputTokens = Math.max(0, usage?.promptTokenCount ?? 0);
	const outputTokens = Math.max(0, usage?.candidatesTokenCount ?? 0);
	const totalTokens = Math.max(0, usage?.totalTokenCount ?? inputTokens + outputTokens);

	return {
		inputTokens,
		outputTokens,
		totalTokens
	};
}

export async function generateRecruiterMessage(
	input: GenerateRecruiterMessageInput
): Promise<GenerateRecruiterMessageResult> {
	const systemPrompt = loadSystemPrompt();
	const userPrompt = buildUserPrompt(input);

	const vertex = new VertexAI({
		project: runtimeConfig.gcp.projectId,
		location: runtimeConfig.gcp.vertexLocation
	});

	const model = vertex.getGenerativeModel({
		model: runtimeConfig.gcp.vertexModel,
		systemInstruction: {
			role: 'system',
			parts: [{ text: systemPrompt }]
		}
	});

	let rawText: string;
	let tokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

	try {
		const response = await model.generateContent({
			contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
			generationConfig: {
				temperature: 0.4,
				maxOutputTokens: 1024,
				responseMimeType: 'application/json'
			}
		});

		rawText = getResponseText(response);
		tokenUsage = getTokenUsage(response);
	} catch (error) {
		logError('Vertex AI message generation failed.', error, {
			model: runtimeConfig.gcp.vertexModel,
			stage: input.stage,
			channel: input.channel
		});
		throw new ExternalServiceError('Vertex AI generation failed.', 'vertex-ai');
	}

	let parsedPayload: z.infer<typeof responseSchema>;

	try {
		parsedPayload = responseSchema.parse(extractJsonPayload(rawText));
	} catch (error) {
		logError('Failed to parse Vertex AI JSON output.', error, { rawText });
		throw new ExternalServiceError('Model returned an invalid JSON payload.', 'vertex-ai');
	}

	return {
		subject: parsedPayload.subject,
		message: parsedPayload.message,
		rationale: parsedPayload.rationale,
		styleAlignmentNotes: parsedPayload.style_alignment_notes,
		qualityChecks: {
			factuallyGrounded: parsedPayload.quality_checks.factually_grounded,
			stageAligned: parsedPayload.quality_checks.stage_aligned,
			clearCta: parsedPayload.quality_checks.clear_cta,
			withinLengthLimit: parsedPayload.quality_checks.within_length_limit,
			styleAlignedToSamples: parsedPayload.quality_checks.style_aligned_to_samples,
			professionalTone: parsedPayload.quality_checks.professional_tone
		},
		rawText,
		model: runtimeConfig.gcp.vertexModel,
		tokens: tokenUsage
	};
}
