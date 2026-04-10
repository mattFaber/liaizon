# Prompt Governance

This document defines how prompt assets are managed for message generation.

It applies to the system instruction in [SYSTEM_PROMPT.md](/Users/matt/Developer/liaizon/SYSTEM_PROMPT.md), company-level prompt templates stored in Firestore, and any logic that prepares model inputs.

## Goals

1. Keep generation behavior stable and auditable.
2. Make template changes intentional and reviewable.
3. Preserve traceability between generated outputs and the prompt assets that produced them.
4. Support recruiter style conditioning without weakening safety or consistency.

## Prompt Layers

The application uses three prompt layers.

1. System instruction
   Source: [SYSTEM_PROMPT.md](/Users/matt/Developer/liaizon/SYSTEM_PROMPT.md)
   Purpose: defines global safety, tone, output contract, and stage behavior.

2. Company prompt template
   Source: Firestore `promptTemplates`
   Purpose: adds stage/channel-specific business guidance and approved editable fields.

3. Runtime input payload
   Source: application data
   Purpose: candidate context, job context, writing samples, recruiter preferences, and delivery constraints.

## Versioning Rules

1. The system instruction must have an explicit version identifier.
2. Prompt templates must use incrementing `promptVersion` values.
3. A generated message must persist both `systemPromptVersionUsed` and `templateVersionUsed`.
4. Deprecated templates remain queryable for audit history.
5. Do not silently swap prompt behavior in code without updating version references.

## Change Management

Use this process for prompt changes.

1. Update the source prompt asset.
2. Review the wording for safety, tone, and output compatibility.
3. Validate that output JSON shape is unchanged unless intentionally versioned.
4. Update the version identifier.
5. Roll out company template changes deliberately, not by in-place mutation without history.

## Writing Sample Governance

1. Writing samples are style references only.
2. Writing samples must never be treated as factual candidate or job input.
3. Prompt builders should pass only active samples.
4. Recruiter-specific active samples take precedence over company defaults.
5. Style imitation must avoid verbatim copying beyond the limits defined in [SYSTEM_PROMPT.md](/Users/matt/Developer/liaizon/SYSTEM_PROMPT.md).

## Output Contract Governance

Every generation response must conform to the JSON contract defined in [SYSTEM_PROMPT.md](/Users/matt/Developer/liaizon/SYSTEM_PROMPT.md), including:

1. `subject`
2. `message`
3. `rationale`
4. `style_alignment_notes`
5. `quality_checks`

Validation rules:

1. Reject or retry invalid JSON outputs.
2. Reject outputs missing required fields.
3. Do not persist generation output until the contract is validated.

## Allowed Runtime Inputs

The runtime generation layer may provide:

1. Candidate profile fields.
2. Job and application context.
3. Recruiting stage.
4. Delivery channel.
5. Recruiter name and company name.
6. Previous contact summary.
7. Constraints.
8. Writing samples.
9. Style strength.

The runtime layer must not add invented or hidden facts.

## Audit Requirements

For each generated message, store:

1. System prompt version.
2. Template version.
3. Model name.
4. Token usage if available.
5. Writing sample IDs used.
6. Generation timestamp.

## Operational Recommendations

1. Keep system prompt text in source control.
2. Keep template content in Firestore with version metadata.
3. Add tests for prompt assembly and output validation.
4. Review prompt changes alongside schema or model-behavior changes.
