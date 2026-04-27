import type { Configuration, PopupRequest } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const redirectUri = import.meta.env.VITE_REDIRECT_URI || "http://localhost:5173";

console.log("Frontend MSAL Config:", {
  tenantId,
  clientId,
  redirectUri
});

if (!tenantId || !clientId) {
  throw new Error("Missing Microsoft Entra frontend env variables (VITE_ENTRA_TENANT_ID or VITE_ENTRA_CLIENT_ID)");
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const loginRequest: PopupRequest = {
  scopes: ["User.Read", "Files.Read", "Mail.Send"],
};

export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
  graphOneDriveEndpoint: "https://graph.microsoft.com/v1.0/me/drive/root/children",
  graphSendMailEndpoint: "https://graph.microsoft.com/v1.0/me/sendMail",
};
