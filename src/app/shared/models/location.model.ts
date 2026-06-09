export interface Category {
  _id: string;
  name: string;
  description?: string;
  icon: string;
}

export interface Location {
  _id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  category?: Category;
  createdAt: string;
}
