// Enum for user roles
export const USER_ROLES = ["USER", "APPROVER"] as const;
export type UserRole = (typeof USER_ROLES)[number];
