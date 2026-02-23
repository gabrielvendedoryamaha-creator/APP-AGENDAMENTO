export type UserRole = 'admin' | 'seller';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export type ClientStatus = 'pending' | 'completed';

export interface Client {
  id: number;
  seller_id: number;
  name: string;
  phone: string;
  description: string;
  whatsapp_message: string | null;
  scheduled_at: string | null; // ISO string or null for 'Falar Agora'
  status: ClientStatus;
  concluded_at: string | null;
  created_at: string;
  seller_name?: string; // For admin view
}

export type ViewTab = 'HOJE' | 'SEMANA' | 'MÊS' | 'FALAR_AGORA' | 'HISTORICO';
