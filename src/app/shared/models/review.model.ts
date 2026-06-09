export interface Review {
  _id: string;
  location: { _id: string; name: string } | null;
  author: { _id: string; name: string } | null;
  rating: number;
  comment: string;
  createdAt: string;
}
