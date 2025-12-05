
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
            isAdult
            title {
              romaji
              english
              native
            }
            description
            averageScore
            popularity
            genres
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

            // EXCLUSION LOGIC: Filter out adult content and Hentai
            if (media.isAdult) continue;
            if (media.genres?.includes('Hentai')) continue;

            const title = media.title?.english || media.title?.romaji || media.title?.native || "Unknown Title";
            const timeDate = new Date(item.airingAt * 1000);
            const timeString = timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Find streaming links
            const streamingLinks = media.externalLinks?.filter((l: any) => 
                ['Crunchyroll', 'Netflix', 'Amazon Prime Video', 'Disney+', 'Hulu', 'Funimation', 'HIDIVE', 'Bilibili'].includes(l.site)
            ) || [];

            const platformStr = streamingLinks.length > 0 
                ? streamingLinks.map((l:any) => l.site).join(', ') 
                : 'AniList';

            const officialLink = streamingLinks.length > 0 ? streamingLinks[0].url : media.siteUrl;

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
                platform: platformStr,
                link: media.siteUrl,
                deepLink: officialLink,
                rating: media.averageScore ? media.averageScore / 10 : undefined, // Convert 100 scale to 10
                popularity: media.popularity,
                subGenres: media.genres?.slice(0, 3)
            });
        }
        return validItems;
    } catch (error) {
        console.error("AniList Fetch Error:", error);
        return []; 
    }
}

// --- Trakt Fetcher ---

