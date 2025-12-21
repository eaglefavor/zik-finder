export type UserRole = 'student' | 'landlord' | 'admin';

export interface Profile {
  id: string;
  role: UserRole;
  phone_number: string | null;
  is_verified: boolean;
  name?: string; // Metadata from Auth
  email?: string; // Metadata from Auth
}

export interface Lodge {
  id: string;
  landlord_id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  amenities: string[];
  image_urls: string[];
  status: 'available' | 'taken';
  created_at: string;
  // Joined data
  profiles?: {
    phone_number: string;
    is_verified: boolean;
  };
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
