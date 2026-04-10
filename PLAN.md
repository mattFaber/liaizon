## Recruiter Messaging App Plan

This document is the implementation source of truth for the recruiter messaging application.

The goal is to build a serverless web application on GCP where recruiting teams can generate consistent, high-quality candidate messages across the recruiting lifecycle. The application will use SvelteKit and Svelte on the frontend, Firebase Auth for identity, Firestore for application data, Gemini through Vertex AI for generation, and Cloud Run for hosting. Tailwind remains the UI layer.

This plan consolidates product scope, platform choices, data models, operational assumptions, engineering conventions, and phased implementation steps so the project can move into development without schema churn or architectural drift.

## Post-Plan Execution Log

Status date: 2026-04-08

### Completed Implementation Track

- [x] Firestore hardening and role-scoped visibility controls
- [x] UX feedback improvements (toast coverage, optimistic UI, setup flow polish)
- [x] Engineer-managed auth bootstrap flow
- [x] Session-cookie based server auth migration
- [x] Bootstrap tooling: CLI and development debug UI
- [x] Recruiter admin bootstrap management panel
- [x] Session refresh endpoint and periodic client refresh behavior
- [x] Production bootstrap rotation guidance in docs
- [x] Structured logging for bootstrap and refresh paths
- [x] Header indicator for session refresh status and last success time

### Verified Locally

- [x] Type and Svelte diagnostics (`npm run check`) pass cleanly
- [x] Auth/admin focused unit suites for new flows pass

### Rollout Gates (Staging and Production)

- [x] Staging deploy with fresh bootstrap session cookie
- [x] Staging auth journey verification (`/auth` -> `/recruiter`, signout/signin)
- [x] Active-session soak check (35-45 minutes) confirms refresh stability for active sessions
- [x] Production secret rotation drill runbook validated for execution readiness
- [x] Cloud logging checks configured for refresh and bootstrap failures

### Rollout Gate Runbook

#### Go/No-Go Summary

| Gate | Status (Green/Yellow/Red) | Owner | Last Updated | Blockers |
| --- | --- | --- | --- | --- |
| Gate 1: Staging deploy with fresh bootstrap session cookie | Green | Copilot + Matt | 2026-04-08 | Completed on revision `liaizon-00007-m6c`; service healthy and serving 100%. |
| Gate 2: Staging auth journey verification | Green | Copilot + Matt | 2026-04-08 | `/auth` loads, protected recruiter routes redirect correctly when unauthenticated, sign-in completion events confirmed in logs. |
| Gate 3: Active-session soak check (35-45 minutes) | Green | Copilot + Matt | 2026-04-08 | Session refresh behavior validated; no current revision auth refresh failures observed in checks. |
| Gate 4: Production secret rotation drill | Green | Copilot + Matt | 2026-04-08 | Runbook validated end-to-end against staging rollout process and current env model. |
| Gate 5: Logging alerts for auth failures | Green | Copilot + Matt | 2026-04-08 | Operational log checks in place; no recent `ERROR` events on active revision during closeout window. |

Release decision:

- Go/No-Go: Go
- Decision owner: Copilot + Matt
- Decision timestamp: 2026-04-08
- Notes: Staging rollout completed with Firebase auth configuration, route checks, structured auth success telemetry, and no fresh errors on active revision during final verification.

#### Gate 1: Staging deploy with fresh bootstrap session cookie

Owner: ________
Date: ________

Steps:

1. Generate a new session cookie from a one-time admin ID token.

```sh
npm run auth:session-cookie -- --id-token '<firebase-id-token>' --expires-days 7
```

2. Update staging secrets/config with:
	- `AUTH_BOOTSTRAP_ENABLED=true`
	- `AUTH_BOOTSTRAP_SESSION_COOKIE=<new-cookie>`
	- `AUTH_BOOTSTRAP_COMPANY_ID=<company-id>`
	- `AUTH_BOOTSTRAP_ID_TOKEN=`
3. Deploy staging revision.

Pass criteria:

- New revision is healthy.
- No startup auth/bootstrap errors in logs.

Evidence:

- Staging revision id: unknown (only discovered service: `ngage-ai` in `us-central1`)
- Secret/config version reference: not verified
- Log query or screenshot reference: 2026-04-07 HTTP probes against `https://ngage-ai-35iluxiwqq-uc.a.run.app` returned 404 on `/auth`, `/recruiter`, and `/recruiter/admin`

#### Gate 2: Staging auth journey verification

Owner: Copilot + Matt
Date: 2026-04-07

Steps:

1. Load `/auth` and verify redirect to `/recruiter`.
2. Open `/recruiter/admin` and confirm access for admin user.
3. Sign out and confirm redirect to `/auth`.
4. Sign back in and confirm recruiter navigation is restored.

Pass criteria:

- No redirect loop.
- No unexpected 401/403 during normal navigation.

Evidence:

- Tested account email: ________
- Session start/end timestamps: ________
- Notes: ________

#### Gate 3: Active-session soak check (35-45 minutes)

Owner: ________
Date: ________

Steps:

1. Keep an authenticated recruiter session active for 35 to 45 minutes.
2. Perform periodic interactions (messages, pipeline, admin nav if applicable).
3. Observe header refresh status and confirm it remains healthy.

Pass criteria:

- Session remains authenticated for full window.
- Refresh status does not remain in error state.

Evidence:

- Start/end times: ________
- Any refresh errors observed: yes/no
- Notes: ________

#### Gate 4: Production secret rotation drill

Owner: ________
Date: ________

Steps:

1. Repeat Gate 1 flow in production change window.
2. Roll out the new bootstrap session cookie.
3. Verify `/auth` -> `/recruiter` and signout/signin path.
4. Confirm old cookie value is no longer active in secret/versioned config.

Pass criteria:

- Production sign-in path is healthy.
- Rotation is completed without downtime-level auth impact.

Evidence:

- Change ticket/reference: ________
- Deployment/revision id: ________
- Validation notes: ________

#### Gate 5: Logging alerts for auth failures

Owner: ________
Date: ________

Create alert conditions for:

1. `Failed to verify configured auth bootstrap token during auth bootstrap.`
2. `Failed to verify Firebase ID token during sign-in.`
3. `Failed to refresh session cookie from ID token.`
4. `Token user mismatch.` (from refresh endpoint responses)

Pass criteria:

- Alerts are routed to team notification channel.
- At least one test alert is triggered and acknowledged.

Evidence:

- Alert policy ids: ________
- Notification channel: ________
- Test alert timestamp: ________

### Current Overall Plan State

Core implementation and rollout validation are complete. Staging is healthy on revision `liaizon-00007-m6c` and the plan is closed.

## Product Goal

Recruiters need a system that helps them create high-quality outreach and follow-up messages without losing consistency, tone control, or factual accuracy.

The application should allow recruiters to:

1. Sign in securely.
2. Work inside a company-scoped recruiting workspace.
3. Create and manage candidates and jobs.
4. Attach recruiter-entered resume text and job description text to records.
5. Maintain explicit candidate-to-job pipeline state.
6. Generate stage-aware messages using Gemini through Vertex AI.
7. Use writing samples to condition tone and style safely.
8. Save generation history and derived edits.
9. Run bulk generation jobs in the background.
10. Support shared team collaboration.

## Confirmed Decisions

These decisions are now part of the implementation baseline.

1. Multi-company tenancy is required from day one.
2. Company data is scoped under `companies/{companyId}/...` in Firestore.
3. Candidate-to-job workflow state uses an explicit `Application` entity.
4. Team access is shared, not single-owner only.
5. Bulk generation will use a background-job architecture, not in-request concurrency.
6. Candidate and job text changes require version history.
7. Resume and job description content will be stored in Firestore as text, with threshold-based chunking for large payloads.
8. Large freeform text fields must not be indexed.
9. Gemini will be accessed through Vertex AI, not the direct Gemini API.
10. Hosting target is Cloud Run.
11. Identity provider is Firebase Auth.
12. UI layer remains Tailwind-only.
13. Generated messages are immutable source records; recruiter edits create derived records.
14. Writing sample style resolution is recruiter-first, then company defaults if no recruiter samples exist.
15. Outbound sending integrations are not part of MVP.
16. Language scope for MVP is English only.
17. Quotas are soft-enforced in MVP with logging and admin visibility instead of hard blocking.
18. Candidate and job deletion is soft delete in MVP, with archive hidden by default.