async function fetchTraktDaily(isoDate: string, region: string): Promise<any[]> {
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

async function fetchTmdbMovies(isoDate: string, region: string): Promise<any[]> {
    try {
        const url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&primary_release_date.gte=${isoDate}&primary_release_date.lte=${isoDate}&region=${region}&sort_by=popularity.desc&include_adult=false&include_video=false&page=1&with_release_type=3|4`;
        const res = await fetch(url);
        const data = await handleApiResponse(res, 'TMDB Movies');
        return data.results || [];
    } catch (error) {
        console.error("TMDB Movies Fetch Error:", error);
        return [];
    }
}

async function fetchTmdbTv(isoDate: string, region: string): Promise<any[]> {
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
        // Enriched fetch: watch providers for deep links (removed videos to save bandwidth)
        const url = `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

// --- Watchlist Fetcher ---

async function fetchAniListMedia(ids: number[]): Promise<ReleaseItem[]> {
  if (ids.length === 0) return [];
  
  const query = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(id_in: $ids) {
        id
        title {
          romaji
          english
          native
        }
        description
        averageScore
        popularity
        genres
        coverImage {
          extraLarge
          large
        }
        siteUrl
        nextAiringEpisode {
          airingAt
          episode
        }
        externalLinks {
          site
          url
        }
      }
    }
  }
  `;

  try {
    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { ids } })
    });
    const json = await handleApiResponse(response, 'AniList Watchlist');
    return (json.data?.Page?.media || []).map((media: any) => {
        const title = media.title?.english || media.title?.romaji || media.title?.native || "Unknown Title";
        const streamingLinks = media.externalLinks?.filter((l: any) => 
            ['Crunchyroll', 'Netflix', 'Amazon Prime Video', 'Disney+', 'Hulu', 'Funimation', 'HIDIVE', 'Bilibili'].includes(l.site)
        ) || [];
        const platformStr = streamingLinks.length > 0 ? streamingLinks.map((l:any) => l.site).join(', ') : 'AniList';
        const officialLink = streamingLinks.length > 0 ? streamingLinks[0].url : media.siteUrl;

        let timeString = 'TBA';
        let releaseDate = 'TBA';
        let timestamp = undefined;
        let episode = undefined;

        if (media.nextAiringEpisode) {
            const d = new Date(media.nextAiringEpisode.airingAt * 1000);
            timeString = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            releaseDate = d.toLocaleDateString('en-CA');
            timestamp = media.nextAiringEpisode.airingAt * 1000;
            episode = `Ep ${media.nextAiringEpisode.episode}`;
        }

        return {
            id: `anilist-${media.id}`, // We'll assume the watchlist ID was base media ID if possible, but for now we map back to generic
            title,
            category: 'Anime',
            description: media.description ? media.description.replace(/<[^>]*>?/gm, '') : 'No description available.',
            releaseDate,
            imageUrl: media.coverImage?.extraLarge || media.coverImage?.large,
            time: timeString,
            timestamp,
            episode,
            platform: platformStr,
            link: media.siteUrl,
            deepLink: officialLink,
            rating: media.averageScore ? media.averageScore / 10 : undefined,
            popularity: media.popularity,
            subGenres: media.genres?.slice(0, 3)
        } as ReleaseItem;
    });
  } catch (e) {
    console.error("AniList Watchlist Fetch Error:", e);
    return [];
  }
}

export const fetchItemsByIds = async (ids: string[], region: string = 'US'): Promise<ReleaseItem[]> => {
    const tmdbMovieIds: number[] = [];
    const tmdbTvIds: number[] = [];
    const anilistIds: number[] = [];

    ids.forEach(id => {
        if (id.startsWith('movie-')) tmdbMovieIds.push(parseInt(id.replace('movie-', '')));
        else if (id.startsWith('tv-')) tmdbTvIds.push(parseInt(id.replace('tv-', '')));
        else if (id.startsWith('anilist-')) {
            // ID format: anilist-{mediaId}-{episode} or just anilist-{mediaId}
            const parts = id.split('-');
            if (parts[1]) anilistIds.push(parseInt(parts[1]));
        }
    });

    // AniList Batch Fetch
    const animePromise = fetchAniListMedia([...new Set(anilistIds)]);

    // TMDB Movie Fetches (Individual)
    const moviePromises = tmdbMovieIds.map(async (id) => {
        const m = await fetchTmdbDetails(id, 'movie');
        if (!m) return null;
        const providers = m['watch/providers']?.results?.[region]?.flatrate?.slice(0, 2).map((p: any) => p.provider_name) || [];
        const platformStr = providers.length > 0 ? providers.join(', ') : 'Theaters / Digital';
        return {
            id: `movie-${m.id}`,
            title: m.title,
            category: 'Movie',
            description: m.overview,
            releaseDate: m.release_date,
            imageUrl: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : undefined,
            time: m.release_date, // Just date for movies usually
            platform: platformStr,
            link: `https://www.themoviedb.org/movie/${m.id}`,
            rating: m.vote_average,
            popularity: m.popularity,
            subGenres: m.genres?.map((g: any) => g.name).slice(0, 3)
        } as ReleaseItem;
    });

    // TMDB TV Fetches (Individual)
    const tvPromises = tmdbTvIds.map(async (id) => {
        const t = await fetchTmdbDetails(id, 'tv');
        if (!t) return null;
        
        const networksArr = t.networks?.slice(0, 1).map((n: any) => n.name) || [];
        const providersArr = t['watch/providers']?.results?.[region]?.flatrate?.slice(0, 2).map((p: any) => p.provider_name) || [];
        const platformsList = [...new Set([...networksArr, ...providersArr])];
        const platformStr = platformsList.length > 0 ? platformsList.join(', ') : 'TMDB';
        
        let category: Category = 'Series';
        const genres = t.genres?.map((g:any) => g.id) || [];
        const origin = t.origin_country || [];
        if (genres.includes(99)) category = 'Documentary';
        else if (genres.includes(18) && (origin.some((c: string) => ['KR', 'CN', 'TW', 'TH', 'JP'].includes(c)))) category = 'Drama';

        // Check next episode if available (TMDB doesn't always give easy next ep info in detail view without season query, 
        // but 'next_episode_to_air' field exists)
        let timeString = 'TBA';
        let releaseDate = 'TBA';
        let episode = undefined;
        let timestamp = undefined;

        if (t.next_episode_to_air) {
            const d = new Date(t.next_episode_to_air.air_date);
            releaseDate = t.next_episode_to_air.air_date;
            timeString = 'Upcoming'; 
            episode = `S${t.next_episode_to_air.season_number}E${t.next_episode_to_air.episode_number}`;
            // Timestamp might be rough since air_date is just YYYY-MM-DD usually
            timestamp = d.getTime();
        } else if (t.last_episode_to_air) {
             // Show last aired if no upcoming
             const d = new Date(t.last_episode_to_air.air_date);
             releaseDate = t.last_episode_to_air.air_date;
             timeString = 'Aired';
             episode = `S${t.last_episode_to_air.season_number}E${t.last_episode_to_air.episode_number}`;
        }

        return {
            id: `tv-${t.id}`,
            title: t.name,
            category,
            description: t.overview,
            releaseDate,
            imageUrl: t.poster_path ? `${IMAGE_BASE}${t.poster_path}` : undefined,
            time: timeString,
            timestamp,
            episode,
            platform: platformStr,
            link: `https://www.themoviedb.org/tv/${t.id}`,
            rating: t.vote_average,
            popularity: t.popularity,
            subGenres: t.genres?.map((g: any) => g.name).slice(0, 3)
        } as ReleaseItem;
    });

    const [animeItems, movies, tv] = await Promise.all([
        animePromise,
        Promise.all(moviePromises),
        Promise.all(tvPromises)
    ]);

    return [
        ...animeItems, 
        ...(movies.filter(Boolean) as ReleaseItem[]), 
        ...(tv.filter(Boolean) as ReleaseItem[])
    ];
};

