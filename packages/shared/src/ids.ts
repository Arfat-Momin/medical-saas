/** UHID: PAT-000123 */
export const formatUHID = (n: number): string => `PAT-${String(n).padStart(6, '0')}`;
export const UHID_REGEX = /^PAT-\d{6}$/;

/** Tenant: TENANT001 */
export const formatTenantId = (n: number): string => `TENANT${String(n).padStart(3, '0')}`;
export const TENANT_REGEX = /^TENANT\d{3}$/;

/** Branch: BR002 */
export const formatBranchCode = (n: number): string => `BR${String(n).padStart(3, '0')}`;
export const BRANCH_REGEX = /^BR\d{3}$/;

/** Queue token: Token 01 */
export const formatQueueToken = (n: number): string => `Token ${String(n).padStart(2, '0')}`;
