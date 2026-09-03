// Enum for user roles
export const USER_ROLES = ["USER", "APPROVER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Document types 
export const DOCUMENT_TYPES = ["PR", "PO", "GR"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// Inventory movement types
export const MOVEMENT_TYPES = ["PURCHASE_RECEIPT"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

// Reference types for inventory movements
export const MOVEMENT_REFERENCE_TYPES = ["GOODS_RECEIPT"] as const;
export type MovementReferenceType = (typeof MOVEMENT_REFERENCE_TYPES)[number];
