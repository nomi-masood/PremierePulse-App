
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
  rating?: number; // 0-10 scale (TMDB/AniList)
  imdbRating?: number; // 0-10 scale (IMDB)
  imdbId?: string;
  popularity?: number; // For sorting
  subGenres?: string[];
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

export interface AppSettings {
  notificationsEnabled: boolean;
  alertTiming: 'at-release' | '15-min-before' | '1-hour-before';
  soundEnabled: boolean;
  region: string; // ISO 3166-1 alpha-2 code (e.g., 'US', 'GB')
}
