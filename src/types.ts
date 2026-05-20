export interface Socials {
  linkedin?: string;
  twitter?: string;
  github?: string;
  instagram?: string;
}

export interface Contact {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  organization: string;
  website: string;
  address: string;
  avatar?: string; // base64 encoding (<1.5MB)
  socials?: Socials;
  createdAt?: string;
  updatedAt?: string;
}

export interface SystemConfig {
  configured: boolean;
  mode: 'database' | 'memory';
  connected: boolean;
  dbName: string;
  error: string | null;
  uriSource?: string;
}
