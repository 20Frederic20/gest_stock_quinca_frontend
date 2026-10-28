export interface Privilege {
  id: string;
  label: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PrivilegeRequest {
  label: string;
  isDefault: boolean;
}