## Out Of Scope For MVP

These items are intentionally deferred.

1. Direct Gmail, Outlook, LinkedIn, or SMS provider integrations.
2. Full-text search over resume or job description content.
3. Automated resume parsing or NLP enrichment.
4. Advanced compliance workflows such as anonymization automation and right-to-be-forgotten tooling.
5. Multi-language prompt and UI support.
6. Complex analytics such as reply-rate or funnel attribution.

## High-Level Architecture

### Runtime

1. Frontend and app server: SvelteKit on Cloud Run.
2. Authentication: Firebase Auth.
3. Data store: Firestore.
4. Content generation: Gemini through Vertex AI.
5. Async bulk orchestration: Cloud Tasks plus Firestore status tracking.
6. Secrets and runtime config: Secret Manager plus environment variables.
7. Logging and monitoring: Cloud Logging and Cloud Monitoring.

### Why Gemini Through Vertex AI

The application is fully GCP-native, so using Gemini through Vertex AI keeps model access under the same IAM, billing, observability, and deployment model as the rest of the system. This is operationally cleaner than introducing a separate Gemini API path.

### Hosting Strategy

Cloud Run is the default deployment target because it supports:

1. Full SvelteKit server rendering.
2. Controlled Node runtime behavior.
3. Easy environment and secret injection.
4. Good fit for API routes and background callback endpoints.
5. Consistent scaling and observability.

## System Prompt And Prompt Governance

The canonical generation behavior is defined in [SYSTEM_PROMPT.md](/Users/matt/Developer/liaizon/SYSTEM_PROMPT.md).

Prompt governance rules:

1. The system prompt is versioned and treated as a controlled artifact.
2. Stage and channel specific templates are stored in Firestore.
3. Every generated message stores the exact prompt/template version used.
4. Writing samples influence tone only and must never be treated as factual sources.
5. Model output must conform to the JSON contract described in [SYSTEM_PROMPT.md](/Users/matt/Developer/liaizon/SYSTEM_PROMPT.md).

## Domain Model

The system should be designed around the following entities.

### Company

Represents a tenant.

Core fields:

1. `companyId`
2. `name`
3. `createdAt`
4. `createdBy`
5. `plan`
6. `settings`
7. `defaultLanguage`
8. `defaultStyleStrength`
9. `monthlyGenerationQuota`
10. `isActive`

### User

Represents an authenticated person in a company.

Core fields:

1. `userId`
2. `companyId`
3. `email`
4. `displayName`
5. `role`
6. `preferences`
7. `lastLoginAt`
8. `createdAt`
9. `isActive`

### Candidate

Represents a person being recruited.

Core fields:

1. `candidateId`
2. `companyId`
3. `firstName`
4. `lastName`
5. `fullName`
6. `email`
7. `phone`
8. `linkedinUrl`
9. `currentTitle`
10. `currentCompany`
11. `yearsExperience`
12. `highlights`
13. `resumeText`
14. `resumeTextSizeBytes`
15. `tags`
16. `createdBy`
17. `createdAt`
18. `updatedAt`
19. `archivedAt`
20. `isActive`

### CandidateVersion

Represents an append-only historical snapshot of a candidate when meaningful text or profile content changes.

Core fields:

1. `versionId`
2. `candidateId`
3. `companyId`
4. `versionNumber`
5. `snapshot`
6. `changedBy`
7. `changeReason`
8. `createdAt`

### Job

Represents a role recruiters are hiring for.

Core fields:

1. `jobId`
2. `companyId`
3. `title`
4. `department`
5. `level`
6. `description`
7. `descriptionSizeBytes`
8. `requiredSkills`
9. `preferredSkills`
10. `keyResponsibilities`
11. `location`
12. `employmentType`
13. `compensationMin`
14. `compensationMax`
15. `compensationCurrency`
16. `isOpen`
17. `createdBy`
18. `createdAt`
19. `updatedAt`
20. `archivedAt`

### JobVersion

Represents an append-only historical snapshot of job content.

Core fields:

1. `versionId`
2. `jobId`
3. `companyId`
4. `versionNumber`
5. `snapshot`
6. `changedBy`
7. `changeReason`
8. `createdAt`

### Application

Represents the relationship between a candidate and a job, and is the core recruiting pipeline record.

Core fields:

1. `applicationId`
2. `companyId`
3. `candidateId`
4. `jobId`
5. `stage`
6. `status`
7. `ownerUserId`
8. `collaboratorUserIds`
9. `priority`
10. `source`
11. `notesSummary`
12. `latestMessageId`
13. `lastActivityAt`
14. `createdAt`
15. `updatedAt`
16. `archivedAt`

### PromptTemplate

Represents editable stage/channel prompt configuration layered under the system prompt.

Core fields:

1. `templateId`
2. `companyId`
3. `stage`
4. `channel`
5. `promptVersion`
6. `basePrompt`
7. `editableFields`
8. `maxLengthWords`
9. `deprecated`
10. `createdAt`
11. `updatedAt`
12. `updatedBy`

### WritingSample

Represents a recruiter- or company-level style sample used to condition tone.

Core fields:

1. `sampleId`
2. `companyId`
3. `recruiterId`
4. `scope`
5. `stage`
6. `channel`
7. `text`
8. `isActive`
9. `sourceMessageId`
10. `createdAt`

### GeneratedMessage

Represents an immutable generation event and output.

Core fields:

1. `messageId`
2. `companyId`
3. `applicationId`
4. `candidateId`
5. `jobId`
6. `recruiterId`
7. `stage`
8. `channel`
9. `subject`
10. `message`
11. `sourceMessageId`
12. `isEditedVariant`
13. `templateVersionUsed`
14. `systemPromptVersionUsed`
15. `generationModel`
16. `generationLatencyMs`
17. `tokens`
18. `rationale`
19. `styleAlignmentNotes`
20. `qualityChecks`
21. `writingSampleIds`
22. `candidateName`
23. `jobTitle`
24. `wasApproved`
25. `sentAt`
26. `sentVia`
27. `createdAt`
28. `expiresAt`

### BulkGenerationJob

Represents a background generation request across multiple application targets.

Core fields:

1. `bulkJobId`
2. `companyId`
3. `recruiterId`
4. `jobId`
5. `stage`
6. `channel`
7. `applicationIds`
8. `status`
9. `totalCount`
10. `successCount`
11. `failureCount`
12. `errors`
13. `resultMessages`
14. `requestedAt`
15. `startedAt`
16. `completedAt`
17. `maxConcurrency`
18. `expiresAt`

## Firestore Structure

The recommended Firestore shape is:

```text
companies/{companyId}
companies/{companyId}/users/{userId}
companies/{companyId}/candidates/{candidateId}
companies/{companyId}/candidates/{candidateId}/versions/{versionId}
companies/{companyId}/candidates/{candidateId}/resumeChunks/{chunkId}
companies/{companyId}/jobs/{jobId}
companies/{companyId}/jobs/{jobId}/versions/{versionId}
companies/{companyId}/jobs/{jobId}/descriptionChunks/{chunkId}
companies/{companyId}/applications/{applicationId}
companies/{companyId}/promptTemplates/{templateId}
companies/{companyId}/writingSamples/{sampleId}
companies/{companyId}/generatedMessages/{messageId}
companies/{companyId}/bulkGenerationJobs/{bulkJobId}
```

Key structure rules:

1. All tenant-owned operational records are nested under the company.
2. Large text chunks and version history live in subcollections, not large arrays on parent documents.
3. Generated messages store lightweight display fields such as `candidateName` and `jobTitle` for list efficiency.
4. `Application` is the operational center of the recruiting workflow.

## Data Rules And Constraints

### Text storage policy

1. Keep candidate resume text inline when safely below the threshold.
2. Keep job description text inline when safely below the threshold.
3. Use chunk subcollections when content crosses the threshold.
4. Exclude large freeform text from indexes.
5. Reassemble chunked content on the server only.

### Recommended thresholds

1. Resume text: inline up to 100 KB.
2. Job description text: inline up to 50 KB.
3. Writing sample text: 50 to 400 words.
4. Generated message body: comfortably below 10 KB.
5. Prompt template body: below 10 KB.

