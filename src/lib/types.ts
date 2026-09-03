// Enum for user roles
export const USER_ROLES = ["USER", "APPROVER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Document-number prefixes, also the `doc_type` key in `document_sequences`
export const DOCUMENT_TYPES = ["PR", "PO", "GR"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
