import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveManagedUserPatch } from '../server/accountRoutes';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function requireText(file: string, text: string, label: string): void {
  if (!file.includes(text)) throw new Error(`PRIVATE_USER_SECURITY_FAIL:${label}`);
}
function forbidText(file: string, text: string, label: string): void {
  if (file.includes(text)) throw new Error(`PRIVATE_USER_SECURITY_FAIL:${label}`);
}

const decisionMain = source('src/decisionMain.tsx');
const portfolioMain = source('src/portfolioMain.tsx');
const legacyMain = source('src/main.tsx');
const gate = source('src/auth/SecureAppGate.tsx');
const accountApi = source('src/auth/accountApi.ts');
const adminPanel = source('src/components/AdminUsersPanel.tsx');
const cloudState = source('src/auth/userCloudState.ts');
const authSecurity = source('server/authSecurity.ts');
const accountRoutes = source('server/accountRoutes.ts');
const firebaseAdmin = source('server/firebaseAdmin.ts');
const alertAutomation = source('server/alertAutomation.ts');
const alertRoutes = source('server/alertAutomationRoutes.ts');
const firestoreRules = source('firestore.rules');
const packageJson = source('package.json');

for (const [file, label] of [[decisionMain, 'MAIN'], [portfolioMain, 'PORTFOLIO_LAB'], [legacyMain, 'LEGACY']] as const) {
  requireText(file, 'SecureAppGate', `${label}_MUST_BE_AUTH_GATED`);
}

requireText(gate, "gate === 'DEV_BYPASS'", 'LOCAL_DEV_BYPASS_MISSING');
requireText(gate, "if (gate === 'ERROR') return", 'AUTH_ERRORS_MUST_FAIL_CLOSED');
requireText(gate, 'sendEmailVerification', 'EMAIL_VERIFICATION_UI_MISSING');
requireText(gate, 'await reload(user);', 'VERIFIED_EMAIL_REFRESH_MISSING');
requireText(gate, 'ACCESS_REVALIDATION_MS', 'OPEN_SESSION_ACCESS_REVALIDATION_MISSING');
requireText(gate, 'loadAccountSessionStatus(user)', 'LIVE_ACCOUNT_STATUS_CHECK_MISSING');
requireText(gate, "document.addEventListener('visibilitychange'", 'FOREGROUND_ACCESS_REVALIDATION_MISSING');
requireText(gate, 'cloudSyncStopRef', 'PRIVATE_SYNC_STOP_HANDLE_MISSING');
requireText(gate, 'stopCloudSync();\n      clearPrivateLocalState();', 'REVOKED_SESSION_MUST_STOP_SYNC_BEFORE_LOCAL_CLEAR');
requireText(gate, 'No se ha podido revalidar el acceso:', 'REVALIDATION_FAILURE_MUST_FAIL_CLOSED_WITHOUT_PRETENDING_REVOCATION');
requireText(firebaseAdmin, "process.env.NODE_ENV === 'production' || process.env.FIREBASE_AUTH_REQUIRED === 'true'", 'PRODUCTION_AUTH_MUST_BE_REQUIRED');
requireText(authSecurity, 'auth.verifyIdToken(raw, true)', 'SERVER_MUST_VERIFY_AND_CHECK_REVOKED_ID_TOKEN');
requireText(authSecurity, 'token.isAdmin === true', 'ADMIN_MUST_COME_FROM_SIGNED_CLAIM');
requireText(authSecurity, 'token.accessGranted === true || token.isAdmin === true', 'ACCESS_MUST_COME_FROM_SIGNED_CLAIM');
requireText(authSecurity, 'account.token.email_verified === true', 'BOOTSTRAP_EMAIL_MUST_BE_VERIFIED');
forbidText(authSecurity, "profile.role === 'admin'", 'FIRESTORE_PROFILE_MUST_NOT_GRANT_ADMIN');

