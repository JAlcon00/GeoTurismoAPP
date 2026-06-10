export type ZoneType = 'polygon' | 'polyline';

export interface Zone {
  _id: string;
  name: string;
  type: ZoneType;
  coordinates: [number, number][];
  createdBy?: { _id: string; name: string };
  createdAt: string;
}
