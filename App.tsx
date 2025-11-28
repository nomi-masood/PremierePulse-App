import React, { useState, useEffect, useMemo } from 'react';
import { fetchDailyReleases } from './services/geminiService';
import { ReleaseItem, Category, FetchResponse, GroundingMetadata } from './types';
import { 
  IconAnime, 
  IconDrama, 
  IconMovie, 
  IconCalendar, 
  IconBell, 
  IconBellActive, 
  IconLoader, 
  IconExternal, 
  IconClock, 
  IconSettings, 
  IconX,
  IconSearch,
  IconAlertTriangle,
  IconBookmark,
  IconBookmarkCheck,
  IconWifiOff,
  IconRefresh,
  IconInfo
} from './components/Icons';

// --- Types ---

interface AppSettings {
  notificationsEnabled: boolean;
  alertTiming: 'at-release' | '15-min-before' | '1-hour-before';
  soundEnabled: boolean;
}

// --- Helper Hooks ---

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// --- Helper Functions ---

const sendNativeNotification = (title: string, body: string) => {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: '/icon.png', // Fallback if no specific icon
      silent: false
    });
  }
};

// Calculate Levenshtein distance for fuzzy search
const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // deletion
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // substitution
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

// Helper to normalize strings: remove accents, lowercase, replace punctuation with space
const normalizeStr = (str: string) => 
  (str || "").normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "")
     .toLowerCase()
     .replace(/[^a-z0-9\s]/g, " ") // Replace special chars with space to handle "Spider-Man" vs "Spider Man"
     .replace(/\s+/g, " ") // Collapse multiple spaces
     .trim();

// --- Helper Components ---