requireText(accountRoutes, "accountRouter.get('/state'", 'PRIVATE_STATE_READ_ENDPOINT_MISSING');
requireText(accountRoutes, "accountRouter.put('/state'", 'PRIVATE_STATE_WRITE_ENDPOINT_MISSING');
requireText(accountRoutes, "accountRouter.get('/session-status'", 'LIVE_ACCOUNT_STATUS_ENDPOINT_MISSING');
requireText(accountRoutes, 'requireActiveAccount(req, res)', 'PRIVATE_STATE_MUST_REQUIRE_ACTIVE_ACCOUNT');
requireText(accountRoutes, "accountRouter.get('/admin/users'", 'ADMIN_USER_LIST_MISSING');
requireText(accountRoutes, 'requireAdmin(req, res)', 'ADMIN_ROUTES_MUST_REQUIRE_ADMIN');
requireText(accountRoutes, 'ADMIN_CANNOT_DELETE_SELF', 'ADMIN_SELF_DELETE_GUARD_MISSING');
requireText(accountRoutes, 'CANNOT_DELETE_LAST_ADMIN', 'LAST_ADMIN_DELETE_GUARD_MISSING');
requireText(accountRoutes, 'CANNOT_REMOVE_LAST_ADMIN', 'LAST_ADMIN_DEMOTION_GUARD_MISSING');
requireText(accountRoutes, 'ADMIN_ACCESS_REQUIRES_DEMOTION_FIRST', 'ADMIN_ACCESS_REVOKE_MUST_NOT_SILENTLY_NOOP');
requireText(accountRoutes, 'auth.revokeRefreshTokens(uid)', 'PRIVILEGE_REVOCATION_MUST_REVOKE_REFRESH_TOKENS');
requireText(accountRoutes, 'ADMIN_USER_PROFILE_SYNC_FAILED', 'AUTH_MUTATION_MUST_NOT_BE_REPORTED_FALSELY_FAILED_BY_PROFILE_MIRROR');
requireText(accountRoutes, 'db.recursiveDelete(db.doc(`users/${uid}`))', 'USER_DELETE_MUST_REMOVE_PRIVATE_DATA');
forbidText(accountRoutes, "accountRouter.get('/admin/users/:uid/state'", 'ADMIN_MUST_NOT_HAVE_PORTFOLIO_READ_ENDPOINT');
for (const key of ['custodia_fund_positions_v1', 'custodia_staged_capital_plan_v1', 'custodia_pending_execution_plan_v1']) {
  requireText(accountRoutes, `'${key}'`, `BACKEND_PRIVATE_KEY_MISSING:${key}`);
  requireText(cloudState, `'${key}'`, `CLIENT_PRIVATE_KEY_MISSING:${key}`);
}

const normalRevoke = resolveManagedUserPatch({ accessGranted: true, isAdmin: false }, false, { accessGranted: false });
assert.equal(normalRevoke.error, null);
assert.equal(normalRevoke.nextAccessGranted, false);
assert.equal(normalRevoke.nextIsAdmin, false);

const adminDirectRevoke = resolveManagedUserPatch({ accessGranted: true, isAdmin: true }, false, { accessGranted: false });
assert.equal(adminDirectRevoke.error, 'ADMIN_ACCESS_REQUIRES_DEMOTION_FIRST');
assert.equal(adminDirectRevoke.nextAccessGranted, true);
assert.equal(adminDirectRevoke.nextIsAdmin, true);

const adminDemotion = resolveManagedUserPatch({ accessGranted: true, isAdmin: true }, false, { isAdmin: false });
assert.equal(adminDemotion.error, null);
assert.equal(adminDemotion.nextIsAdmin, false);
assert.equal(adminDemotion.nextAccessGranted, true);

const adminDemotionAndRevoke = resolveManagedUserPatch({ accessGranted: true, isAdmin: true }, false, { isAdmin: false, accessGranted: false });
assert.equal(adminDemotionAndRevoke.error, null);
assert.equal(adminDemotionAndRevoke.nextIsAdmin, false);
assert.equal(adminDemotionAndRevoke.nextAccessGranted, false);

