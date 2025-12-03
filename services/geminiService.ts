
import { FetchResponse, ReleaseItem, Category } from "../types";

// Explicitly requested API Key
const TMDB_API_KEY = '5a6d92f26bf1d9292a7a8a261621aef3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Trakt API Configuration
const TRAKT_CLIENT_ID = 'YOUR_TRAKT_CLIENT_ID_HERE'; 
const TRAKT_API_URL = 'https://api.trakt.tv';

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
            averageScore
            genres
            trailer {
              id
              site
            }
            externalLinks {
              site
              url
            }
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
        
        if (!json.data?.Page?.airingSchedules || !Array.isArray(json.data.Page.airingSchedules)) {
            return [];
        }

        const validItems: ReleaseItem[] = [];

        for (const item of json.data.Page.airingSchedules) {
            const media = item.media;
            if (!media || !media.id) continue;

            const title = media.title?.english || media.title?.romaji || media.title?.native || "Unknown Title";
            const timeDate = new Date(item.airingAt * 1000);
            const timeString = timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Find a streaming link (prioritize Crunchyroll/Netflix/Official)
            const officialLink = media.externalLinks?.find((l: any) => 
                ['Crunchyroll', 'Netflix', 'Amazon', 'Disney Plus', 'Hulu'].includes(l.site)
            )?.url || media.siteUrl;

            validItems.push({
                id: `anilist-${media.id}-${item.episode}`,
                title: title,
                category: 'Anime',
                description: media.description ? media.description.replace(/<[^>]*>?/gm, '') : 'No description available.', 
                releaseDate: timeDate.toLocaleDateString('en-CA'),
                imageUrl: media.coverImage?.extraLarge || media.coverImage?.large,
                time: timeString,
                timestamp: item.airingAt * 1000,
                episode: `Ep ${item.episode}`,
                platform: 'AniList',
                link: media.siteUrl,
                deepLink: officialLink,
                rating: media.averageScore ? media.averageScore / 10 : undefined, // Convert 100 scale to 10
                subGenres: media.genres?.slice(0, 3),
                trailerKey: media.trailer?.site === 'youtube' ? media.trailer.id : undefined
            });
        }
        return validItems;
    } catch (error) {
        console.error("AniList Fetch Error:", error);
        return []; 
    }
}

// --- Trakt Fetcher ---

