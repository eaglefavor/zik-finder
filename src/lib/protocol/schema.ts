export const LODGE_KEYS = {
  id: 0,
  created_at: 1,
  updated_at: 2,
  title: 3,
  description: 4,
  price: 5,
  location: 6,
  image_urls: 7,
  image_blurhashes: 8,
  landlord_id: 9,
  status: 10,
  amenities: 11,
  landmark: 12,
  promoted_until: 13,
  views: 14,
  profile_data: 15,
  units_data: 16,
  landlord_z_score: 17,
  _delta: 18,
} as const;

// Reverse map for decoding
export const LODGE_KEYS_REVERSE = Object.fromEntries(
  Object.entries(LODGE_KEYS).map(([k, v]) => [v, k])
);
