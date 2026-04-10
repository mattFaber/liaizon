# Firestore Schema Specification

This document defines the Firestore data model for the recruiter messaging application.

It is derived from [PLAN.md](/Users/matt/Developer/liaizon/PLAN.md) and is intended to be the implementation reference for repositories, validation schemas, security rules, indexes, and background processing.

## Design Principles

1. All operational records are scoped by company.
2. Firestore is the source of truth for application data.
3. Large recruiter-entered text is stored as text, not files, in MVP.
4. Large freeform text fields must not be indexed.
5. Generated messages are immutable records.
6. Candidate and job edits create append-only version history.
7. Application is the pipeline source of truth.

## Top-Level Structure

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

## Collections

### companies

Document path: `companies/{companyId}`

Fields:

1. `name`: string
2. `plan`: `free | pro | enterprise`
3. `defaultLanguage`: `en`
4. `defaultStyleStrength`: `low | medium | high`
5. `monthlyGenerationQuota`: number
6. `settings`: map
7. `createdBy`: string
8. `createdAt`: Timestamp
9. `isActive`: boolean

### users

Document path: `companies/{companyId}/users/{userId}`

Fields:

1. `email`: string
2. `displayName`: string
3. `role`: `admin | recruiter | hiring_manager`
4. `preferences`: map
5. `lastLoginAt`: Timestamp
6. `createdAt`: Timestamp
7. `isActive`: boolean

Notes:

1. Firebase Auth provides identity; Firestore stores tenancy and role.
2. `userId` should match Firebase UID.

### candidates

Document path: `companies/{companyId}/candidates/{candidateId}`

Fields:

1. `firstName`: string
2. `lastName`: string
3. `fullName`: string
4. `email`: string | null
5. `phone`: string | null
6. `linkedinUrl`: string | null
7. `currentTitle`: string | null
8. `currentCompany`: string | null
9. `yearsExperience`: number | null
10. `highlights`: string[]
11. `resumeText`: string | null
12. `resumeTextSizeBytes`: number
13. `resumeStorageMode`: `inline | chunked | none`
14. `activeVersionNumber`: number
15. `tags`: string[]
16. `createdBy`: string
17. `createdAt`: Timestamp
18. `updatedAt`: Timestamp
19. `archivedAt`: Timestamp | null
20. `isActive`: boolean

Constraints:

1. `resumeText` is only stored inline when below threshold.
2. Large resume text moves into `resumeChunks` subcollection.
3. `resumeText` must be excluded from indexing.

### candidate versions

Document path: `companies/{companyId}/candidates/{candidateId}/versions/{versionId}`

Fields:

1. `versionNumber`: number
2. `snapshot`: map
3. `changedBy`: string
4. `changeReason`: string | null
5. `createdAt`: Timestamp

Notes:

1. This is append-only.
2. Snapshot should contain the canonical candidate state at the time of change.

### candidate resume chunks

Document path: `companies/{companyId}/candidates/{candidateId}/resumeChunks/{chunkId}`

Fields:

1. `chunkIndex`: number
2. `text`: string
3. `sizeBytes`: number
4. `createdAt`: Timestamp

Constraints:

1. `text` must not be indexed.
2. Chunks are only used when inline storage threshold is exceeded.

### jobs

Document path: `companies/{companyId}/jobs/{jobId}`

Fields:

1. `title`: string
2. `department`: string | null
3. `level`: string | null
4. `description`: string | null
5. `descriptionSizeBytes`: number
6. `descriptionStorageMode`: `inline | chunked | none`
7. `requiredSkills`: string[]
8. `preferredSkills`: string[]
9. `keyResponsibilities`: string[]
10. `location`: string | null
11. `employmentType`: string | null
12. `compensationMin`: number | null
13. `compensationMax`: number | null
14. `compensationCurrency`: string | null
15. `isOpen`: boolean
16. `activeVersionNumber`: number
17. `createdBy`: string
18. `createdAt`: Timestamp
19. `updatedAt`: Timestamp
20. `archivedAt`: Timestamp | null

Constraints:

1. `description` must not be indexed.
2. Large descriptions move into `descriptionChunks` subcollection.

### job versions

Document path: `companies/{companyId}/jobs/{jobId}/versions/{versionId}`

Fields:

1. `versionNumber`: number
2. `snapshot`: map
3. `changedBy`: string
4. `changeReason`: string | null
5. `createdAt`: Timestamp

### job description chunks

Document path: `companies/{companyId}/jobs/{jobId}/descriptionChunks/{chunkId}`

Fields:

1. `chunkIndex`: number
2. `text`: string
3. `sizeBytes`: number
4. `createdAt`: Timestamp

### applications

Document path: `companies/{companyId}/applications/{applicationId}`

Fields:

