export type PiiCategory =
  | 'email'
  | 'phone'
  | 'aadhaar'
  | 'pan'
  | 'credit_card'
  | 'bank_account'
  | 'ip_address'
  | 'api_key'
  | 'auth_token'
  | 'username'
  | 'passport'
  | 'government_id'
  | 'license_plate'
  | 'date_of_birth'
  | 'full_address'
  | 'gps_coordinates'
  | 'person_name';

export type RawFinding = {
  category: PiiCategory;
  value: string;
  start: number;
  end: number;
  confidence: number;
};