// --- Main Fetcher ---

export const fetchDailyReleases = async (date: Date, region: string = 'US'): Promise<FetchResponse> => {
  const isoDate = date.toLocaleDateString('en-CA'); 

  // Parallel Execution
  const [moviesResults, tvResults, animeItems, traktResults] = await Promise.all([
      fetchTmdbMovies(isoDate, region),
      fetchTmdbTv(isoDate, region),
      fetchAniListAnime(date),
      fetchTraktDaily(isoDate, region)
  ]);

  let items: ReleaseItem[] = [...animeItems];
  const processedIds = new Set<string>(); // To deduplicate Trakt vs TMDB

  // --- Process Trakt Results ---
  const traktPromises = traktResults.map(async (item: any) => {
      const show = item.show;
      const episode = item.episode;
      const tmdbId = show.ids.tmdb;

      if (!tmdbId) return null;

      // Hydrate with TMDB Data for Image/Network
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

      // Networks & Providers
      const networksArr = tmdbData.networks?.slice(0, 1).map((n: any) => n.name) || [];
      const providersArr = tmdbData['watch/providers']?.results?.[region]?.flatrate?.slice(0, 2).map((p: any) => p.provider_name) || [];
      
      // Combine unique platforms
      const platformsList = [...new Set([...networksArr, ...providersArr])];
      const networks = platformsList.length > 0 ? platformsList.join(', ') : 'Trakt';

      processedIds.add(`tv-${tmdbId}`);

      const timeDate = new Date(item.first_aired);
      const timeString = timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Extract deep link (Use region)
      const providerLink = tmdbData['watch/providers']?.results?.[region]?.link;

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
          popularity: tmdbData.popularity,
          subGenres: genreNames.slice(0, 3)
      } as ReleaseItem;
  });

  const validTraktItems = (await Promise.all(traktPromises)).filter(Boolean) as ReleaseItem[];
  items = [...items, ...validTraktItems];

  // --- Process TMDB Movies ---
  const moviePromises = moviesResults.map(async (m: any) => {
    if (!m.id || !m.title) return null;
    if (['hi', 'te', 'ta', 'kn', 'ml'].includes(m.original_language)) return null;
    if (m.genre_ids?.includes(16) && m.original_language === 'ja') return null;

    // Fetch details for watch link
    const details = await fetchTmdbDetails(m.id, 'movie');
    const providerLink = details?.['watch/providers']?.results?.[region]?.link;
    const genreNames = details?.genres?.map((g: any) => g.name) || [];
    
    // Providers
    const providers = details?.['watch/providers']?.results?.[region]?.flatrate?.slice(0, 2).map((p: any) => p.provider_name) || [];
    const platformStr = providers.length > 0 ? providers.join(', ') : 'Theaters / Digital';

    return {
      id: `movie-${m.id}`,
      title: m.title,
      category: 'Movie',
      description: m.overview || 'No description available.',
      releaseDate: isoDate,
      imageUrl: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : undefined,
      time: 'Available Now',
      platform: platformStr,
      link: `https://www.themoviedb.org/movie/${m.id}`,
      deepLink: providerLink,
      rating: m.vote_average,
      popularity: m.popularity,
      subGenres: genreNames.slice(0, 3)
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
    
    // Combine Networks and Watch Providers
    const networksArr = details?.networks?.slice(0, 1).map((n: any) => n.name) || [];
    const providersArr = details?.['watch/providers']?.results?.[region]?.flatrate?.slice(0, 2).map((p: any) => p.provider_name) || [];
    const platformsList = [...new Set([...networksArr, ...providersArr])];
    const platformStr = platformsList.length > 0 ? platformsList.join(', ') : 'TMDB';

    const providerLink = details?.['watch/providers']?.results?.[region]?.link;
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
      platform: platformStr,
      link: `https://www.themoviedb.org/tv/${t.id}`,
      deepLink: providerLink,
      rating: t.vote_average,
      popularity: t.popularity,
      subGenres: genreNames.slice(0, 3)
    } as ReleaseItem;
  });

  const validTv = (await Promise.all(tvPromises)).filter(Boolean) as ReleaseItem[];
  items = [...items, ...validTv];

  return { items: items, groundingLinks: [] };
};