async function fetchTraktDaily(isoDate: string): Promise<any[]> {
    if (TRAKT_CLIENT_ID === 'YOUR_TRAKT_CLIENT_ID_HERE') {
        return [];
    }

    try {
        const url = `${TRAKT_API_URL}/calendars/all/shows/${isoDate}/1`;
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'trakt-api-version': '2',
                'trakt-api-key': TRAKT_CLIENT_ID
            }
        });

        const data = await handleApiResponse(response, 'Trakt');
        return data || [];
    } catch (error) {
        console.warn("Trakt Fetch Error:", error);
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

async function fetchTmdbDetails(id: number, type: 'tv' | 'movie' = 'tv'): Promise<any> {
    try {
        // Enriched fetch: videos for trailers, watch providers for deep links
        const url = `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=videos,watch/providers`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

// --- Main Fetcher ---

export const fetchDailyReleases = async (date: Date): Promise<FetchResponse> => {
  const isoDate = date.toLocaleDateString('en-CA'); 

  // Parallel Execution
  const [moviesResults, tvResults, animeItems, traktResults] = await Promise.all([
      fetchTmdbMovies(isoDate),
      fetchTmdbTv(isoDate),
      fetchAniListAnime(date),
      fetchTraktDaily(isoDate)
  ]);

  let items: ReleaseItem[] = [...animeItems];
  const processedIds = new Set<string>(); // To deduplicate Trakt vs TMDB

  // --- Process Trakt Results ---
  const traktPromises = traktResults.map(async (item: any) => {
      const show = item.show;
      const episode = item.episode;
      const tmdbId = show.ids.tmdb;

      if (!tmdbId) return null;

      // Hydrate with TMDB Data for Image/Network/Trailers
      const tmdbData = await fetchTmdbDetails(tmdbId, 'tv');
      if (!tmdbData) return null;

      const origin = tmdbData.origin_country || [];
      if (origin.includes('IN')) return null;

      const genres = tmdbData.genres?.map((g: any) => g.id) || [];
      const genreNames = tmdbData.genres?.map((g: any) => g.name) || [];
      const isAnime = genres.includes(16) && origin.includes('JP');
      
      if (isAnime) return null;

      let category: Category = 'Series';
      if (genres.includes(99)) category = 'Documentary';
      else if (genres.includes(18) && origin.some((c: string) => ['KR', 'CN', 'TW', 'TH', 'JP'].includes(c))) category = 'Drama';

      const networks = tmdbData.networks?.slice(0, 2).map((n: any) => n.name).join(', ') || 'Trakt';

      processedIds.add(`tv-${tmdbId}`);

      const timeDate = new Date(item.first_aired);
      const timeString = timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Extract trailer
      const trailer = tmdbData.videos?.results?.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') 
        || tmdbData.videos?.results?.find((v: any) => v.site === 'YouTube');

      // Extract deep link (US as default region)
      const providerLink = tmdbData['watch/providers']?.results?.US?.link;

      return {
          id: `tv-${tmdbId}`,
          title: show.title,
          category,
          description: tmdbData.overview || show.overview || 'No description available.',
          releaseDate: isoDate,
          imageUrl: tmdbData.poster_path ? `${IMAGE_BASE}${tmdbData.poster_path}` : undefined,
          time: timeString,
          timestamp: timeDate.getTime(),
          episode: `S${episode.season}E${episode.number}`,
          platform: networks,
          link: `https://trakt.tv/shows/${show.ids.slug}`,
          deepLink: providerLink,
          rating: tmdbData.vote_average,
          subGenres: genreNames.slice(0, 3),
          trailerKey: trailer?.key
      } as ReleaseItem;
  });

  const validTraktItems = (await Promise.all(traktPromises)).filter(Boolean) as ReleaseItem[];
  items = [...items, ...validTraktItems];

  // --- Process TMDB Movies ---
  const moviePromises = moviesResults.map(async (m: any) => {
    if (!m.id || !m.title) return null;
    if (['hi', 'te', 'ta', 'kn', 'ml'].includes(m.original_language)) return null;
    if (m.genre_ids?.includes(16) && m.original_language === 'ja') return null;

    // Fetch details for trailer/watch link
    const details = await fetchTmdbDetails(m.id, 'movie');
    const trailer = details?.videos?.results?.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer')
        || details?.videos?.results?.find((v: any) => v.site === 'YouTube');
    const providerLink = details?.['watch/providers']?.results?.US?.link;
    const genreNames = details?.genres?.map((g: any) => g.name) || [];

    return {
      id: `movie-${m.id}`,
      title: m.title,
      category: 'Movie',
      description: m.overview || 'No description available.',
      releaseDate: isoDate,
      imageUrl: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : undefined,
      time: 'Available Now',
      platform: 'Theaters / Digital', 
      link: `https://www.themoviedb.org/movie/${m.id}`,
      deepLink: providerLink,
      rating: m.vote_average,
      subGenres: genreNames.slice(0, 3),
      trailerKey: trailer?.key
    } as ReleaseItem;
  });
  
  const validMovies = (await Promise.all(moviePromises)).filter(Boolean) as ReleaseItem[];
  items = [...items, ...validMovies];

  // --- Process TMDB TV (Supplement) ---
  const tvPromises = tvResults.map(async (t: any) => {
    if (!t.id || !t.name) return null;
    if (processedIds.has(`tv-${t.id}`)) return null;

    const origin = t.origin_country || [];
    if (origin.includes('IN')) return null;

    const genres = t.genre_ids || [];
    const isAnime = genres.includes(16) && origin.includes('JP');
    if (isAnime) return null;

    let category: Category = 'Series';
    if (genres.includes(99)) {
      category = 'Documentary';
    } else if (
        genres.includes(18) && 
        (origin.some((c: string) => ['KR', 'CN', 'TW', 'TH', 'JP'].includes(c)))
    ) {
      category = 'Drama';
    }

    // Enrich
    const details = await fetchTmdbDetails(t.id, 'tv');
    const networks = details?.networks?.slice(0, 2).map((n: any) => n.name).join(', ') || 'TMDB';
    const trailer = details?.videos?.results?.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
    const providerLink = details?.['watch/providers']?.results?.US?.link;
    const genreNames = details?.genres?.map((g: any) => g.name) || [];

    return {
      id: `tv-${t.id}`,
      title: t.name,
      category,
      description: t.overview || 'No description available.',
      releaseDate: isoDate,
      imageUrl: t.poster_path ? `${IMAGE_BASE}${t.poster_path}` : undefined,
      time: 'New Episode',
      episode: 'New',
      platform: networks,
      link: `https://www.themoviedb.org/tv/${t.id}`,
      deepLink: providerLink,
      rating: t.vote_average,
      subGenres: genreNames.slice(0, 3),
      trailerKey: trailer?.key
    } as ReleaseItem;
  });

  const validTv = (await Promise.all(tvPromises)).filter(Boolean) as ReleaseItem[];
  items = [...items, ...validTv];

  return { items: items, groundingLinks: [] };
};
