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
