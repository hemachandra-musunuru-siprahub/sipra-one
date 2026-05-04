import { api } from "./client";
import type { HrDocument } from "./types";

export const getDocuments = () =>
  api.get<{ documents: HrDocument[] }>("/api/hr-documents");

export const getDocumentById = (id: string) =>
  api.get<{ document: HrDocument }>(`/api/hr-documents/${id}`);

export const createDocument = (data: {
  title: string;
  description?: string;
  documentType: string;
  scope: "company" | "individual";
  onedriveUrl: string;
  assignedToOid?: string;
}) => api.post<{ document: HrDocument }>("/api/hr-documents", data);

export const updateDocument = (id: string, data: {
  title?: string;
  description?: string;
  onedrive_url?: string;
  scope?: "company" | "individual";
  assigned_to_oid?: string;
}) => api.patch<{ document: HrDocument }>(`/api/hr-documents/${id}`, data);

export const deleteDocument = (id: string) => api.delete(`/api/hr-documents/${id}`);

/**
 * Share a OneDrive file with one or more employees.
 * The backend stores the metadata and returns a document record per recipient.
 */
export const shareDocument = (data: {
  fileName: string;
  onedriveUrl: string;
  driveItemId?: string;
  documentType: string;
  description?: string;
  recipientOids: string[];   // one or more employee OIDs
}) => api.post<{ documents: HrDocument[] }>("/api/hr-documents/share", data);

// ─── Graph API helpers (client-side, uses MSAL access token) ─────────────────

/** Browse the root of the logged-in user's OneDrive (folders + files). */
export const browseOneDrive = async (
  accessToken: string,
  folderId?: string   // undefined = root
): Promise<{ id: string; name: string; isFolder: boolean; webUrl: string; size?: number }[]> => {
  const url = folderId
    ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`
    : "https://graph.microsoft.com/v1.0/me/drive/root/children";
  const res = await fetch(`${url}?$select=id,name,file,folder,webUrl,size&$orderby=name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`OneDrive browse failed: ${res.status}`);
  const data = await res.json();
  return (data.value || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    isFolder: !!item.folder,
    webUrl: item.webUrl,
    size: item.size,
  }));
};

/** Search the user's OneDrive for files matching a query. */
export const searchOneDrive = async (
  accessToken: string,
  query: string
): Promise<{ id: string; name: string; isFolder: boolean; webUrl: string; size?: number }[]> => {
  const url = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')?$select=id,name,file,folder,webUrl,size&$top=30`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`OneDrive search failed: ${res.status}`);
  const data = await res.json();
  return (data.value || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    isFolder: !!item.folder,
    webUrl: item.webUrl,
    size: item.size,
  }));
};

/**
 * Create a shareable "view" link for a specific OneDrive item via Graph API.
 * Returns the sharing URL if successful, falls back to webUrl.
 */
export const createShareLink = async (
  accessToken: string,
  itemId: string,
  webUrl: string
): Promise<string> => {
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/createLink`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "view", scope: "organization" }),
      }
    );
    if (!res.ok) return webUrl;
    const data = await res.json();
    return data.link?.webUrl || webUrl;
  } catch {
    return webUrl;
  }
};

