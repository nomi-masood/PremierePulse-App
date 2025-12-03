
export type Category = 'All' | 'Anime' | 'Drama' | 'Movie' | 'Series' | 'Documentary';

export interface ReleaseItem {
  id: string;
  title: string;
  category: Category;
  episode?: string;
  time?: string;
  timestamp?: number; // Unix timestamp in milliseconds for countdown
  platform?: string;
  description?: string;
  releaseDate: string; // ISO string YYYY-MM-DD
  imageUrl?: string;
  link?: string;
  deepLink?: string; // Direct link to streaming service
  rating?: number; // 0-10 scale
  subGenres?: string[];
  trailerKey?: string; // YouTube video ID
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