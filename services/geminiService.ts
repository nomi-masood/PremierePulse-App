import { GoogleGenAI } from "@google/genai";
import { FetchResponse, ReleaseItem } from "../types";

// Helper to generate a unique ID based on string content
const generateId = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

export const fetchDailyReleases = async (date: Date): Promise<FetchResponse> => {
  // Use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const isoDate = date.toISOString().split('T')[0];

  const prompt = `
    You are an expert media release tracker. Your goal is to identify exactly what is releasing, premiering, or being uploaded TODAY, ${formattedDate} (${isoDate}).
    
    You must use Google Search to perform a BROAD and DEEP analysis. Do not limit yourself to a single source.
    
    ### 1. SEARCH STRATEGY (Execute these types of queries):
    - **Broad Lifestyle & News**: "What to watch today ${formattedDate}", "New movies and shows releasing ${formattedDate} Vulture Collider".
    - **Streaming Updates**: "New on Netflix ${formattedDate}", "New on Disney+ ${formattedDate}", "New on Amazon Prime ${formattedDate}".
    - **Aggregators (Golden Source)**: "site:justwatch.com new ${formattedDate}", "site:tvmaze.com schedule ${formattedDate}".
    - **Anime (PRIMARY SOURCE)**: "site:myanimelist.net/anime/season/schedule", "site:senpai.moe calendar ${isoDate}", "site:animeschedule.net ${isoDate}", "site:livechart.me schedule ${formattedDate}", "Crunchyroll simulcast calendar ${formattedDate}", "site:subsplease.org schedule".
    - **Asian Drama**: "site:mydramalist.com calendar ${formattedDate}", "site:viki.com coming soon".
    - **Cinema/Theatrical**: "site:rottentomatoes.com opening this week", "site:imdb.com release dates ${formattedDate}".
    - **Community/Torrents**: "site:nyaa.si ${isoDate}", "site:en.yts-official.org ${isoDate}", "site:1337x.to ${formattedDate} movies".
    - **Databases**: "site:trakt.tv calendar ${isoDate}", "site:themoviedb.org movie ${formattedDate}".
    
    ### 2. TARGET SOURCES:
    - **Streaming**: Netflix, Amazon Prime, Disney+, Hulu, Crunchyroll, HIDIVE, Viki.
    - **Aggregators**: MyAnimeList, JustWatch, LiveChart.me, Senpai.moe, AnimeSchedule, MyDramaList, TVMaze, Rotten Tomatoes, AniList, Kitsu, AnimeNewsNetwork.
    - **Databases**: Trakt.tv, TMDB, IMDB.
    - **Community**: Nyaa.si, SubsPlease, YTS, 1337x.
    
    ### 3. STRICT REQUIREMENTS:
    - **Accuracy**: Only include items that are confirmed for TODAY. Check the year carefully.
    - **Anime (MyAnimeList API Standards)**: Prioritize data matching 'https://api.myanimelist.net/v2' standards. Look for specific episode numbers airing today. Use English titles (e.g., "Frieren") where possible.
    - **Images**: You MUST find a high-quality official poster URL for every item. Prioritize "m.media-amazon.com" (IMDB) or TMDB image links. Do not use generic site logos.
    - **Quantity**: Try to find at least 15-20 unique items across all categories (Anime, Drama, Movie).
    - **Deduplication**: Do not list the same show twice (e.g. once from Trakt, once from Nyaa) unless it is a different season/movie.
    - **Links**: You MUST provide a direct link to the official source (Netflix, Crunchyroll, IMDB page, MyAnimeList page, or Torrent page).
    
    ### 4. OUTPUT FORMAT:
    Return strictly a JSON array wrapped in a markdown code block (e.g., \`\`\`json [ ... ] \`\`\`).
    
    JSON Schema:
    {
      "title": "Show Title",
      "category": "Anime" | "Drama" | "Movie",
      "episode": "S01E05" (or 'Ep 5' for anime) or null if Movie,
      "time": "Release time (e.g. '9:00 PM EST') or 'Available now'",
      "platform": "Netflix, Crunchyroll, Nyaa, YTS, Viki, MyAnimeList, etc.",
      "description": "Brief, engaging 1-sentence synopsis.",
      "imageUrl": "High-res URL of the official poster.",
      "link": "Official URL for the release (e.g. Netflix, Crunchyroll, IMDB page, or Torrent page)"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // responseMimeType cannot be JSON when using tools, so we parse manually
      },
    });

    const text = response.text || "";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Extract JSON from code block with case-insensitive robust regex
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    
    let items: ReleaseItem[] = [];
    
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) {
          items = parsed.map((item: any) => ({
            id: generateId(item.title + (item.episode || '') + item.category),
            title: item.title,
            category: item.category,
            episode: item.episode || undefined,
            time: item.time,
            platform: item.platform,
            description: item.description,
            releaseDate: isoDate,
            imageUrl: item.imageUrl,
            link: item.link
          }));
        }
      } catch (e) {
        console.error("Failed to parse JSON from model response:", e);
        // We return empty items if parse fails, effectively triggering the error UI in App if items length is 0 (handled by caller catching usually, or just empty list)
      }
    }

    // Extract valid links from grounding metadata
    const groundingLinks = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        web: {
          uri: chunk.web.uri,
          title: chunk.web.title
        }
      }));

    return { items, groundingLinks };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};