requireText(accountRoutes, "const ADMIN_AUDIT_COLLECTION = 'admin_audit_log'", 'ADMIN_AUDIT_COLLECTION_MISSING');
requireText(accountRoutes, "accountRouter.get('/admin/audit-log'", 'ADMIN_AUDIT_ENDPOINT_MISSING');
requireText(accountRoutes, "writeAdminAudit(admin, 'USER_CREATED'", 'ADMIN_CREATE_AUDIT_MISSING');
requireText(accountRoutes, "writeAdminAudit(admin, 'USER_UPDATED'", 'ADMIN_UPDATE_AUDIT_MISSING');
requireText(accountRoutes, "writeAdminAudit(admin, 'PASSWORD_RESET_LINK_CREATED'", 'ADMIN_PASSWORD_LINK_AUDIT_MISSING');
requireText(accountRoutes, "writeAdminAudit(admin, 'USER_DELETED'", 'ADMIN_DELETE_AUDIT_MISSING');
requireText(accountRoutes, 'ADMIN_USER_CREATE_ROLLBACK_FAILED', 'ADMIN_CREATE_ROLLBACK_GUARD_MISSING');
requireText(accountRoutes, 'emailVerified: user.emailVerified', 'ADMIN_EMAIL_VERIFICATION_EVIDENCE_MISSING');
requireText(accountApi, 'loadAdminAudit', 'ADMIN_AUDIT_CLIENT_API_MISSING');
requireText(accountApi, 'loadAccountSessionStatus', 'LIVE_ACCOUNT_STATUS_CLIENT_API_MISSING');
requireText(adminPanel, 'Actividad administrativa reciente', 'ADMIN_AUDIT_UI_MISSING');
requireText(adminPanel, 'Promise.allSettled', 'AUDIT_FAILURE_MUST_NOT_HIDE_UPDATED_USER_LIST');
requireText(adminPanel, 'auditError', 'AUDIT_FAILURE_MUST_BE_REPORTED_SEPARATELY');
forbidText(adminPanel, 'window.confirm(', 'NATIVE_CONFIRM_MUST_NOT_GATE_ADMIN_ACTIONS');
requireText(adminPanel, 'pendingAction', 'IN_APP_ADMIN_CONFIRMATION_STATE_MISSING');
requireText(adminPanel, 'Confirmar acción', 'IN_APP_ADMIN_CONFIRMATION_UI_MISSING');
requireText(adminPanel, 'Cancelar', 'IN_APP_ADMIN_CONFIRMATION_CANCEL_MISSING');
requireText(adminPanel, 'generatedLink', 'PASSWORD_LINK_VISIBLE_FALLBACK_MISSING');
requireText(adminPanel, 'El navegador no permitió copiar automáticamente', 'CLIPBOARD_FAILURE_MUST_NOT_HIDE_GENERATED_LINK');
requireText(adminPanel, '!self && !row.isAdmin', 'ADMIN_ACCESS_REVOKE_UI_MUST_REQUIRE_DEMOTION');
requireText(adminPanel, 'Un ADMIN siempre tiene acceso', 'ADMIN_ACCESS_SEMANTICS_MUST_BE_EXPLAINED');
forbidText(accountRoutes, 'Cubetos-y-balsas-sincronizado', 'TRADING_RUNTIME_MUST_NOT_DEPEND_ON_CUBETOS');
forbidText(accountApi, 'Cubetos-y-balsas-sincronizado', 'TRADING_CLIENT_MUST_NOT_DEPEND_ON_CUBETOS');

requireText(cloudState, "const OWNER_KEY = 'custodia_cloud_owner_uid_v1'", 'LOCAL_STATE_OWNER_MARKER_MISSING');
requireText(cloudState, 'localOwner && localOwner !== user.uid', 'CROSS_USER_LOCAL_STATE_GUARD_MISSING');
requireText(cloudState, 'clearPrivateLocalState()', 'PRIVATE_LOCAL_CLEAR_MISSING');

requireText(alertRoutes, "alertAutomationRouter.use('/account', accountRouter)", 'ACCOUNT_ROUTER_NOT_MOUNTED');
requireText(alertAutomation, "const FIRESTORE_STATE_DOCUMENT = 'system/alertAutomation'", 'ALERT_STATE_FIRESTORE_DOCUMENT_MISSING');
requireText(alertAutomation, 'db.doc(FIRESTORE_STATE_DOCUMENT).get()', 'ALERT_STATE_MUST_READ_FIRESTORE');
requireText(alertAutomation, 'db.doc(FIRESTORE_STATE_DOCUMENT).set({', 'ALERT_STATE_MUST_WRITE_FIRESTORE');
requireText(alertAutomation, "process.env.NODE_ENV === 'production' || process.env.FIREBASE_AUTH_REQUIRED === 'true'", 'ALERT_STATE_MUST_REQUIRE_DURABLE_STORAGE_IN_PRODUCTION');
requireText(alertAutomation, 'ALERT_STATE_PERSISTENCE_NOT_CONFIGURED', 'ALERT_STATE_MUST_FAIL_CLOSED_WITHOUT_DURABLE_STORAGE');
requireText(alertRoutes, 'await getAlertAutomationStatus()', 'ALERT_STATUS_MUST_AWAIT_PERSISTENT_STATE');

requireText(firestoreRules, 'allow create, update, delete: if false;', 'CLIENT_WRITES_MUST_BE_DENIED');
requireText(firestoreRules, 'request.auth.uid == userId', 'FIRESTORE_OWNER_CHECK_MISSING');
requireText(firestoreRules, 'request.auth.token.isAdmin == true', 'FIRESTORE_ADMIN_CLAIM_CHECK_MISSING');
requireText(firestoreRules, 'allow read: if hasAccess() && owns(userId);', 'PRIVATE_FINANCIAL_READ_MUST_BE_OWNER_ONLY');
forbidText(firestoreRules, 'allow read: if hasAccess() && (owns(userId) || isAdmin());', 'ADMIN_MUST_NOT_READ_OTHER_USERS_FINANCIAL_STATE');
requireText(firestoreRules, 'allow read, write: if false;', 'FIRESTORE_DENY_BY_DEFAULT_MISSING');

requireText(packageJson, '"firebase": "12.18.0"', 'FIREBASE_CLIENT_DEPENDENCY_MISSING');
requireText(packageJson, '"firebase-admin": "13.10.0"', 'FIREBASE_ADMIN_DEPENDENCY_MISSING');

console.log('PRIVATE_USER_SECURITY_PASS');