const FilterTab = ({ 
  active, 
  label, 
  icon: Icon, 
  onClick 
}: { 
  active: boolean; 
  label: string; 
  icon?: React.ElementType; 
  onClick: () => void; 
}) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
      ${active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'}
    `}
  >
    {Icon && <Icon className="w-4 h-4" />}
    {label}
  </button>
);

const SettingsModal = ({ 
  isOpen, 
  onClose, 
  settings, 
  onUpdate 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (newSettings: AppSettings) => void;
}) => {
  if (!isOpen) return null;

  const handleToggleMaster = async () => {
    const newState = !settings.notificationsEnabled;
    onUpdate({ ...settings, notificationsEnabled: newState });
    if (newState && Notification.permission !== 'granted') {
      await Notification.requestPermission();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        
        {/* Modal Content */}
        <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <IconSettings className="w-5 h-5 text-indigo-400" />
                    Settings
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <IconX className="w-5 h-5" />
                </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
                {/* Master Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <label className="text-base font-medium text-slate-200 block">Enable Notifications</label>
                        <p className="text-xs text-slate-500 mt-1">Receive alerts for your tracked shows</p>
                    </div>
                    <button 
                        onClick={handleToggleMaster}
                        className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${settings.notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    >
                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>

                {/* Timing */}
                <div className={`space-y-3 transition-opacity duration-300 ${settings.notificationsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <label className="text-sm font-medium text-slate-300 block">Alert Timing</label>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { id: 'at-release', label: 'At time of release' },
                            { id: '15-min-before', label: '15 minutes before' },
                            { id: '1-hour-before', label: '1 hour before' }
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => onUpdate({...settings, alertTiming: opt.id as any})}
                                className={`px-4 py-3 rounded-lg text-sm text-left border transition-all ${
                                    settings.alertTiming === opt.id 
                                    ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-300' 
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                  {opt.label}
                                  {settings.alertTiming === opt.id && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sound */}
                 <div className={`flex items-center justify-between transition-opacity duration-300 ${settings.notificationsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div>
                        <label className="text-sm font-medium text-slate-300 block">Notification Sound</label>
                        <p className="text-xs text-slate-500 mt-1">Play a sound when notified</p>
                    </div>
                    <button 
                        onClick={() => onUpdate({...settings, soundEnabled: !settings.soundEnabled})}
                        className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${settings.soundEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    >
                         <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.soundEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end">
                <button 
                    onClick={onClose}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20"
                >
                    Done
                </button>
            </div>
        </div>
    </div>
  );
};

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4 text-amber-400">
            <IconAlertTriangle className="w-8 h-8" />
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            {message}
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors shadow-lg shadow-red-500/20"
            >
              Disable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ReleaseCardProps {
  item: ReleaseItem;
  isNotified: boolean;
  isInWatchlist: boolean;
  onToggleNotify: (id: string, title: string) => void | Promise<void>;
  onToggleWatchlist: (id: string) => void;
}

// Fallback images from Unsplash for when specific content fails to load
const FALLBACK_IMAGES = {
  // Anime: Tokyo Neon/Cyberpunk aesthetic (Vibrant, Japan)
  Anime: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=800&auto=format&fit=crop", 
  // Drama: Theater curtain / Dramatic stage lighting (Moody, Red)
  Drama: "https://images.unsplash.com/photo-1507676184212-d037095485c0?q=80&w=800&auto=format&fit=crop", 
  // Movie: Film reels / Classic cinema projector (Cinematic, Dark)
  Movie: "https://images.unsplash.com/photo-1478720568477-152d9b164e63?q=80&w=800&auto=format&fit=crop", 
  // Generic: Abstract Dark Texture
  All: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop" 
};

type ImageState = 'primary' | 'bing' | 'unsplash' | 'error';

const ReleaseCard: React.FC<ReleaseCardProps> = ({ 
  item, 
  isNotified, 
  isInWatchlist, 
  onToggleNotify, 
  onToggleWatchlist
}) => {
  const [imgLoading, setImgLoading] = useState(true);
  
  // Initialize state based on whether we have a primary image
  const [imageState, setImageState] = useState<ImageState>(() => {
    return item.imageUrl ? 'primary' : 'bing';
  });

  // Sync state if prop changes (e.g. data refresh)
  useEffect(() => {
    setImageState(item.imageUrl ? 'primary' : 'bing');
    setImgLoading(true);
  }, [item.imageUrl, item.id]);

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Anime': return 'bg-pink-500/20 text-pink-200 border-pink-500/30';
      case 'Drama': return 'bg-purple-500/20 text-purple-200 border-purple-500/30';
      case 'Movie': return 'bg-amber-500/20 text-amber-200 border-amber-500/30';
      default: return 'bg-slate-500/20 text-slate-200 border-slate-500/30';
    }
  };

  const renderFallbackIcon = () => {
    const className = "w-16 h-16 opacity-10 text-white";
    switch (item.category) {
      case 'Anime': return <IconAnime className={className} />;
      case 'Drama': return <IconDrama className={className} />;
      case 'Movie': return <IconMovie className={className} />;
      default: return <IconCalendar className={className} />;
    }
  };

  // Determine current image source based on state machine
  const currentImageSrc = useMemo(() => {
    switch (imageState) {
      case 'primary':
        return item.imageUrl;
      case 'bing':
        // Request higher resolution (w=800) for better quality
        return `https://tse2.mm.bing.net/th?q=${encodeURIComponent(item.title + ' poster')}&w=800&h=450&c=7&rs=1&p=0`;
      case 'unsplash':
        return FALLBACK_IMAGES[item.category as keyof typeof FALLBACK_IMAGES] || FALLBACK_IMAGES['All'];
      default:
        return undefined;
    }
  }, [imageState, item.imageUrl, item.title, item.category]);

  const handleImageError = () => {
    setImgLoading(true); // Reset loading state for the next attempt
    if (imageState === 'primary') {
      setImageState('bing');
    } else if (imageState === 'bing') {
      setImageState('unsplash');
    } else {
      setImageState('error');
      setImgLoading(false); // Stop loading if we hit the error state
    }
  };

  const handleImageLoad = () => {
    setImgLoading(false);
  };

  return (
    <div className="group relative rounded-xl overflow-hidden border border-slate-700/50 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/20 hover:scale-[1.02] hover:-translate-y-1 flex flex-col h-full bg-slate-900">
      
      {/* --- Background System --- */}
      <div className="absolute inset-0 -z-10 bg-slate-900">
        {/* Gradient Base */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800/80 via-slate-900 to-black" />
        
        {/* Decorative Glows */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl opacity-60" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-cyan-500/5 blur-3xl opacity-60" />

        {/* Abstract Tech Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.04]" 
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))' 
          }} 
        />
      </div>

      <div 
        className="relative aspect-video overflow-hidden bg-slate-900 z-10 block group/image"
      >
        {/* Skeleton Loader */}
        {imgLoading && imageState !== 'error' && (
          <div className="absolute inset-0 bg-slate-800 animate-pulse z-20 flex items-center justify-center border-b border-slate-700/50">
            <IconLoader className="w-8 h-8 text-slate-600 animate-spin opacity-50" />
          </div>
        )}

        {imageState !== 'error' && currentImageSrc ? (
          <img 
            src={currentImageSrc} 
            alt={item.title}
            className={`w-full h-full object-cover transform transition-all duration-700 ease-in-out ${
              imgLoading 
                ? 'opacity-0 scale-95 blur-sm' 
                : 'opacity-80 group-hover:opacity-100 scale-100 group-hover:scale-105 blur-0'
            }`}
            loading="lazy"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
            {renderFallbackIcon()}
          </div>
        )}

        {/* Info Overlay (Visible on Hover) */}
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 z-40 p-6 flex flex-col justify-center text-center overflow-hidden">
          <div className="overflow-y-auto custom-scrollbar max-h-full pr-1">
             <div className="flex items-center justify-center gap-2 mb-3 text-indigo-400">
               <IconInfo className="w-4 h-4" />
               <span className="text-xs font-bold uppercase tracking-wider">Synopsis</span>
             </div>
             <p className="text-slate-200 text-sm leading-relaxed mb-4">
               {item.description || "No detailed synopsis available for this release."}
             </p>
             <div className="flex flex-wrap justify-center gap-2 mt-auto">
               <span className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                 {item.category}
               </span>
               {item.platform && (
                 <span className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                   {item.platform}
                 </span>
               )}
               {item.episode && (
                 <span className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                   {item.episode}
                 </span>
               )}
             </div>
          </div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent pointer-events-none" />
        
        {/* Category Badge */}
        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-bold border backdrop-blur-md shadow-lg z-30 transition-opacity duration-300 group-hover/image:opacity-0 ${getCategoryColor(item.category)}`}>
          {item.category}
        </span>

        {/* Platform Badge */}
        {item.platform && (
          <span className="absolute top-3 right-3 px-2 py-1 bg-black/70 backdrop-blur-md text-slate-200 text-xs font-medium rounded-md border border-white/10 shadow-lg z-30 transition-opacity duration-300 group-hover/image:opacity-0">
            {item.platform}
          </span>
        )}

        {/* Prominent Time Badge with Tooltip */}
        <div className="absolute bottom-3 left-3 group/time z-50">
          <div className="flex items-center gap-2 bg-indigo-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg shadow-lg shadow-black/40 border border-indigo-400/30 cursor-help transition-transform group-hover/time:scale-105">
            <IconClock className="w-4 h-4" />
            <span className="font-bold text-sm tracking-wide">{item.time || 'Time TBA'}</span>
          </div>
          
          {/* Tooltip */}
          <div className="absolute bottom-full left-0 mb-3 w-max max-w-[250px] hidden group-hover/time:block animate-in fade-in slide-in-from-bottom-2 pointer-events-none">
            <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 text-xs rounded-lg p-3 shadow-2xl text-slate-300 relative z-50">
               <p className="font-bold text-white mb-1.5 border-b border-slate-700 pb-1">Broadcast Schedule</p>
               <p className="flex items-center gap-2 mb-1">
                 <IconCalendar className="w-3 h-3 text-indigo-400" />
                 <span className="font-medium text-slate-200">
                    {new Date(item.releaseDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                 </span>
               </p>
               <p className="flex items-center gap-2">
                 <IconClock className="w-3 h-3 text-indigo-400" />
                 <span className="font-medium text-slate-200">{item.time || 'Time TBA'}</span>
               </p>
               
               <div className="mt-2 pt-2 border-t border-slate-700/50">
                 <div className="flex justify-between items-center mb-1">
                   <span className="text-[10px] text-slate-400">Your Timezone:</span>
                   <span className="text-[10px] text-indigo-300 font-mono bg-indigo-900/30 px-1 rounded">{userTimezone}</span>
                 </div>
                 <p className="text-[10px] text-slate-500 italic leading-tight">
                   * Schedule is displayed as reported by the source. Please check local listings.
                 </p>
               </div>
               
               {/* Arrow */}
               <div className="w-2 h-2 bg-slate-900 absolute -bottom-1 left-5 rotate-45 border-r border-b border-slate-700"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 relative z-10 flex flex-col flex-grow">
        <div className="flex justify-between items-start gap-4 mb-3">
          <div>
            <h3 className="text-lg font-bold text-white leading-tight group-hover:text-indigo-300 transition-colors">
              {item.title}
            </h3>
            {item.episode && (
              <p className="text-sm text-indigo-400 font-semibold mt-1">
                {item.episode}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {/* Watchlist Button */}
            <button
              onClick={() => onToggleWatchlist(item.id)}
              className={`
                p-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                ${isInWatchlist 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-500/20' 
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white border border-slate-600/50'}
              `}
              title={isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
              aria-label={isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
            >
              {isInWatchlist ? <IconBookmarkCheck className="w-5 h-5" /> : <IconBookmark className="w-5 h-5" />}
            </button>

            {/* Notification Button */}
            <button
              onClick={() => onToggleNotify(item.id, item.title)}
              className={`
                p-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                ${isNotified 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-500/20' 
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white border border-slate-600/50'}
              `}
              title={isNotified ? "Remove notification" : "Notify me"}
              aria-label={isNotified ? "Remove notification" : "Notify me"}
            >
              {isNotified ? <IconBellActive className="w-5 h-5" /> : <IconBell className="w-5 h-5" />}
            </button>

            {/* Go to Source Button */}
            <a
              href={item.link || `https://www.google.com/search?q=${encodeURIComponent(item.title + ' ' + item.category + ' official source')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white border border-slate-600/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              title="Go to Source"
              aria-label={`Go to source for ${item.title}`}
            >
              <IconExternal className="w-5 h-5" />
            </a>
          </div>
        </div>

        {item.description && (
          <p className="text-slate-400 text-sm leading-relaxed line-clamp-3 text-ellipsis overflow-hidden mb-2">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('premierepulse_watchlist');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [groundingLinks, setGroundingLinks] = useState<GroundingMetadata[]>([]);
  
  // Use debounce for search query to improve performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('premierepulse_settings');
    return saved ? JSON.parse(saved) : {
      notificationsEnabled: true,
      alertTiming: 'at-release',
      soundEnabled: true
    };
  });

  // Confirmation Modal State
  const [confirmRemovalId, setConfirmRemovalId] = useState<string | null>(null);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('premierepulse_settings', JSON.stringify(settings));
  }, [settings]);

  // Persist watchlist
  useEffect(() => {
    localStorage.setItem('premierepulse_watchlist', JSON.stringify(Array.from(watchlistIds)));
  }, [watchlistIds]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: FetchResponse = await fetchDailyReleases(currentDate);
      setReleases(data.items);
      setGroundingLinks(data.groundingLinks);
    } catch (err) {
      setError("Failed to load schedule. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const handleNotifyClick = async (id: string, title: string) => {
    if (notifiedIds.has(id)) {
      setConfirmRemovalId(id);
    } else {
      if (settings.notificationsEnabled) {
        let perm = Notification.permission;
        if (perm !== 'granted') {
          perm = await Notification.requestPermission();
        }
        
        if (perm === 'granted') {
          sendNativeNotification(
            "Tracking Started", 
            `You will be notified when ${title} is released.`
          );
        }
      }

      setNotifiedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  };

  const handleWatchlistClick = (id: string) => {
    setWatchlistIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const executeRemoval = () => {
    if (confirmRemovalId) {
      setNotifiedIds(prev => {
        const next = new Set(prev);
        next.delete(confirmRemovalId);
        return next;
      });
      setConfirmRemovalId(null);
    }
  };

  const filteredReleases = useMemo(() => {
    let result = releases;

    // Filter by category first (optimization)
    if (filter !== 'All') {
      result = result.filter(item => item.category === filter);
    }

    // Robust weighted search logic with fuzzy matching
    if (debouncedSearchQuery.trim()) {
      const query = normalizeStr(debouncedSearchQuery);
      const terms = query.split(" ").filter(t => t.length > 0);

      result = result
        .map(item => {
          let score = 0;
          const titleNorm = normalizeStr(item.title);
          const descNorm = item.description ? normalizeStr(item.description) : '';
          const platformNorm = item.platform ? normalizeStr(item.platform) : '';
          const categoryNorm = normalizeStr(item.category);
          
          const titleWords = titleNorm.split(" ");

          // 1. Exact Title Match (Highest Priority)
          if (titleNorm === query) score += 100;
          
          // 2. Starts With (High Priority)
          if (titleNorm.startsWith(query)) score += 50;

          // 3. Contains full query phrase (Medium Priority)
          if (titleNorm.includes(query)) score += 30;

          // 4. Matches Platform or Category
          if (platformNorm.includes(query) || categoryNorm.includes(query)) score += 15;
          // Explicitly boost if searching for a category name (e.g., "Anime")
          if (categoryNorm === query) score += 30;

          // 5. Term Matching & Fuzzy Search
          let termMatches = 0;
          
          terms.forEach(term => {
             let termMatched = false;

             // Exact substring match in title
             if (titleNorm.includes(term)) {
               score += 10;
               termMatched = true;
             } 
             // Exact substring match in platform/category
             else if (platformNorm.includes(term) || categoryNorm.includes(term)) {
               score += 5;
               termMatched = true;
             }
             // Exact substring match in description
             else if (descNorm.includes(term)) {
               score += 2; // Lowered slightly to reduce noise
               termMatched = true;
             }
             // Fuzzy match against title words (for typos)
             else {
               // Check if any word in the title is close to the term using Levenshtein distance
               const bestFuzzyMatch = titleWords.reduce((minDist, word) => {
                 const dist = getLevenshteinDistance(term, word);
                 return dist < minDist ? dist : minDist;
               }, 100);

               // Allow 1 error for words length < 5, 2 errors for 5+
               const allowedErrors = term.length > 4 ? 2 : 1;
               
               if (bestFuzzyMatch <= allowedErrors) {
                 score += 5; // Fuzzy match bonus
                 termMatched = true;
               }
             }

             if (termMatched) termMatches++;
          });

          // Boost score if all terms matched
          if (termMatches === terms.length) score += 20;

          // Penalize significantly if very few terms matched relative to query length
          if (termMatches === 0 && terms.length > 0) score = -1;

          return { item, score };
        })
        .filter(r => r.score > 0) // Only keep items with positive score
        .sort((a, b) => b.score - a.score)
        .map(r => r.item);
    }

    return result;
  }, [releases, filter, debouncedSearchQuery]);

  const handleDateChange = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const formattedDate = currentDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 text-slate-200">
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdate={setSettings}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={!!confirmRemovalId}
        onClose={() => setConfirmRemovalId(null)}
        onConfirm={executeRemoval}
        title="Disable Notification?"
        message="Are you sure you want to stop receiving notifications for this release?"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center py-4 gap-4">
            
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
                <IconCalendar className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                PremierePulse
              </h1>
            </div>

            {/* Controls Right */}
            <div className="flex items-center gap-4">
              {/* Date Navigation */}
              <div className="flex items-center gap-4 bg-slate-900/50 p-1.5 rounded-full border border-slate-800">
                <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                  ←
                </button>
                <span className="font-medium px-2 min-w-[200px] text-center hidden sm:block">{formattedDate}</span>
                <span className="font-medium px-2 text-center sm:hidden">{currentDate.toLocaleDateString()}</span>
                <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                  →
                </button>
              </div>

              {/* Refresh Button */}
              <button 
                onClick={fetchData}
                disabled={loading}
                className="p-3 rounded-full bg-slate-900/50 border border-slate-800 hover:bg-slate-800 hover:text-white text-slate-400 transition-all hover:shadow-lg hover:shadow-indigo-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh Schedule"
              >
                <IconRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Settings Button */}
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-3 rounded-full bg-slate-900/50 border border-slate-800 hover:bg-slate-800 hover:text-white text-slate-400 transition-all hover:shadow-lg hover:shadow-indigo-500/10"
                aria-label="Settings"
              >
                <IconSettings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto mb-8 group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <IconSearch className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-10 py-3 border border-slate-700 rounded-xl leading-5 bg-slate-900/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all shadow-lg"
            placeholder="Search for movies, anime, or dramas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition-colors"
            >
              <IconX className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8 justify-center md:justify-start">
          <FilterTab active={filter === 'All'} label="All Releases" onClick={() => setFilter('All')} />
          <FilterTab active={filter === 'Anime'} label="Anime" icon={IconAnime} onClick={() => setFilter('Anime')} />
          <FilterTab active={filter === 'Drama'} label="Dramas" icon={IconDrama} onClick={() => setFilter('Drama')} />
          <FilterTab active={filter === 'Movie'} label="Movies" icon={IconMovie} onClick={() => setFilter('Movie')} />
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <IconLoader className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
            <p className="animate-pulse">Scanning Netflix, Prime, Crunchyroll, JustWatch, Trakt, YTS, 1337x, & Nyaa...</p>
          </div>
        ) : error ? (
          <div className="max-w-lg mx-auto text-center py-16 px-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-red-500/20 shadow-lg shadow-red-500/10">
               <IconWifiOff className="w-10 h-10 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Unable to Load Schedule</h3>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              We couldn't connect to the server to fetch the latest releases. This might be due to a temporary network interruption or API limits.
            </p>
            <button 
              onClick={fetchData}
              className="group flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 w-full sm:w-auto mx-auto"
            >
              <IconRefresh className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              Retry Connection
            </button>
          </div>
        ) : filteredReleases.length === 0 ? (
          <div className="text-center py-20 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
            <p className="text-lg">
              {searchQuery 
                ? `No releases found for "${searchQuery}"`
                : "No releases found for this category today."}
            </p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReleases.map(item => (
              <ReleaseCard 
                key={item.id} 
                item={item} 
                isNotified={notifiedIds.has(item.id)}
                isInWatchlist={watchlistIds.has(item.id)}
                onToggleNotify={handleNotifyClick}
                onToggleWatchlist={handleWatchlistClick}
              />
            ))}
          </div>
        )}

      </main>

      {/* Footer / Attribution */}
      <footer className="border-t border-slate-800 mt-12 bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          
          {groundingLinks.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Source Links</h4>
              <div className="flex flex-wrap justify-center gap-3">
                {groundingLinks.map((link, idx) => (
                  <a 
                    key={idx}
                    href={link.web.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 transition-colors"
                  >
                    <IconExternal className="w-3 h-3" />
                    {link.web.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
            <p>Data provided via Google Gemini analysis of:</p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 max-w-2xl">
              <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">MyAnimeList</a>
              <span className="text-slate-700">•</span>
              <a href="https://senpai.moe" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Senpai.moe</a>
              <span className="text-slate-700">•</span>
              <a href="https://animeschedule.net" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">AnimeSchedule</a>
              <span className="text-slate-700">•</span>
              <a href="https://justwatch.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">JustWatch</a>
              <span className="text-slate-700">•</span>
              <a href="https://livechart.me" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">LiveChart</a>
              <span className="text-slate-700">•</span>
              <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">AniList</a>
              <span className="text-slate-700">•</span>
              <a href="https://kitsu.io" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Kitsu</a>
              <span className="text-slate-700">•</span>
              <a href="https://animenewsnetwork.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">ANN</a>
              <span className="text-slate-700">•</span>
              <a href="https://mydramalist.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">MyDramaList</a>
              <span className="text-slate-700">•</span>
              <a href="https://tvmaze.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">TVMaze</a>
              <span className="text-slate-700">•</span>
              <a href="https://rottentomatoes.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Rotten Tomatoes</a>
              <span className="text-slate-700">•</span>
              <a href="https://viki.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Viki</a>
              <span className="text-slate-700">•</span>
              <a href="https://netflix.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Netflix</a>
              <span className="text-slate-700">•</span>
              <a href="https://amazon.com/primevideo" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Prime Video</a>
              <span className="text-slate-700">•</span>
              <a href="https://crunchyroll.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Crunchyroll</a>
              <span className="text-slate-700">•</span>
              <a href="https://hidive.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">HIDIVE</a>
              <span className="text-slate-700">•</span>
              <a href="https://trakt.tv" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Trakt</a>
              <span className="text-slate-700">•</span>
              <a href="https://themoviedb.org" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">TMDB</a>
              <span className="text-slate-700">•</span>
              <a href="https://en.yts-official.org" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">YTS</a>
              <span className="text-slate-700">•</span>
              <a href="https://1337x.to" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">1337x</a>
              <span className="text-slate-700">•</span>
              <a href="https://nyaa.si" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Nyaa</a>
              <span className="text-slate-700">•</span>
              <a href="https://imdb.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">IMDb</a>
            </div>
          </div>
          <p className="text-slate-600 text-xs mt-4">
            © {new Date().getFullYear()} PremierePulse. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}