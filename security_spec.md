# EmpireOS Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every document lives under `/users/{userId}` or its subcollections (`businesses`, `projects`, `tasks`, `habits`, `coachLogs`). Only the authenticated, verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`) can read or write.
2. **Identity Integrity**: Every document MUST carry `uid == request.auth.uid`, and `uid` is immutable after creation.
3. **Referential Integrity**:
   - Every `Project` MUST reference an existing `Business` under `/users/{userId}/businesses/{businessId}` on creation (`existsAfter`).
   - Every `Task` and `Habit` MUST reference an existing `Business` under `/users/{userId}/businesses/{businessId}` on creation (`existsAfter`).
   - If a `Task` specifies a non-empty `projectId`, that project MUST exist under `/users/{userId}/projects/{projectId}`.
4. **Temporal Integrity**: `createdAt` must equal `request.time` on creation and remain immutable on update. `updatedAt` must equal `request.time` on creation and every update.
5. **Immutable Audit Trail**: `coachLogs` documents are strictly append-only (`allow update: if false;`), preserving accountability history integrity.
6. **Bounded Arrays & Strings**: Every string has an explicit `.size()` check matching `firebase-blueprint.json`. `phaseHeadings` is bounded to `<= 20` items; `completedDates` is bounded to `<= 366` items with element type validation.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-Tenant Read**: User B attempts `get` on `/users/userA/tasks/task1` -> `PERMISSION_DENIED`.
2. **Cross-Tenant List**: User B attempts `list` on `/users/userA/businesses` -> `PERMISSION_DENIED`.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts `create` on `/users/{uid}/tasks/task1` -> `PERMISSION_DENIED`.
4. **Identity Spoofing**: User A attempts `create` on `/users/userA/businesses/biz1` with `{ uid: "userB", ... }` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection**: User A attempts `create` on `/users/userA/tasks/task1` with extra ghost field `isAdmin: true` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: User A attempts `create` on `/users/userA/tasks/$$bad!id` or 200-char ID -> `PERMISSION_DENIED`.
7. **Orphaned Project Creation**: User A attempts `create` on `/users/userA/projects/proj1` with non-existent `businessId: "ghost_biz"` -> `PERMISSION_DENIED`.
8. **Timestamp Backdating**: User A attempts `create` on `/users/userA/tasks/task1` with client-forged `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Immutable Field Mutation**: User A attempts `update` on `/users/userA/projects/proj1` changing `uid` or `createdAt` -> `PERMISSION_DENIED`.
10. **Value Poisoning on Update**: User A attempts `update` on `/users/userA/tasks/task1` setting `title` to a 500-char string or `status` to `"hacked"` -> `PERMISSION_DENIED`.
11. **Array Exhaustion**: User A attempts `create` on `/users/userA/projects/proj1` with 25 items in `phaseHeadings` -> `PERMISSION_DENIED`.
12. **CoachLog Tampering**: User A attempts `update` on `/users/userA/coachLogs/log1` to rewrite their accountability history -> `PERMISSION_DENIED`.
