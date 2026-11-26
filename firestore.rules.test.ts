/**
 * EmpireOS Firestore Rules — Dirty Dozen Adversarial Security Test Specification.
 * Run against Firebase Rules Emulator when testing locally with @firebase/rules-unit-testing.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  actorUid: string;
  emailVerified: boolean;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Cross-Tenant Read denied',
    actorUid: 'attacker_uid',
    emailVerified: true,
    operation: 'get',
    path: '/users/victim_uid/tasks/task_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-Tenant List denied',
    actorUid: 'attacker_uid',
    emailVerified: true,
    operation: 'list',
    path: '/users/victim_uid/businesses',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Write denied',
    actorUid: 'user_a',
    emailVerified: false,
    operation: 'create',
    path: '/users/user_a/businesses/biz_1',
    payload: { uid: 'user_a', name: 'Test', colorHex: '#F59E0B', icon: 'fuel', isActive: true, sortOrder: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity Spoofing denied',
    actorUid: 'user_a',
    emailVerified: true,
    operation: 'create',
    path: '/users/user_a/businesses/biz_1',
    payload: { uid: 'user_b', name: 'Spoofed', colorHex: '#F59E0B', icon: 'fuel', isActive: true, sortOrder: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Field Injection denied',
    actorUid: 'user_a',
    emailVerified: true,
    operation: 'create',
    path: '/users/user_a/businesses/biz_2',
    payload: { uid: 'user_a', name: 'Valid', colorHex: '#F59E0B', icon: 'fuel', isActive: true, sortOrder: 0, isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'ID Poisoning denied',
    actorUid: 'user_a',
    emailVerified: true,
    operation: 'create',
    path: '/users/user_a/tasks/$$bad!id',
    payload: { uid: 'user_a', title: 'Bad ID' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Project Creation denied',
    actorUid: 'user_a',
    emailVerified: true,
    operation: 'create',
    path: '/users/user_a/projects/proj_orphan',
    payload: { uid: 'user_a', businessId: 'nonexistent_biz', name: 'Orphan', phaseHeadings: [], targetDate: '', isArchived: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Timestamp Backdating denied',
    actorUid: 'user_a',
    emailVerified: true,
    operation: 'create',
    path: '/users/user_a/businesses/biz_backdate',
    payload: { uid: 'user_a', name: 'Backdated', colorHex: '#F59E0B', icon: 'fuel', isActive: true, sortOrder: 0, createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable Field Mutation denied',
    actorUid: 'user_a',
    emailVerified: true,
    operation: 'update',
    path: '/users/user_a/projects/proj_1',
    payload: { businessId: 'other_biz' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Value Poisoning on Update denied',
    actorUid: 'user_a',
    emailVerified: true,
    operation: 'update',
    path: '/users/user_a/tasks/task_1',
    payload: { status: 'hacked', title: 'x'.repeat(500) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Array Exhaustion denied',
    actorUid: 'user_a',
    emailVerified: true,
    operation: 'create',
    path: '/users/user_a/projects/proj_overflow',
    payload: { uid: 'user_a', businessId: 'biz_1', name: 'Overflow', phaseHeadings: Array.from({ length: 25 }, (_, i) => `P${i}`), targetDate: '', isArchived: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'CoachLog Update Tampering denied',
    actorUid: 'user_a',
    emailVerified: true,
    operation: 'update',
    path: '/users/user_a/coachLogs/log_1',
    payload: { wakeUpCall: 'Tampered' },
    expected: 'PERMISSION_DENIED',
  },
];
