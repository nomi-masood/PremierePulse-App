
import { FetchResponse, ReleaseItem, Category } from "../types";

// Explicitly requested API Key
const TMDB_API_KEY = '5a6d92f26bf1d9292a7a8a261621aef3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const ANILIST_API_URL = 'https://graphql.anilist.co';

// --- Helper: Error Handling ---

class ApiError extends Error {
  constructor(public statusCode: number, message: string, public source: string) {
    super(`[${source}] ${statusCode}: ${message}`);
    this.name = 'ApiError';
  }
}

async function handleApiResponse(response: Response, source: string) {
  if (!response.ok) {
    if (response.status === 401) throw new ApiError(401, 'Unauthorized - Invalid API Key', source);
    if (response.status === 404) throw new ApiError(404, 'Resource Not Found', source);
    if (response.status === 429) throw new ApiError(429, 'Rate Limit Exceeded', source);
    if (response.status >= 500) throw new ApiError(response.status, 'Server Error', source);
    throw new ApiError(response.status, 'Unknown Error', source);
  }
  return response.json();
}

// --- AniList Fetcher ---

async function fetchAniListAnime(date: Date): Promise<ReleaseItem[]> {
    // Determine start and end of the day in Unix timestamp (User Local Time)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
    const endTimestamp = Math.floor(endOfDay.getTime() / 1000);

    const query = `
    query ($start: Int, $end: Int) {
      Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id
          episode
          airingAt
          media {
            id
            idMal
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              large
              extraLarge
            }
            siteUrl
            countryOfOrigin
            format
          }
        }
      }
    }
    `;

    try {
        const response = await fetch(ANILIST_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables: {
                    start: startTimestamp,
                    end: endTimestamp
                }
            })
        });

        const json = await handleApiResponse(response, 'AniList');
        
        // Validate GraphQL structure
        if (!json.data?.Page?.airingSchedules || !Array.isArray(json.data.Page.airingSchedules)) {
            console.warn("AniList response malformed or empty");
            return [];
        }

        const validItems: ReleaseItem[] = [];

        for (const item of json.data.Page.airingSchedules) {
            const media = item.media;
            
            // Validation: Skip items with missing critical data
            if (!media || !media.id) continue;

            const title = media.title?.english || media.title?.romaji || media.title?.native || "Unknown Title";
            const timeDate = new Date(item.airingAt * 1000);
            const timeString = timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            validItems.push({
                id: `anilist-${media.id}-${item.episode}`,
                title: title,
                category: 'Anime',
                description: media.description ? media.description.replace(/<[^>]*>?/gm, '') : 'No description available.', // Strip HTML
                releaseDate: timeDate.toLocaleDateString('en-CA'),
                imageUrl: media.coverImage?.extraLarge || media.coverImage?.large,
                time: timeString,
                episode: `Ep ${item.episode}`,
                platform: 'AniList',
                link: media.siteUrl || `https://myanimelist.net/anime/${media.idMal}`
            });
        }

        return validItems;

    } catch (error) {
        console.error("AniList Fetch Error:", error);
        // Return empty array on failure so TMDB data can still load
        return []; 
    }
}

// --- TMDB Helper Fetchers ---