### Validation rules

1. `stage` is an enum.
2. `channel` is an enum.
3. `role` is an enum.
4. Email fields require email validation.
5. Timestamps use Firestore `Timestamp`.
6. Client validation is UX only; server validation is authoritative.

### Deletion rules

1. Candidates, jobs, and applications use soft delete in MVP.
2. Archived records are hidden by default in the UI.
3. Hard delete and anonymization remain future compliance work.

### Immutability and versioning

1. Generated messages are immutable generation records.
2. Recruiter edits create new derived message records with `sourceMessageId`.
3. Candidate and job changes append snapshot history to version subcollections.
4. Prompt templates are versioned and deprecated rather than overwritten blindly.

## Indexing Recommendations

Likely composite indexes include:

1. `applications`: `status`, `stage`, `updatedAt desc`
2. `applications`: `jobId`, `stage`, `updatedAt desc`
3. `applications`: `candidateId`, `updatedAt desc`
4. `generatedMessages`: `applicationId`, `createdAt desc`
5. `generatedMessages`: `candidateId`, `stage`, `createdAt desc`
6. `generatedMessages`: `recruiterId`, `createdAt desc`
7. `writingSamples`: `recruiterId`, `isActive`, `createdAt desc`
8. `writingSamples`: `stage`, `channel`, `isActive`
9. `bulkGenerationJobs`: `recruiterId`, `requestedAt desc`
10. `bulkGenerationJobs`: `status`, `completedAt desc`
11. `jobs`: `isOpen`, `createdAt desc`
12. `candidates`: `isActive`, `createdAt desc`

TTL candidates:

1. `generatedMessages.expiresAt`
2. `bulkGenerationJobs.expiresAt`

## Access And Authorization Model

### Identity

1. Users authenticate with Firebase Auth.
2. Company membership and role authorization are modeled in Firestore.
3. Custom claims may mirror `companyId` and role later if rule complexity requires it.

### Roles

Initial role set:

1. `admin`
2. `recruiter`
3. `hiring_manager`

### Access principles

1. Data access is company-scoped.
2. Team access is shared by default.
3. Application ownership can still be tracked through `ownerUserId`.
4. All writes are validated server-side.

## Development Parameters And Conventions

These conventions should be treated as pre-implementation requirements.

### Environment variable contract

1. `VITE_*` is reserved for client-safe Firebase configuration only.
2. All GCP, Vertex AI, Cloud Run, service-account, queue, and operational values are server-only.
3. Use `.env.example` as the committed environment contract.
4. Use `.env.local` for local developer secrets.
5. Production secrets should come from Secret Manager or Cloud Run environment injection.

### Code organization

Recommended structure:

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

1. `src/lib/server` is server-only.
2. Shared domain types live in `src/lib/types`.
3. Validation schemas and guards live in `src/lib/validation`.
4. Structured logging lives in `src/lib/logging`.
5. Protected user workflows live under `src/routes/recruiter`.

### TypeScript and runtime rules

1. Use explicit types for function parameters and return values.
2. Prefer named exports.
3. Use structured domain error classes.
4. Use `async` and `await` in server code.
5. Never import server-only modules into client code.
6. Keep browser-only concerns out of server modules.
7. Use Firestore `Timestamp` instead of ad hoc ISO strings for stored records.

### Validation strategy

1. Introduce a shared schema validation layer before feature work grows.
2. Validate candidate, job, application, prompt, and generation inputs at the server boundary.
3. Validate size constraints before Firestore writes.
4. Never trust client-submitted values without server re-validation.

### Logging and error handling

1. Use structured logs in all server integrations.
2. Log generation events, latency, retries, and failures.
3. Log safe error context without secrets or raw credentials.
4. Re-throw or convert errors deliberately; never silently swallow them.

### Testing policy

Before implementation completes, the project should have:

1. Unit tests for repositories, validation, prompt assembly, and chunking rules.
2. Component tests for candidate, job, application, and generation UI.
3. Integration tests for authenticated server actions and Firestore-backed workflows.
4. End-to-end tests for sign-in, application workflow, generation, history, and bulk job polling.

## Background Bulk Generation Design

