/**
 * graphClient.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * App-level (client credentials) Microsoft Graph helper.
 *
 * Required Azure AD app permissions (APPLICATION, not delegated):
 *   - User.Read.All
 *   - AppRoleAssignment.ReadWrite.All  (or just AppRoleAssignment.ReadAll)
 *   - GroupMember.Read.All  (if you are using Groups instead of App Roles)
 *
 * Set ENTRA_CLIENT_SECRET in your .env file with the real secret.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from "axios";

// ─── In-memory app token cache ───────────────────────────────────────────────
let cachedAppToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Acquires an app-level access token for Microsoft Graph using
 * the client_credentials OAuth2 flow.
 */
export async function getAppToken(): Promise<string> {
  if (cachedAppToken && Date.now() < tokenExpiresAt) {
    return cachedAppToken;
  }

  const tenantId     = process.env.ENTRA_TENANT_ID;
  const clientId     = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret || clientSecret === "your_client_secret_if_used") {
    console.error(`[GRAPH] ENTRA_CLIENT_SECRET loaded: ${!!clientSecret && clientSecret !== "your_client_secret_if_used"}`);
    throw new Error(
      "GRAPH_APP_TOKEN_UNAVAILABLE: ENTRA_CLIENT_SECRET is not configured. " +
      "Set it in .env to enable server-side Graph lookups."
    );
  }

  console.log(`[GRAPH] ENTRA_CLIENT_SECRET loaded: true`);

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         "https://graph.microsoft.com/.default",
  });

  const response = await axios.post(tokenUrl, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  cachedAppToken = response.data.access_token;
  // expire 5 minutes before actual expiry
  tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;

  return cachedAppToken!;
}

// ─── Role name→display label mapping ─────────────────────────────────────────
// These must match the `value` field of the App Roles defined in your
// Azure AD app manifest.
const ROLE_VALUE_MAP: Record<string, "admin" | "hr" | "manager" | "employee"> = {
  // App Role values (manifest `value` field)
  "Admin":                "admin",
  "SipraHub-SystemAdmin": "admin",
  "SipraHub_SystemAdmin": "admin",
  "SipraHub-Admin":       "admin",

  "HR":                   "hr",
  "SipraHub-HR":          "hr",
  "SipraHub_HR":          "hr",

  "Manager":              "manager",
  "SipraHub-Manager":     "manager",
  "SipraHub_Manager":     "manager",

  "Employee":             "employee",
  "SipraHub-Employee":    "employee",
  "SipraHub_Employee":    "employee",
  "Default Access":       "employee",
};

/**
 * Fetches the app role assignments and group memberships for a specific user from Microsoft Graph.
 * 
 * Returns the highest-priority role: admin > hr > manager > employee
 * Returns null if Graph is unavailable.
 */
