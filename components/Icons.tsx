
import React, { ComponentProps } from 'react';
import { 
  Clapperboard, 
  Tv, 
  Film, 
  Calendar, 
  Bell, 
  CheckCircle, 
  Search, 
  Loader2,
  ExternalLink,
  Info,
  Clock,
  Settings,
  X,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  WifiOff,
  RefreshCw,
  MonitorPlay,
  Video,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Star,
  Globe,
  ArrowUpDown,
  Share2,
  Check
} from 'lucide-react';

// Wrapper components to accept all props (style, title, etc.)
export const IconAnime = (props: ComponentProps<typeof Tv>) => <Tv {...props} />;
export const IconDrama = (props: ComponentProps<typeof Clapperboard>) => <Clapperboard {...props} />;
export const IconMovie = (props: ComponentProps<typeof Film>) => <Film {...props} />;
export const IconSeries = (props: ComponentProps<typeof MonitorPlay>) => <MonitorPlay {...props} />;
export const IconDocumentary = (props: ComponentProps<typeof Video>) => <Video {...props} />;
export const IconCalendar = (props: ComponentProps<typeof Calendar>) => <Calendar {...props} />;
export const IconBell = (props: ComponentProps<typeof Bell>) => <Bell {...props} />;
export const IconBellActive = (props: ComponentProps<typeof CheckCircle>) => <CheckCircle {...props} />;
export const IconSearch = (props: ComponentProps<typeof Search>) => <Search {...props} />;
export const IconLoader = (props: ComponentProps<typeof Loader2>) => <Loader2 {...props} />;
export const IconExternal = (props: ComponentProps<typeof ExternalLink>) => <ExternalLink {...props} />;
export const IconInfo = (props: ComponentProps<typeof Info>) => <Info {...props} />;
export const IconClock = (props: ComponentProps<typeof Clock>) => <Clock {...props} />;
export const IconSettings = (props: ComponentProps<typeof Settings>) => <Settings {...props} />;
export const IconX = (props: ComponentProps<typeof X>) => <X {...props} />;
export const IconAlertTriangle = (props: ComponentProps<typeof AlertTriangle>) => <AlertTriangle {...props} />;
export const IconBookmark = (props: ComponentProps<typeof Bookmark>) => <Bookmark {...props} />;
export const IconBookmarkCheck = (props: ComponentProps<typeof BookmarkCheck>) => <BookmarkCheck {...props} />;
export const IconWifiOff = (props: ComponentProps<typeof WifiOff>) => <WifiOff {...props} />;
export const IconRefresh = (props: ComponentProps<typeof RefreshCw>) => <RefreshCw {...props} />;
export const IconTv = (props: ComponentProps<typeof Tv>) => <Tv {...props} />;
export const IconLayoutGrid = (props: ComponentProps<typeof LayoutGrid>) => <LayoutGrid {...props} />;
export const IconList = (props: ComponentProps<typeof List>) => <List {...props} />;
export const IconChevronLeft = (props: ComponentProps<typeof ChevronLeft>) => <ChevronLeft {...props} />;
export const IconChevronRight = (props: ComponentProps<typeof ChevronRight>) => <ChevronRight {...props} />;
export const IconStar = (props: ComponentProps<typeof Star>) => <Star {...props} />;
export const IconGlobe = (props: ComponentProps<typeof Globe>) => <Globe {...props} />;
export const IconSort = (props: ComponentProps<typeof ArrowUpDown>) => <ArrowUpDown {...props} />;
export const IconShare = (props: ComponentProps<typeof Share2>) => <Share2 {...props} />;
export const IconCheck = (props: ComponentProps<typeof Check>) => <Check {...props} />;
export const IconStream = (props: ComponentProps<typeof MonitorPlay>) => <MonitorPlay {...props} />;

// --- Platform Icon Configuration ---

type PlatformConfig = {
  keys: string[];
  color: string;
  path: React.ReactNode;
  viewBox?: string;
};

// Common TV Networks to fallback to generic TV icon
const TV_NETWORKS = [
  'tv', 'channel', 'network', 'bbc', 'abc', 'nbc', 'cbs', 'fox', 'cw', 
  'syfy', 'fx', 'amc', 'pbs', 'itv', 'cbc', 'nhk', 'tf1', 'ard', 'zdf',
  'tbs', 'tnt', 'usa', 'a&e', 'hgtv', 'food', 'comedy', 'history', 'discovery',
  'fuji', 'tokyo', 'asahi', 'kbs', 'sbs', 'mbc', 'jtbc', 'tvn'
];

