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
  image_blurhashes?: string[]; // Added
}

export interface Lodge {
  id: string;
  created_at: string;
  updated_at?: string; // Support Delta Sync
  title: string;
  description: string;
  price: number;
  location: string;
  image_urls: string[];
  image_blurhashes?: string[]; // Added
  landlord_id: string;
  status: 'available' | 'taken' | 'suspended';
  amenities: string[];
  landmark?: string;
  promoted_until?: string; // ISO timestamp
  
  // Joins
  profiles?: Profile;
  units?: LodgeUnit[];
  landlord_z_score?: number;
  
  // Computed
  views?: number;
}

export interface LodgeRequest {
  id: string;
  student_id: string;
  student_name: string;
  student_phone: string;
  budget_range: string; // Keep for legacy
  min_budget?: number;
  max_budget?: number;
  location: string; // Keep for legacy
  locations?: string[];
  description: string;
  is_urgent?: boolean;
  created_at: string;
  expires_at: string;
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

export interface VerificationDoc {
  id: string;
  landlord_id: string;
  id_card_path: string;
  status: 'pending' | 'approved';
  payment_reference?: string;
  payment_status?: 'pending' | 'success' | 'failed';
  created_at: string;
}

export interface MonetizationTransaction {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  reference: string;
  purpose: 'verification_fee' | 'urgent_request' | 'promoted_listing';
  metadata?: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
}

// --- ZIPS 5.0 Roommate Matcher Types ---

export interface RoommateHabits {
  smoke: boolean;
  cook: boolean;
  guests: 'no_overnight' | 'weekends' | 'anytime';
  study_time: 'early_bird' | 'night_owl' | 'flexible';
  cleanliness: 'relaxed' | 'standard' | 'strict';
  pets: boolean;
}

export interface RoommateProfile {
  user_id: string;
  gender: 'Male' | 'Female';
  department: string;
  level: string;
  habits: RoommateHabits;
  bio: string;
  is_student_verified: boolean;
  student_id_url?: string;
  created_at: string;
}

export interface RoommateListing {
  id: string;
  user_id: string;
  type: 'have_room' | 'need_room';
  location_area: string;
  landmark?: string;
  exact_address_notes?: string;
  rent_per_person: number;
  payment_period: string;
  images: string[];
  description: string;
  linked_lodge_id?: string;
  expires_at: string;
  status: 'active' | 'filled' | 'expired' | 'closed';
  created_at: string;
  
  // Joins
  profiles?: Profile;
  roommate_profiles?: RoommateProfile;
}

export interface RoommateConnection {
  id: string;
  host_id: string;
  seeker_id: string;
  listing_id: string;
  status: 'pending' | 'accepted' | 'declined';
  seeker_safety_acknowledged: boolean;
  created_at: string;
  accepted_at?: string;
  
  // Joins
  host?: Profile;
  seeker?: Profile;
  listing?: RoommateListing;
}