async function fetchTmdbMovies(isoDate: string): Promise<any[]> {
    try {
        const url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&primary_release_date.gte=${isoDate}&primary_release_date.lte=${isoDate}&sort_by=popularity.desc&include_adult=false&include_video=false&page=1&with_release_type=3|4`;
        const res = await fetch(url);
        const data = await handleApiResponse(res, 'TMDB Movies');
        return data.results || [];
    } catch (error) {
        console.error("TMDB Movies Fetch Error:", error);
        return [];
    }
}

async function fetchTmdbTv(isoDate: string): Promise<any[]> {
    try {
        const url = `${TMDB_BASE_URL}/tv/airing_today?api_key=${TMDB_API_KEY}&air_date=${isoDate}&sort_by=popularity.desc&include_adult=false&page=1&timezone=America/New_York`;
        const res = await fetch(url);
        const data = await handleApiResponse(res, 'TMDB TV');
        return data.results || [];
    } catch (error) {
        console.error("TMDB TV Fetch Error:", error);
        return [];
    }
}

async function fetchTmdbDetails(id: number): Promise<any> {
    try {
        const url = `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`;
        const res = await fetch(url);
        // Fail silently for enrichment
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

// --- Main Fetcher ---

export const fetchDailyReleases = async (date: Date): Promise<FetchResponse> => {
  // Format date as YYYY-MM-DD for TMDB API queries
  const isoDate = date.toLocaleDateString('en-CA'); 

  // Parallel Execution with isolated error handling
  const [moviesResults, tvResults, animeItems] = await Promise.all([
      fetchTmdbMovies(isoDate),
      fetchTmdbTv(isoDate),
      fetchAniListAnime(date)
  ]);

  let items: ReleaseItem[] = [...animeItems]; 

  // --- Process TMDB Movies ---
  moviesResults.forEach((m: any) => {
    // Validation
    if (!m.id || !m.title) return;

    // Filter out Indian content
    if (['hi', 'te', 'ta', 'kn', 'ml'].includes(m.original_language)) return;
    
    // Exclude strictly "Animation" + "Japan" movies from TMDB to avoid AniList dupes
    if (m.genre_ids?.includes(16) && m.original_language === 'ja') return;

    items.push({
      id: `movie-${m.id}`,
      title: m.title,
      category: 'Movie',
      description: m.overview || 'No description available.',
      releaseDate: isoDate,
      imageUrl: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : undefined,
      time: 'Available Now',
      platform: 'Theaters / Digital', 
      link: `https://www.themoviedb.org/movie/${m.id}`
    });
  });

  // --- Process TMDB TV (Dramas, Series, Docs) ---
  tvResults.forEach((t: any) => {
    // Validation
    if (!t.id || !t.name) return;

    const origin = t.origin_country || [];
    // Filter out Indian content
    if (origin.includes('IN')) return;

    const genres = t.genre_ids || [];
    
    // Detect Anime (Animation + JP)
    const isAnime = genres.includes(16) && origin.includes('JP');
    
    // Skip Anime from TMDB results (We rely on AniList)
    if (isAnime) return;

    // Default category to Series (for US, UK, Western TV, etc.)
    let category: Category = 'Series';

    // Categorization Logic
    if (genres.includes(99)) {
      category = 'Documentary';
    } else if (
        genres.includes(18) && 
        (origin.some((c: string) => ['KR', 'CN', 'TW', 'TH', 'JP'].includes(c)))
    ) {
      // If it is a Drama (ID 18) from Korea, China, Taiwan, Thailand, or Japan(Live Action), categorize as Drama
      category = 'Drama';
    }

    items.push({
      id: `tv-${t.id}`,
      title: t.name,
      category,
      description: t.overview || 'No description available.',
      releaseDate: isoDate,
      imageUrl: t.poster_path ? `${IMAGE_BASE}${t.poster_path}` : undefined,
      time: 'New Episode',
      episode: 'New',
      platform: 'TMDB', 
      link: `https://www.themoviedb.org/tv/${t.id}`
    });
  });

  // --- 3. Enrich TV Items with Network Data ---
  // We process this in chunks to avoid hitting rate limits if there are many items
  const enrichItem = async (item: ReleaseItem): Promise<ReleaseItem> => {
      // Only enrich TMDB TV items
      if (!item.id.startsWith('tv-')) return item;

      const tmdbId = parseInt(item.id.split('-')[1]);
      if (isNaN(tmdbId)) return item;

      const details = await fetchTmdbDetails(tmdbId);
      
      if (details && details.networks && details.networks.length > 0) {
          const networks = details.networks.slice(0, 2).map((n: any) => n.name).join(', ');
          return { ...item, platform: networks };
      }
      return item;
  };

  const enrichedItems = await Promise.all(items.map(enrichItem));

  return { items: enrichedItems, groundingLinks: [] };
};
