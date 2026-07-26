export type WasteType = 'general' | 'recycling' | 'garden' | 'food';

export type Collection = {
  id: string;
  date: string;
  wasteType: WasteType;
  source: 'council';
};

export type SavedAddress = {
  id: string;
  label: string;
  line1: string;
  postcode: string;
  councilName: string;
  providerId: string;
  councilAddressId?: string;
  isPrimary: boolean;
  latitude?: number;
  longitude?: number;
};

export type CouncilAddressOption = {
  id: string;
  line1: string;
  postcode: string;
};

export type CouncilService = {
  id: string;
  name: string;
  type: 'recycling-centre' | 'recycling-point' | 'reuse' | 'collection';
  address?: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  source: 'council' | 'openstreetmap';
  website?: string;
};

export type NotificationPreferences = {
  enabled: boolean;
  reminderHour: number;
  reminderDayOffset: 0 | 1;
  wasteTypes: Record<WasteType, boolean>;
};

export type ProviderResult = {
  councilName: string;
  providerId: string;
  collections: Collection[];
  verifiedAt: string;
  notice?: string;
};