// Robust mapping of platforms to visual identities
const PLATFORM_MAP: PlatformConfig[] = [
  { 
    keys: ['netflix'], 
    color: 'text-[#E50914]', 
    path: <path d="M14.017 21L14.017 18.0044L14.017 16.0776L21.108 8.79056L21.108 21.0008L24 21.0008L24 2.9928L19.912 2.9928L11.002 12.6072L11.002 5.9928L11.002 2.9928L2.9912 2.9928L2.9912 21L8 21L8 12.3176L14.017 18.8472L14.017 21Z" /> 
  },
  { 
    keys: ['disney', 'disneyplus'], 
    color: 'text-[#113CCF]', 
    path: <path d="M10.86,13.41c-0.5-0.12-1.46-0.34-1.92-0.45l-0.03,0.01c0,0-0.65,2.15-0.65,2.15 c0,0,1.52,0.35,2.02,0.48c0.61,0.16,0.85-0.03,0.92-0.29C11.28,14.93,10.86,13.41,10.86,13.41z M17.43,8.04 c-0.18-0.08-0.38-0.12-0.6-0.12c-0.61,0-1.16,0.32-1.46,0.84c-0.06,0.1-0.1,0.21-0.12,0.32l-0.01,0.04 c-0.01,0.11-0.02,0.22-0.02,0.33c-0.62,4.89-1.99,10.23-6.52,11.23c-0.45,0.1-0.91,0.15-1.37,0.15c-1.89,0-3.61-0.85-4.73-2.16 c-0.26-0.31-0.49-0.63-0.7-0.97c-0.81-1.33-1.28-2.9-1.28-4.57c0-2.3,0.88-4.39,2.33-5.93c1.4-1.49,3.37-2.42,5.55-2.42 c0.69,0,1.35,0.09,1.99,0.27c0.41,0.11,0.81,0.26,1.2,0.43c0.16-0.6,0.7-1.04,1.35-1.04c0.77,0,1.4,0.63,1.4,1.4 c0,0.15-0.02,0.29-0.07,0.43c1.23,0.56,2.33,1.36,3.24,2.35l-1.35,1.32C17.75,8.5,17.43,8.04,17.43,8.04z" /> 
  },
  { 
    keys: ['prime', 'amazon'], 
    color: 'text-[#00A8E1]', 
    path: <path d="M19.46 16.29C19.1 16.48 18.72 16.59 18.32 16.59C17.65 16.59 17.15 16.29 17.15 15.68V10.74C17.15 9.77 16.74 9.17 15.74 9.17C14.71 9.17 14.15 9.89 14.15 11.08V15.68H11.95V10.74C11.95 9.77 11.54 9.17 10.53 9.17C9.5 9.17 8.95 9.89 8.95 11.08V16.4H6.75V8.16H8.95V8.89C9.27 8.35 10 7.96 10.92 7.96C11.83 7.96 12.63 8.35 13 9.07C13.43 8.35 14.22 7.96 15.13 7.96C17.12 7.96 19.35 9.05 19.35 11.56V16.4H21.55V11.09C21.55 10.27 22.21 9.61 23.03 9.61H24V7.41H23.03C21 7.41 19.35 9.05 19.35 11.09V14.51C19.35 15.3 19.78 15.93 20.46 16.14L19.46 16.29ZM13.84 21.05C11.97 22.06 7.42 22.56 3.03 21.09C1.94 20.72 0.44 20.07 0 19.33C0.84 19.26 2.44 19.41 3.23 19.38C6.91 19.23 11.39 18.3 13.9 16.89C14.17 16.74 14.79 17.27 14.65 17.47C14.53 17.64 14.27 17.81 13.84 21.05Z" /> 
  },
  { 
    keys: ['crunchy', 'crunchyroll'], 
    color: 'text-[#F47521]', 
    path: <path d="M4.69,15.82a6.38,6.38,0,0,1,6-9,6.23,6.23,0,0,1,3.46,1,7.24,7.24,0,0,0-2.82-.57,7.12,7.12,0,0,0-7.13,7.13,7.27,7.27,0,0,0,.52,2.7A6.32,6.32,0,0,1,4.69,15.82Zm14.28-7a5.57,5.57,0,0,1-.9,3.27,5.65,5.65,0,0,1-3,2.23,6.34,6.34,0,0,0,3.3-1.68A6.2,6.2,0,0,0,20.25,8.2a6,6,0,0,0-.31-1.92A5.63,5.63,0,0,1,19,8.78Zm-7.79,3.69a4.83,4.83,0,0,0-4.83,4.83,4.68,4.68,0,0,0,.76,2.6A5.56,5.56,0,0,1,6,17.3a5.59,5.59,0,0,1,5.59-5.59,5.71,5.71,0,0,1,2.83.75A4.8,4.8,0,0,0,11.18,12.47Z" /> 
  },
  { 
    keys: ['hulu'], 
    color: 'text-[#1CE783]', 
    path: <path d="M22.5 7.5h-2.25v6a1.5 1.5 0 0 1-1.5 1.5 1.5 1.5 0 0 1-1.5-1.5v-6h-2.25v6a3.75 3.75 0 0 0 3.75 3.75 3.75 3.75 0 0 0 3.75-3.75v-6ZM9 7.5H6.75v6a1.5 1.5 0 0 1-1.5 1.5 1.5 1.5 0 0 1-1.5-1.5v-6H1.5v6a3.75 3.75 0 0 0 3.75 3.75 3.75 3.75 0 0 0 3.75-3.75v-6Z" /> 
  },
  { 
    keys: ['apple', 'appletv'], 
    color: 'text-[#A2AAAD]', 
    path: <path d="M17.1,12.7c0-2.5,2-3.7,2.1-3.8c-1.1-1.6-2.9-1.8-3.5-1.9c-1.5-0.1-2.9,0.9-3.7,0.9c-0.8,0-1.9-0.8-3.1-0.8 C7.3,7.2,5.7,8,4.9,9.5C3.2,12.3,4.4,16.5,6.1,18.9c0.8,1.2,1.8,2.5,3,2.4c1.2-0.1,1.7-0.8,3.1-0.8c1.5,0,1.9,0.8,3.1,0.7 c1.3-0.1,2.1-1.2,2.9-2.3c0.9-1.3,1.3-2.6,1.3-2.6C19.3,16.3,17.1,15.1,17.1,12.7z M15,5.5c0.7-0.8,1.1-1.9,1-3 c-0.9,0-2.1,0.6-2.7,1.4C12.7,4.7,12.3,5.8,12.4,6.9C13.4,6.9,14.5,6.3,15,5.5z"/> 
  },
  { 
    keys: ['max', 'hbo'], 
    color: 'text-white', 
    path: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm-1-8h-1.5v4H11v-4zm2.5 0h-1.5v4h1.5v-4z" /> 
  },
  { 
    keys: ['peacock'], 
    color: 'text-white',
    path: <path d="M12 5a2 2 0 100-4 2 2 0 000 4zm-4.5 3a2 2 0 100-4 2 2 0 000 4zm9 0a2 2 0 100-4 2 2 0 000 4zm-13 4.5a2 2 0 100-4 2 2 0 000 4zm17 0a2 2 0 100-4 2 2 0 000 4zm-13 4.5a2 2 0 100-4 2 2 0 000 4zm9 0a2 2 0 100-4 2 2 0 000 4z" /> 
  },
  { 
    keys: ['paramount'], 
    color: 'text-[#0064FF]', 
    path: <path d="M2 22h20L12 2 2 22zm10-14l3 6H9l3-6z" /> 
  },
  { 
    keys: ['discovery'], 
    color: 'text-[#0047BA]',
    path: <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
  },
  { 
    keys: ['funimation'], 
    color: 'text-[#5D0084]', 
    path: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15.5c-2.33 0-4.32-1.45-5.12-3.5h1.67c.69 1.19 1.97 2 3.45 2s2.75-.81 3.45-2h1.67c-.8 2.05-2.79 3.5-5.12 3.5zm3-8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm-6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
  },
  { 
    keys: ['hidive'], 
    color: 'text-[#00AEEF]', 
    path: <path d="M4 6h4v12H4V6zm6 0h4v12h-4V6zm6 0h4v12h-4V6z" />
  },
  { 
    keys: ['youtube', 'googleplay'], 
    color: 'text-[#FF0000]', 
    path: <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/> 
  },
  { 
    keys: ['viki', 'rakuten'], 
    color: 'text-[#00A3E0]', 
    path: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-1.3 0-2.43-.37-3.3-1.01l.9-1.42c.67.43 1.5.67 2.4.67 1.5.5 2.5-1.01 2.5-2.67V7h2v5.6c0 2.67-1.74 4.4-4.5 4.4zm-5-3.5H5V7h2v6.5zm-2.8-1.7L3.1 9.9 5 7h1.6l-2.4 3.6z"/> 
  },
  { 
    keys: ['bilibili'], 
    color: 'text-[#00A1D6]', 
    path: <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none" /> 
  },
  { 
    keys: ['iqiyi'], 
    color: 'text-[#00CC36]', 
    path: <path d="M4 4h16v16H4V4zm4 4v8h2V8H8zm6 0v8h2V8h-2z" /> 
  },
  { 
    keys: ['tubi'], 
    color: 'text-[#FA4221]', 
    path: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" /> 
  },
  { 
    keys: ['pluto'], 
    color: 'text-white', 
    path: <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" /> 
  },
  {
    keys: ['starz'],
    color: 'text-white',
    path: <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" />
  },
  {
    keys: ['showtime'],
    color: 'text-[#FF0000]',
    path: <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
  },
  {
    keys: ['britbox'],
    color: 'text-[#00529B]',
    path: <rect x="2" y="5" width="20" height="14" rx="2" />
  },
  {
    keys: ['mgm'],
    color: 'text-[#C5A96F]',
    path: <circle cx="12" cy="12" r="10" />
  },
  {
    keys: ['mubi'],
    color: 'text-[#000000]', 
    path: <rect x="2" y="5" width="20" height="14" rx="2" />
  },
  {
    keys: ['roku'],
    color: 'text-[#662D91]',
    path: <rect x="2" y="5" width="20" height="14" rx="2" />
  },
  {
    keys: ['plex'],
    color: 'text-[#E5A00D]',
    path: <path d="M12 2L2 12l10 10 10-10L12 2zm-1 14l-4-4 4-4v8z" />
  },
  {
    keys: ['starplus', 'star+'],
    color: 'text-[#FF0080]',
    path: <rect x="2" y="5" width="20" height="14" rx="2" />
  },
  {
    keys: ['curiosity'],
    color: 'text-[#FDB913]',
    path: <circle cx="12" cy="12" r="10" />
  },
  {
    keys: ['nowtv', 'now'],
    color: 'text-[#E85C0D]',
    path: <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-2 14l-4-4 4-4v8zm4-8l4 4-4 4v-8z" />
  }
];

