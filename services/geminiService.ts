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

// Helper for delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchDailyReleases = async (date: Date): Promise<FetchResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const isoDate = date.toISOString().split('T')[0];

  // Optimized prompt to act as an API aggregator for specific sources
  const prompt = `
    Act as a real-time API aggregator for entertainment releases. 
    Fetch the confirmed schedule for TODAY, ${formattedDate} (${isoDate}).
    
    Strictly aggregate data ONLY from these specific reliable sources:
    
    1. **TMDB** (The Movie Database):
       - Search "site:themoviedb.org movie release date ${isoDate}" OR "site:themoviedb.org tv episode air date ${isoDate}".
    
    2. **AniList & MyAnimeList** (Anime):
       - Search "site:anilist.co airing schedule ${isoDate}" OR "site:myanimelist.net anime schedule ${isoDate}".
       - Look for specific episode numbers airing today.
    
    3. **Viki** (Asian Dramas):
       - Search "site:viki.com on air ${isoDate}" OR "site:viki.com schedule ${isoDate}".
    
    4. **Streaming Services** (Netflix, Disney+, Amazon Prime):
       - Search "New on Netflix ${formattedDate}" AND "New on Disney+ ${formattedDate}" AND "New on Amazon Prime ${formattedDate}".
    
    STRICT DATA RULES:
    - **Exclusions**: Do NOT include Indian, Telugu, Bollywood, or Tollywood content.
    - **Date Match**: Only include items releasing TODAY (${isoDate}). 
    - **Full Titles**: Use official English titles (e.g., "Attack on Titan Final Season" not just "AOT").
    - **Images**: You MUST find a specific poster URL (prioritize images from tmdb.org, myanimelist.net, or m.media-amazon).
    - **Links**: Provide the direct link to the source (TMDB, AniList, Viki, etc.).
    - **Diversity**: ensure a mix of Anime, Dramas, Movies, and TV Series found on these specific platforms.
    - **Volume**: Return 15-20 high-quality items.
    
    Return strictly a JSON array. If using markdown, use \`\`\`json.
    
    JSON Schema:
    {
      "title": "Full English Title",
      "category": "Anime" | "Drama" | "Movie" | "Series" | "Documentary",
      "episode": "S01E01" or null,
      "time": "Time (e.g. 9pm EST) or 'Now'",
      "platform": "Netflix, Viki, Amazon, Disney+, etc.",
      "description": "One short sentence.",
      "imageUrl": "URL",
      "link": "URL"
    }
  `;

  let retries = 3;
  let delay = 2000;

  while (true) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "";
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      // Improved Parsing Logic
      let items: ReleaseItem[] = [];
      let jsonString = "";

      // 1. Try to find markdown block
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
      
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
      } else {
        // 2. Fallback: Try to find array brackets in raw text
        const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
            jsonString = arrayMatch[0];
        } else {
            // 3. Last resort: assume the whole text is JSON if it starts with [
            if (text.trim().startsWith('[')) {
                jsonString = text;
            }
        }
      }
      
      if (jsonString) {
        try {
          // Clean potential trailing commas or markdown artifacts before parsing
          const cleanJson = jsonString.replace(/,\s*([\]}])/g, '$1');
          const parsed = JSON.parse(cleanJson);
          
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
          console.warn("JSON Parse Error (Attempted cleaning):", e);
          console.debug("Failed JSON String:", jsonString);
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

    } catch (error: any) {
      const isRateLimit = 
        error?.status === 429 || 
        error?.code === 429 || 
        error?.message?.includes('429') || 
        error?.message?.includes('Quota') ||
        error?.message?.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit && retries > 0) {
        console.warn(`Gemini API Rate Limit hit. Retrying in ${delay}ms...`);
        await wait(delay);
        retries--;
        delay *= 2; 
        continue;
      }

      console.error("Gemini API Error:", error);
      throw error;
    }
  }
};