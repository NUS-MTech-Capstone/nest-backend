export interface AuthUser {
  sub: string;
  username: string;
  email?: string;
  name?: string;
  roles: string[];
}

export interface DevUser {
  username: string;
  name: string;
  email: string;
  roles: string[];
}