// Encapsulated logic for matching
const getPlatformMatch = (name: string): PlatformConfig | undefined => {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Specific checks for overlapping or ambiguous names
  if (n.includes('amazon') || n.includes('prime')) return PLATFORM_MAP.find(p => p.keys.includes('prime'));
  if (n.includes('apple')) return PLATFORM_MAP.find(p => p.keys.includes('apple'));
  if (n.includes('hbo') || n === 'max') return PLATFORM_MAP.find(p => p.keys.includes('max'));
  if (n.includes('paramount')) return PLATFORM_MAP.find(p => p.keys.includes('paramount'));
  if (n.includes('peacock')) return PLATFORM_MAP.find(p => p.keys.includes('peacock'));
  if (n.includes('disney')) return PLATFORM_MAP.find(p => p.keys.includes('disney'));
  
  // General match
  return PLATFORM_MAP.find(p => p.keys.some(k => n.includes(k)));
};

export const PlatformIcon = ({ name, className = "w-4 h-4" }: { name: string; className?: string }) => {
  const matched = getPlatformMatch(name);

  // Subtle glow effect matching brand color
  const glowStyle = matched ? { filter: `drop-shadow(0 0 1px currentColor)` } : undefined;

  const baseClasses = `${className} flex-shrink-0 transition-transform duration-200`;
  const interactiveClasses = `hover:scale-110 hover:brightness-125`;

  if (matched) {
    return (
      <svg
        viewBox={matched.viewBox || "0 0 24 24"}
        fill="currentColor"
        className={`${baseClasses} ${interactiveClasses} ${matched.color} drop-shadow-sm`}
        style={glowStyle}
      >
        <title>{name}</title>
        {matched.path}
      </svg>
    );
  }

  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (n.includes('theater') || n.includes('cinema') || n.includes('boxoffice')) {
      return (
        <IconMovie className={`${baseClasses} ${interactiveClasses} text-amber-500 drop-shadow-sm`} style={{ filter: `drop-shadow(0 0 1px currentColor)` }}>
            <title>{name}</title>
        </IconMovie>
      );
  }
  
  // Generic Streaming Fallback
  if (['stream', 'play', 'plus', 'watch', 'video', 'go', 'fubo', 'sling'].some(k => n.includes(k)) && !n.includes('google')) {
       return (
        <IconStream className={`${baseClasses} ${interactiveClasses} text-indigo-400 drop-shadow-sm`}>
            <title>{name}</title>
        </IconStream>
      );
  }
  
  if (TV_NETWORKS.some(k => n.includes(k))) {
      return (
        <IconTv className={`${baseClasses} ${interactiveClasses} text-slate-400 drop-shadow-sm`}>
            <title>{name}</title>
        </IconTv>
      );
  }

  return (
    <IconExternal className={`${baseClasses} ${interactiveClasses} text-slate-500/80`}>
        <title>{name}</title>
    </IconExternal>
  );
};