export async function getUserRoleFromGraph(
  userEntraOid: string,
  userEmail: string,
  includeDebug: boolean = false
): Promise<any> {
  const debug: any = {
    email: userEmail,
    oid: userEntraOid,
    graphTokenStatus: "not_attempted",
    appRoleAssignments: [],
    memberOfGroups: [],
    detectedRoles: [],
    finalRole: "employee",
    error: null,
    reason: null
  };

  try {
    console.log(`[GRAPH] Fetching role for ${userEmail}...`);
    const appToken = await getAppToken();
    debug.graphTokenStatus = "acquired";
    console.log(`[GRAPH] Graph token acquired for ${userEmail}`);
    const clientId = process.env.ENTRA_CLIENT_ID!;

    // Step 1 — fetch this user's app role assignments for our app
    // This includes both direct and group-based assignments if the user is in a group assigned to the app.
    const assignmentsUrl = `https://graph.microsoft.com/v1.0/users/${userEntraOid}/appRoleAssignments`;
    const assignmentsRes = await axios.get(assignmentsUrl, {
      headers: { Authorization: `Bearer ${appToken}` },
    });
    console.log(`[GRAPH] appRoleAssignments status: ${assignmentsRes.status}`);

    const assignments: any[] = assignmentsRes.data.value || [];
    debug.appRoleAssignments = assignments;

    // Step 2 — fetch the app's role definitions (to map roleId → roleName)
    const appRolesUrl = `https://graph.microsoft.com/v1.0/applications?$filter=appId eq '${clientId}'&$select=appRoles`;
    const appRolesRes = await axios.get(appRolesUrl, {
      headers: { Authorization: `Bearer ${appToken}` },
    });

    const appRoleDefinitions: any[] = appRolesRes.data.value?.[0]?.appRoles || [];
    const roleIdToValue: Record<string, string> = {};
    appRoleDefinitions.forEach((r: any) => {
      roleIdToValue[r.id] = r.value;
    });

    // Step 3 — Resolve assigned role names from appRoleAssignments
    const assignedFromAssignments = assignments
      .filter((a: any) => a.resourceId) // We could check resourceId matches our servicePrincipal, but usually assignments are relevant
      .map((a: any) => roleIdToValue[a.appRoleId])
      .filter(Boolean);

    debug.detectedRoles.push(...assignedFromAssignments);

    // Step 4 — fetch group memberships (memberOf)
    // Some organizations use security groups directly without app role assignments
    const groupsUrl = `https://graph.microsoft.com/v1.0/users/${userEntraOid}/memberOf?$select=displayName,id`;
    const groupsRes = await axios.get(groupsUrl, {
      headers: { Authorization: `Bearer ${appToken}` },
    });
    console.log(`[GRAPH] memberOf status: ${groupsRes.status}`);
    const groups = groupsRes.data.value || [];
    debug.memberOfGroups = groups;

    const groupNames = groups
      .filter((g: any) => g["@odata.type"] === "#microsoft.graph.group")
      .map((g: any) => g.displayName)
      .filter(Boolean);
    
    debug.detectedRoles.push(...groupNames);

    // Step 5 — map to our internal role with priority: admin > hr > manager > employee
    // Case-insensitive mapping
    const PRIORITY: Record<string, number> = { admin: 4, hr: 3, manager: 2, employee: 1 };
    let resolvedRole: "admin" | "hr" | "manager" | "employee" = "employee";
    let highestPriority = 0;

    const uniqueRoles: string[] = Array.from(new Set(debug.detectedRoles.map((r: string) => r.toLowerCase())));

    for (const rawRole of uniqueRoles) {
      // Direct mapping check
      let mapped: "admin" | "hr" | "manager" | "employee" | null = null;
      
      if (rawRole.includes("admin")) mapped = "admin";
      else if (rawRole.includes("hr") || rawRole.includes("human resources")) mapped = "hr";
      else if (rawRole.includes("manager")) mapped = "manager";
      else if (rawRole.includes("employee")) mapped = "employee";

      // Also check explicit ROLE_VALUE_MAP (case-insensitive)
      for (const [key, val] of Object.entries(ROLE_VALUE_MAP)) {
        if (key.toLowerCase() === rawRole) {
          mapped = val;
          break;
        }
      }

      if (mapped) {
        const p = PRIORITY[mapped] ?? 0;
        if (p > highestPriority) {
          highestPriority = p;
          resolvedRole = mapped;
        }
      }
    }

    debug.finalRole = resolvedRole;
    console.log(`[GRAPH] ${userEmail}: Roles=${JSON.stringify(uniqueRoles)} -> Final=${resolvedRole}`);
    
    return includeDebug ? debug : resolvedRole;

  } catch (err: any) {
    debug.error = err.message;
    debug.status = err.response?.status;
    debug.code = err.response?.data?.error?.code;
    debug.reason = err.response?.data?.error?.message || "Unknown Graph Error";
    debug.failed_url = err.config?.url;
    
    if (err.message?.startsWith("GRAPH_APP_TOKEN_UNAVAILABLE")) {
      console.warn(`[GRAPH] App token unavailable — ${err.message}`);
    } else {
      console.error(`[GRAPH] Failed to fetch role for ${userEmail} (${userEntraOid}):`);
      console.error(`       Status:  ${debug.status}`);
      console.error(`       Code:    ${debug.code}`);
      console.error(`       Message: ${debug.reason}`);
      console.error(`       URL:     ${debug.failed_url}`);
    }
    
    return includeDebug ? debug : null;
  }
}

/**
 * Batch-resolves Entra roles for a list of users.
 * Runs Graph calls concurrently (with a concurrency cap to avoid throttling).
 */
export async function batchGetUserRoles(
  users: Array<{ entra_oid: string; email: string }>
): Promise<Record<string, "admin" | "hr" | "manager" | "employee" | null>> {
  const CONCURRENCY = 5;
  const results: Record<string, "admin" | "hr" | "manager" | "employee" | null> = {};

  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(u => getUserRoleFromGraph(u.entra_oid, u.email))
    );
    settled.forEach((result, idx) => {
      const oid = batch[idx].entra_oid;
      const email = batch[idx].email;
      if (result.status === "fulfilled") {
        results[oid] = result.value;
      } else {
        results[oid] = null;
        console.error(`[GRAPH] Batch failure for ${email}:`, result.reason);
      }
    });
  }

  const successCount = Object.values(results).filter(v => v !== null).length;
  const failCount = Object.values(results).filter(v => v === null).length;
  console.log(`[GRAPH] Batch resolution complete: ${successCount} success, ${failCount} fail.`);

  return results;
}
