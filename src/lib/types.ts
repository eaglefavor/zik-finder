export type UserRole = 'student' | 'landlord' | 'admin';

export interface Profile {
  id: string;
  role: UserRole;
  phone_number: string | null;
  is_verified: boolean;
  avatar_url?: string | null;
  name?: string; // Metadata from Auth
  email?: string; // Metadata from Auth
}

export interface LodgeUnit {
  id: string;
  lodge_id: string;
  name: string;
  price: number;
  total_units: number;
  available_units: number;
  image_urls: string[];
}

export interface Lodge {
  id: string;
  landlord_id: string;
  title: string;
  description: string;
  price: number; // Kept for display/sorting (min price)
  location: string;
  amenities: string[];
  image_urls: string[];
  status: 'available' | 'taken';
  views?: number;
  created_at: string;
  // Joined data
  profiles?: {
    phone_number: string;
    is_verified: boolean;
  };
  units?: LodgeUnit[]; // New: List of room types
}

export interface LodgeRequest {

  id: string;

  student_id: string;

  student_name: string;

  student_phone: string;

  budget_range: string;

  location: string;

  description: string;

  created_at: string;

}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  link?: string;
  created_at: string;
}