1. `candidateId`: string
2. `jobId`: string
3. `stage`: `initial_outreach | follow_up | interview_invite | interview_follow_up | offer_stage | rejection`
4. `status`: `active | paused | closed | hired | rejected`
5. `ownerUserId`: string
6. `collaboratorUserIds`: string[]
7. `priority`: `low | medium | high`
8. `source`: string | null
9. `notesSummary`: string | null
10. `latestMessageId`: string | null
11. `lastActivityAt`: Timestamp
12. `createdAt`: Timestamp
13. `updatedAt`: Timestamp
14. `archivedAt`: Timestamp | null

Notes:

1. This is the main workflow record for filtering, dashboards, and stage transitions.
2. Messages reference the application.

### promptTemplates

Document path: `companies/{companyId}/promptTemplates/{templateId}`

Fields:

1. `stage`: string
2. `channel`: `email | linkedin | sms`
3. `promptVersion`: number
4. `basePrompt`: string
5. `editableFields`: string[]
6. `maxLengthWords`: number
7. `deprecated`: boolean
8. `updatedBy`: string
9. `createdAt`: Timestamp
10. `updatedAt`: Timestamp

Constraints:

1. Templates are versioned, not overwritten in place without history.
2. `basePrompt` should stay below 10 KB.

### writingSamples

Document path: `companies/{companyId}/writingSamples/{sampleId}`

Fields:

1. `recruiterId`: string | null
2. `scope`: `recruiter | company`
3. `stage`: string | null
4. `channel`: `email | linkedin | sms`
5. `text`: string
6. `isActive`: boolean
7. `sourceMessageId`: string | null
8. `createdAt`: Timestamp

Constraints:

1. `text` must not be indexed.
2. Recommended size is 50 to 400 words.

Lookup order:

1. Recruiter-specific active samples.
2. Company-level active defaults.

### generatedMessages

Document path: `companies/{companyId}/generatedMessages/{messageId}`

Fields:

1. `applicationId`: string
2. `candidateId`: string
3. `jobId`: string
4. `recruiterId`: string
5. `stage`: string
6. `channel`: `email | linkedin | sms`
7. `subject`: string
8. `message`: string
9. `sourceMessageId`: string | null
10. `isEditedVariant`: boolean
11. `templateVersionUsed`: number
12. `systemPromptVersionUsed`: string
13. `generationModel`: string
14. `generationLatencyMs`: number
15. `tokens`: map
16. `rationale`: string[]
17. `styleAlignmentNotes`: string[]
18. `qualityChecks`: map
19. `writingSampleIds`: string[]
20. `candidateName`: string
21. `jobTitle`: string
22. `wasApproved`: boolean
23. `sentAt`: Timestamp | null
24. `sentVia`: `clipboard | exported | email | linkedin | sms | null`
25. `createdAt`: Timestamp
26. `expiresAt`: Timestamp | null

Constraints:

1. `message` must not be indexed.
2. This collection is append-only except for approval/send metadata if business rules allow it.
3. Edited recruiter variants must create a new record with `sourceMessageId`.

### bulkGenerationJobs

Document path: `companies/{companyId}/bulkGenerationJobs/{bulkJobId}`

Fields:

1. `recruiterId`: string
2. `jobId`: string | null
3. `stage`: string
4. `channel`: `email | linkedin | sms`
5. `applicationIds`: string[]
6. `status`: `queued | processing | completed | failed | partial_success`
7. `totalCount`: number
8. `successCount`: number
9. `failureCount`: number
10. `errors`: map[]
11. `resultMessages`: map[]
12. `requestedAt`: Timestamp
13. `startedAt`: Timestamp | null
14. `completedAt`: Timestamp | null
15. `maxConcurrency`: number
16. `expiresAt`: Timestamp | null

Notes:

1. Firestore stores status and progress.
2. Cloud Tasks performs the actual fan-out work.

## Index Recommendations

Composite indexes likely required:

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

TTL targets:

1. `generatedMessages.expiresAt`
2. `bulkGenerationJobs.expiresAt`

## Storage Thresholds

Recommended thresholds:

1. Candidate resume text inline up to 100 KB.
2. Job description text inline up to 50 KB.
3. Generated message body below 10 KB.
4. Writing samples between 50 and 400 words.
5. Prompt template text below 10 KB.

## Validation Requirements

1. Validate enum values on every server write.
2. Validate email fields.
3. Validate byte size before writing inline text.
4. Convert oversized text into chunk subcollections on write.
5. Reconstruct chunked text only in server modules.

## Security Notes

1. All reads and writes must be company-scoped.
2. Client SDK access should be limited to the minimum required surface area.
3. Sensitive generation and write operations should route through server code.
4. Firestore rules must align with Firebase Auth UID and company membership.

## Implementation Order

1. Define TypeScript types from this schema.
2. Define validation schemas from those types.
3. Build repositories around collection boundaries.
4. Add indexes after query patterns are implemented.
5. Add security rules once auth and tenancy contracts are finalized.
