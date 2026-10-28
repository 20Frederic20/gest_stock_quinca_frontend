export type Role = 'ADMIN' | 'MANAGER' | 'SELLER' | 'CASHIER';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Responsable d’agence',
  SELLER: 'Vendeur',
  CASHIER: 'Caissier',
};

/** The logged-in user, as returned by /auth/login and /auth/me. */
export interface CurrentUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  agencyId: string;
  agencyLabel: string;
}

export interface User {
  id: string;
  name: string;
  /** Stored in lower case by the backend. */
  username: string;
  role: Role;
  /** Maximum discount this user may grant, in percent (0 to 100). */
  discountLimit: number;
  active: boolean;
  agencyId: string;
  agencyLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRequest {
  name: string;
  username: string;
  password: string;
  role: Role;
  discountLimit: number;
  agencyId: string;
}

/** Same as UserRequest without the password, which has its own endpoints. */
export type UserUpdateRequest = Omit<UserRequest, 'password'>;
