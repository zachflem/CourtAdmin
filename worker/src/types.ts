export interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  RESEND_API_KEY: string;
  CF_ACCESS_AUD: string;
  FRONTEND_URL: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address: string | null;
  emergency_contact: string | null;
  medical_info: string | null;
  gender: string | null;
  grading_level: number | null;
  jersey_number: number | null;
  age_group: string | null;
  clearance_required: number;
  clearance_status: string | null;
  previous_club: string | null;
  previous_team: string | null;
  previous_coach: string | null;
  first_year_registered: string | null;
  is_active: number;
  roles: string; // JSON string, e.g. '["admin","committee"]'
  created_at: string;
  updated_at: string;
}

export type Role = 'admin' | 'committee' | 'coach' | 'manager' | 'player' | 'parent';

export interface HonoVariables {
  user: User;
}
