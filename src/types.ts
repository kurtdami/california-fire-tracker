export interface FireFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties: {
    Name: string;
    IsActive: boolean;
    Location: string;
    AcresBurned: number;
    PercentContained: number;
    Started: string;
    Updated: string;
    County: string;
  };
}

export interface FireData {
  type: string;
  features: FireFeature[];
}

export interface EvacuationFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: Array<Array<[number, number]>>;
  };
  properties: {
    zone_id: string;
    zone_status: string;
    last_updated: number;
    zone_status_reason: string;
    county_name: string;
  };
}

export interface EvacuationData {
  type: string;
  features: EvacuationFeature[];
}