# Development Conventions

This document defines engineering conventions for the recruiter messaging application.

It should be followed before and during implementation to keep the codebase predictable, testable, and safe to evolve.

## Core Principles

1. Keep server-only logic out of client code.
2. Prefer explicit data contracts over implicit behavior.
3. Validate on the server even if the client validates first.
4. Keep Firestore documents small and queryable.
5. Record prompt and data versions for anything that affects generation.
6. Optimize for operational clarity, not cleverness.

## Project Structure

Recommended folders:

```text
src/lib/components
src/lib/server
src/lib/validation
src/lib/types
src/lib/env
src/lib/logging
src/routes/auth
src/routes/recruiter
```

Rules:

1. `src/lib/server` is for server-only integrations such as Firebase Admin, Firestore repositories, Vertex AI, and Cloud Tasks helpers.
2. `src/lib/types` is for shared domain types and DTOs only.
3. `src/lib/validation` is for schemas, guards, and validation-specific helpers.
4. `src/lib/env` is for typed environment access.
5. `src/lib/logging` is for structured logging utilities.
6. `src/routes/recruiter` is the protected application surface.

## Naming Conventions

1. Components use PascalCase: `CandidateForm.svelte`.
2. Utilities use camelCase: `buildPromptPayload.ts`.
3. Types use PascalCase: `Candidate`, `GeneratedMessage`.
4. Server-only modules use `.server.ts` where appropriate.
5. Route directories use lowercase and hyphenation when needed.
6. Use descriptive IDs like `candidateId`, `applicationId`, `companyId`; never bare `id` in domain code.

## TypeScript Rules

1. Use explicit parameter and return types for non-trivial functions.
2. Avoid `any`.
3. Prefer named exports.
4. Use discriminated unions or enums for finite states.
5. Model nullable values deliberately.
6. Store Firestore timestamps as Firestore `Timestamp`, not strings.

## Server And Client Boundaries

1. Browser code must not import server-only modules.
2. Secrets and privileged SDKs stay in server modules only.
3. Generation, repository access, auth verification, and queue work run on the server.
4. UI components should receive already-shaped data rather than reaching into backend concerns directly.

## Validation Rules

1. Every Firestore write must pass server-side validation.
2. Client validation is for usability only.
3. Text size thresholds must be enforced before persistence.
4. Prompt input values must be validated before model calls.
5. Enum-like fields must be validated against known values.

## Error Handling

1. Use structured error classes for validation, auth, permissions, and external service failures.
2. Never silently catch and ignore errors.
3. Convert internal errors to safe user-facing errors at the route boundary.
4. Include enough context in logs to debug, but never log secrets.

## Logging

1. Use structured logs for server actions and background workers.
2. Log message generation attempts, latency, retries, and failures.
3. Log bulk job status transitions.
4. Keep log fields stable so dashboards and alerts remain useful.

## Testing Expectations

1. Unit test repositories, prompt builders, validation logic, and chunking behavior.
2. Component test recruiter forms, result views, and loading/error states.
3. Integration test authenticated server actions and tenant scoping.
4. End-to-end test sign-in, CRUD, message generation, history, and bulk job progress.

Recommended command usage:

1. `npm run check`
2. `npm run lint`
3. `npm run test:unit -- --run`
4. `npm run test:e2e`

## Prompt And Generation Conventions

1. Treat [SYSTEM_PROMPT.md](/Users/matt/Developer/liaizon/SYSTEM_PROMPT.md) as the canonical model instruction.
2. Store stage/channel template versions in Firestore.
3. Persist the exact prompt/template version used for each generated message.
4. Writing samples influence style only, never facts.
5. Generated model output must be validated before persistence.

## Firestore Conventions

1. Use company-scoped collection paths.
2. Avoid indexing large freeform text.
3. Use subcollections for large text chunks and version history.
4. Keep denormalized display fields on message and job-status records when it reduces read amplification.
5. Prefer append-only audit history for important generation and content events.

## Delivery Conventions

1. Keep implementation phases aligned with [PLAN.md](/Users/matt/Developer/liaizon/PLAN.md).
2. Do not add new architectural patterns without updating the plan and relevant spec docs first.
3. Prefer small, contract-aligned changes over broad speculative scaffolding.