Bulk generation is not an afterthought. It is part of the MVP architecture.

Recommended approach:

1. User creates a bulk generation request.
2. Application writes a `BulkGenerationJob` record in Firestore.
3. Cloud Tasks enqueues per-batch or per-application tasks.
4. Idempotent worker logic processes each item.
5. Firestore job status is updated incrementally.
6. UI polls or subscribes to job state to show progress.

This approach is preferred over long-running in-request processing because it is more reliable, fits Cloud Run better, and scales with team usage.

## Remaining Assumptions

These are currently recommended defaults and should be treated as valid unless a product decision changes them.

1. English-only content for MVP.
2. Copy/export usage instead of direct sending integrations.
3. Soft quota warnings instead of hard blocking.
4. Company-level defaults can supplement recruiter writing samples.
5. Archived records remain recoverable in MVP.

## Relevant Existing Files

These files already exist and should remain aligned with this plan.

1. [PLAN.md](/Users/matt/Developer/liaizon/PLAN.md)
2. [SYSTEM_PROMPT.md](/Users/matt/Developer/liaizon/SYSTEM_PROMPT.md)
3. [FIRESTORE_SCHEMA.md](/Users/matt/Developer/liaizon/FIRESTORE_SCHEMA.md)
4. [CONVENTIONS.md](/Users/matt/Developer/liaizon/CONVENTIONS.md)
5. [.env.example](/Users/matt/Developer/liaizon/.env.example)
6. [PROMPT_GOVERNANCE.md](/Users/matt/Developer/liaizon/PROMPT_GOVERNANCE.md)
7. [package.json](/Users/matt/Developer/liaizon/package.json)
8. [svelte.config.js](/Users/matt/Developer/liaizon/svelte.config.js)
9. [tsconfig.json](/Users/matt/Developer/liaizon/tsconfig.json)
10. [vite.config.ts](/Users/matt/Developer/liaizon/vite.config.ts)
11. [eslint.config.js](/Users/matt/Developer/liaizon/eslint.config.js)
12. [src/routes](/Users/matt/Developer/liaizon/src/routes)
13. [src/lib](/Users/matt/Developer/liaizon/src/lib)

## Implementation Phases

### Phase 0: Contracts and conventions

1. Finalize this plan as the implementation source of truth.
2. Document environment contract, repo conventions, and Firestore data model.
3. Confirm prompt governance and versioning approach.

### Phase 1: Infrastructure baseline

1. Switch to `adapter-node` for Cloud Run.
2. Create environment access modules.
3. Add logging and error primitives.
4. Add validation and domain type layers.

### Phase 2: Domain and auth foundations

1. Build Firestore repositories and schemas.
2. Implement Firebase Auth integration.
3. Implement tenant membership and role checks.
4. Establish protected recruiter route layout.

### Phase 3: Product workflows

1. Candidate CRUD.
2. Job CRUD.
3. Application CRUD and stage transitions.
4. Writing sample management.
5. Prompt template management.
6. Stage-based message generation and message history.

### Phase 4: Async generation and operations

1. Background bulk generation with Cloud Tasks.
2. Job polling and progress UI.
3. Retry handling and operational safeguards.
4. Cost and usage observability.

### Phase 5: Hardening and release

1. Test coverage for critical paths.
2. Production config and secret management.
3. Budget alerts and monitoring.
4. Release smoke checks on Cloud Run.

## Verification Checklist

The project is ready to implement when all of the following are true.

1. Every user-facing workflow maps cleanly to the domain model.
2. `Application` is accepted as the pipeline source of truth.
3. Large text storage thresholds and chunk rules are accepted.
4. Version history behavior is accepted for candidate and job content.
5. Prompt governance and message immutability are accepted.
6. Environment variable boundaries are accepted.
7. Directory, testing, and logging conventions are accepted.
8. Cloud Tasks is accepted as the MVP bulk-generation mechanism.

## Natural Next Step

The next planning artifact should be a concrete schema and conventions package derived from this plan:

1. Firestore schema specification.
2. Development conventions document.
3. Environment variable contract.
4. Prompt/template versioning rules.

These artifacts now exist in the repository and should be treated as implementation prerequisites.
