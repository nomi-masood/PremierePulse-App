export type Category = 'All' | 'Anime' | 'Drama' | 'Movie';

export interface ReleaseItem {
  id: string;
  title: string;
  category: 'Anime' | 'Drama' | 'Movie';
  episode?: string;
  time?: string;
  platform?: string;
  description?: string;
  releaseDate: string; // ISO string YYYY-MM-DD
  imageUrl?: string;
  link?: string;
}

export interface GroundingMetadata {
  web: {
    uri: string;
    title: string;
  };
}

export interface FetchResponse {
  items: ReleaseItem[];
  groundingLinks: GroundingMetadata[];
}