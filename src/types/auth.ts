export interface AegisAuthUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  provider: 'google' | 'apple' | 'email' | 'guest';
  role: 'Driver' | 'RTO';
  isAnonymous?: boolean;
}

export interface UserProfileData {
  userId?: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  licenseNumber: string;
  bloodGroup: string;
  emergencyContact1: { name: string; phone: string };
  emergencyContact2: { name: string; phone: string };
  autoReport: boolean;
  guardianNotifications: boolean;
  photoURL?: string;
  updatedAt?: string;
}

export interface Guardian {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  type: 'police' | 'ambulance' | 'personal' | 'fire';
}

export interface Violation {
  id: string;
  type: 'NO_HELMET' | 'TRIPLE_RIDING' | 'FAKE_PLATE' | 'OVER_SPEEDING' | 'ACCIDENT' | 'MANUAL_REPORT';
  vehicleNumber: string;
  description: string;
  penaltyAmount: number;
  status: 'Pending' | 'Resolved' | 'Endorsed' | 'Spam';
  confidence: number;
  timestamp: any;
  photoUrl?: string;
}

export const LOCAL_AUTH_STORAGE_KEY = 'aegis_auth_user';
export const LOCAL_PROFILE_STORAGE_KEY = 'aegis_user_profile';
export const LOCAL_GUARDIANS_STORAGE_KEY = 'aegis_guardians';
export const LOCAL_CONTACTS_STORAGE_KEY = 'aegis_emergency_contacts';