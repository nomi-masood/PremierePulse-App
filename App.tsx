import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchDailyReleases } from './services/geminiService';
import { ReleaseItem, Category, FetchResponse, GroundingMetadata } from './types';
import { 
  IconAnime, 
  IconDrama, 
  IconMovie, 
  IconSeries,
  IconDocumentary,
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

// --- Constants ---

const FALLBACK_IMAGES = {
  Anime: "https://images.unsplash.com/photo-1560167164-db0c40697f26?q=60&w=400&auto=format&fit=crop", // Japanese Lanterns/Street (Distinct Anime Vibe)
  Drama: "https://images.unsplash.com/photo-1507676184212-d0370baf5502?q=60&w=400&auto=format&fit=crop", // Theatrical Curtains (Dramatic)
  Movie: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=60&w=400&auto=format&fit=crop", // Dark Cinema Screen (Cinematic)
  Series: "https://images.unsplash.com/photo-1522869635100-894668ed3a63?q=60&w=400&auto=format&fit=crop", // TV Screen
  Documentary: "https://images.unsplash.com/photo-1505664194779-8beaceb93744?q=60&w=400&auto=format&fit=crop" // Nature/Lens
};

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
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // substitution
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

// Helper to normalize strings: remove accents, lowercase, aggressively replace punctuation
const normalizeStr = (str: string) => 
  (str || "").normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "")
     .toLowerCase()
     // Replace all non-alphanumeric chars with spaces to treat them as delimiters
     .replace(/[^a-z0-9]/g, " ") 
     .replace(/\s+/g, " ") // Collapse multiple spaces
     .trim();

// Tokenize string into an array of words
const tokenize = (str: string) => normalizeStr(str).split(' ').filter(t => t.length > 0);

// --- Helper Components ---

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight || !highlight.trim()) {
    return <>{text}</>;
  }
  
  // Simple highlight based on basic words interaction, better handled via regex on the original text
  // We try to match any of the words in the query
  const words = highlight.trim().split(/\s+/).filter(w => w.length > 0).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (words.length === 0) return <>{text}</>;

  const pattern = `(${words.join('|')})`;
  const regex = new RegExp(pattern, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <span key={i} className="bg-amber-500/40 text-amber-100 rounded px-0.5 box-decoration-clone shadow-sm shadow-amber-900/20">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
};

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
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <IconSettings className="w-5 h-5 text-indigo-400" />
                    Settings
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <IconX className="w-5 h-5" />
                </button>
            </div>
            <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
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
                <div className={`space-y-3 transition-opacity duration-300 ${settings.notificationsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <label className="text-sm font-medium text-slate-300 block mb-2">Alert Timing</label>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { id: 'at-release', label: 'At exact release time' },
                            { id: '15-min-before', label: '15 minutes before' },
                            { id: '1-hour-before', label: '1 hour before' }
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => onUpdate({ ...settings, alertTiming: opt.id as any })}
                                className={`flex items-center px-4 py-3 rounded-xl border text-sm font-medium transition-all ${settings.alertTiming === opt.id ? 'bg-indigo-600/10 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                            >
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${settings.alertTiming === opt.id ? 'border-indigo-500' : 'border-slate-500'}`}>
                                    {settings.alertTiming === opt.id && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                                </div>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="p-6 border-t border-slate-800 bg-slate-900/50">
                <button onClick={onClose} className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20">
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
  title
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
            <IconAlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Disable Notifications?</h3>
          <p className="text-sm text-slate-400">
            Are you sure you want to stop receiving notifications for <span className="text-slate-200 font-medium">{title}</span>?
          </p>
          <div className="flex gap-3 w-full mt-2">
            <button 
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button 
              onClick={() => { onConfirm(); onClose(); }}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors text-sm font-medium shadow-lg shadow-red-500/20"
            >
              Disable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- ReleaseCard Component ---

const ReleaseCard = React.memo(({ 
  item, 
  isNotified, 
  onToggleNotify,
  onRemoveNotify,
  isWatchlisted,
  onToggleWatchlist,
  searchQuery
}: { 
  item: ReleaseItem; 
  isNotified: boolean; 
  onToggleNotify: () => void;
  onRemoveNotify: () => void;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
  searchQuery?: string;
}) => {
  // Use 'primary' | 'bing' | 'unsplash' | 'fallback' to determine source
  const [imgSrcType, setImgSrcType] = useState<'primary' | 'bing' | 'unsplash' | 'fallback'>('primary');
  // Track if the CURRENT img source has finished loading
  const [isImgLoaded, setIsImgLoaded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Initialize state based on item availability
  useEffect(() => {
    setIsImgLoaded(false);
    // If no URL provided by API, skip straight to Bing proxy to save time
    if (!item.imageUrl) {
      setImgSrcType('bing');
    } else {
      setImgSrcType('primary');
    }
  }, [item.imageUrl, item.id]);

  const handleNotifyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isNotified) {
      onRemoveNotify();
    } else {
      onToggleNotify();
    }
  };

  const handleWatchlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWatchlist();
  };

  // Get source-specific image or search proxy
  const getImgSrc = () => {
    if (imgSrcType === 'primary') return item.imageUrl;
    // Fallback 1: Bing Image Proxy for exact match
    if (imgSrcType === 'bing') {
      const query = encodeURIComponent(`${item.title} ${item.category} poster vertical`);
      // Use slightly smaller w/h to ensure speed, c=7 smart crop
      return `https://tse2.mm.bing.net/th?q=${query}&w=400&h=600&c=7&rs=1&p=0&dpr=2&pid=1.7&mkt=en-US&adlt=moderate`;
    }
    // Fallback 2: Optimized Unsplash abstract based on category
    if (imgSrcType === 'unsplash') return FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.Movie;
    return undefined; 
  };

  const handleError = () => {
    // Determine next state in waterfall
    if (imgSrcType === 'primary') setImgSrcType('bing');
    else if (imgSrcType === 'bing') setImgSrcType('unsplash');
    else setImgSrcType('fallback');
    
    // Reset loaded status so skeleton shows for the new source attempt
    setIsImgLoaded(false);
  };

  // Timezone formatting
  const localTime = useMemo(() => {
    if (!item.time) return null;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return `${tz}`;
    } catch(e) { return null; }
  }, [item.time]);

  return (
    <div 
      className="group relative bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 transition-all duration-300 flex flex-col h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Abstract Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}>
      </div>

      {/* Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-900">
        {/* Skeleton Loader - Visible when image is not loaded AND we aren't in final fallback mode */}
        <div className={`absolute inset-0 z-10 bg-slate-800 flex items-center justify-center transition-opacity duration-500 ${!isImgLoaded && imgSrcType !== 'fallback' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-800 via-slate-700 to-slate-800 animate-pulse bg-[length:200%_200%]" />
          <IconLoader className="w-8 h-8 text-indigo-500 animate-spin relative z-10" />
        </div>

        {imgSrcType !== 'fallback' ? (
          <img 
            key={`${item.id}-${imgSrcType}`} // Force re-mount on source switch
            src={getImgSrc()} 
            alt={item.title}
            className={`w-full h-full object-cover transition-all duration-700 ${!isImgLoaded ? 'opacity-0 scale-105 blur-sm' : 'opacity-100 scale-100 blur-0'}`}
            onLoad={() => setIsImgLoaded(true)}
            onError={handleError}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-600 p-4 text-center">
            {item.category === 'Anime' ? <IconAnime className="w-12 h-12 mb-2 opacity-50" /> :
             item.category === 'Drama' ? <IconDrama className="w-12 h-12 mb-2 opacity-50" /> :
             item.category === 'Movie' ? <IconMovie className="w-12 h-12 mb-2 opacity-50" /> :
             item.category === 'Series' ? <IconSeries className="w-12 h-12 mb-2 opacity-50" /> :
             <IconDocumentary className="w-12 h-12 mb-2 opacity-50" />}
            <span className="text-xs uppercase tracking-wider font-medium opacity-50">{item.category}</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-90" />

        {/* Hover Detail Overlay */}
        <div className={`absolute inset-0 bg-slate-900/80 backdrop-blur-sm p-6 flex flex-col justify-center transition-all duration-300 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <h4 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider mb-2">Synopsis</h4>
          <p className="text-slate-300 text-sm leading-relaxed line-clamp-6">
            <HighlightText text={item.description || "No description available for this release."} highlight={searchQuery || ''} />
          </p>
          <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-wrap gap-2">
             {item.platform && item.platform.split(',').map(p => (
               <span key={p} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">{p.trim()}</span>
             ))}
          </div>
        </div>

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-20">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide shadow-lg backdrop-blur-md border ${
            item.category === 'Anime' ? 'bg-pink-500/20 text-pink-200 border-pink-500/30' :
            item.category === 'Drama' ? 'bg-purple-500/20 text-purple-200 border-purple-500/30' :
            item.category === 'Series' ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/30' :
            item.category === 'Documentary' ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' :
            'bg-amber-500/20 text-amber-200 border-amber-500/30'
          }`}>
            {item.category}
          </span>
          {item.episode && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-white text-xs font-bold backdrop-blur-md border border-slate-600 shadow-lg">
              {item.episode}
            </span>
          )}
        </div>

        {/* Release Time Badge */}
        {item.time && (
          <div 
            className="absolute bottom-3 left-3 z-20"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 backdrop-blur-sm border border-indigo-500/50">
              <IconClock className="w-3.5 h-3.5 animate-pulse" />
              <span className="text-xs font-bold">{item.time.replace(/Available now/i, 'NOW')}</span>
            </div>
            {/* Tooltip */}
            <div className={`absolute bottom-full left-0 mb-2 w-48 bg-slate-800 text-slate-200 text-xs rounded-lg p-3 shadow-xl border border-slate-700 transition-all transform origin-bottom-left z-30 pointer-events-none ${showTooltip ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
               <p className="font-semibold text-white mb-1">Release Schedule</p>
               <p>{item.releaseDate}</p>
               <p className="opacity-70 mt-1">Your Timezone: {localTime}</p>
            </div>
          </div>
        )}
      </div>

      {/* Content Body */}
      <div className="p-5 flex flex-col flex-grow relative z-10">
        <h3 className="text-lg font-bold text-white leading-tight mb-2 line-clamp-2" title={item.title}>
          <HighlightText text={item.title} highlight={searchQuery || ''} />
        </h3>
        
        <p className="text-slate-400 text-sm line-clamp-3 mb-4 flex-grow">
          <HighlightText text={item.description || "No description available."} highlight={searchQuery || ''} />
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700/50 mt-auto gap-2">
            <div className="flex gap-2">
                <button 
                  onClick={handleNotifyClick}
                  className={`p-2 rounded-xl transition-all duration-200 border ${
                    isNotified 
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25' 
                      : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white'
                  }`}
                  title={isNotified ? "Notifications On" : "Notify Me"}
                >
                  {isNotified ? <IconBellActive className="w-4 h-4" /> : <IconBell className="w-4 h-4" />}
                </button>
                <button 
                  onClick={handleWatchlistClick}
                  className={`p-2 rounded-xl transition-all duration-200 border ${
                    isWatchlisted
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/25' 
                      : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-emerald-600 hover:border-emerald-500 hover:text-white'
                  }`}
                  title={isWatchlisted ? "On Watchlist" : "Add to Watchlist"}
                >
                  {isWatchlisted ? <IconBookmarkCheck className="w-4 h-4" /> : <IconBookmark className="w-4 h-4" />}
                </button>
            </div>
            
            {item.link && (
                <a 
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700/50 hover:bg-slate-600 border border-slate-600 text-slate-300 hover:text-white text-xs font-semibold transition-all"
                >
                    Source
                    <IconExternal className="w-3 h-3" />
                </a>
            )}
        </div>
      </div>
    </div>
  );
});

// --- ErrorBoundary Component ---

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center p-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8 max-w-md text-center shadow-2xl backdrop-blur-sm animate-in zoom-in-95">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <IconAlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-white">Something went wrong</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              We encountered an unexpected error while rendering the application. 
              Please try reloading to recover.
            </p>
            <button
              onClick={this.handleReload}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 w-full"
            >
              <IconRefresh className="w-5 h-5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Main App Content ---

const AppContent = () => {
  const [activeTab, setActiveTab] = useState<Category>('All');
  const [data, setData] = useState<FetchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifiedItems, setNotifiedItems] = useState<Set<string>>(new Set());
  const [watchlistItems, setWatchlistItems] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; itemId: string; title: string }>({ isOpen: false, itemId: '', title: '' });
  
  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : { notificationsEnabled: true, alertTiming: 'at-release', soundEnabled: true };
  });

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Persistence
  useEffect(() => {
    localStorage.setItem('notifiedItems', JSON.stringify(Array.from(notifiedItems)));
  }, [notifiedItems]);

  useEffect(() => {
    localStorage.setItem('watchlistItems', JSON.stringify(Array.from(watchlistItems)));
  }, [watchlistItems]);

  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const savedNotify = localStorage.getItem('notifiedItems');
    if (savedNotify) setNotifiedItems(new Set(JSON.parse(savedNotify)));
    
    const savedWatchlist = localStorage.getItem('watchlistItems');
    if (savedWatchlist) setWatchlistItems(new Set(JSON.parse(savedWatchlist)));

    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDailyReleases(new Date());
      setData(response);
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes('429') || err?.status === 429) {
          setError("Traffic is high right now. The daily limit for the AI service has been reached. Please try again later.");
      } else {
          setError("Failed to load today's releases. Please check your internet connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotify = (id: string, title: string) => {
    setNotifiedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        // Should open confirm modal instead
        return newSet; 
      } else {
        newSet.add(id);
        if (settings.notificationsEnabled) {
             sendNativeNotification("Reminder Set", `You will be notified for ${title}`);
        }
        return newSet;
      }
    });
  };

  const initRemoveNotify = (id: string, title: string) => {
    setConfirmModal({ isOpen: true, itemId: id, title });
  };

  const confirmRemoveNotify = () => {
    setNotifiedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(confirmModal.itemId);
        return newSet;
    });
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleToggleWatchlist = (id: string) => {
    setWatchlistItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  };

  const handleCategoryChange = (category: Category) => {
    setActiveTab(category);
    setSearchQuery('');
  };

  // --- Search & Filtering Logic ---
  const filteredReleases = useMemo(() => {
    if (!data) return [];
    
    let items = activeTab === 'All' 
      ? data.items 
      : data.items.filter(item => item.category === activeTab);

    if (debouncedSearch.trim()) {
      const queryTokens = tokenize(debouncedSearch);
      
      const scoredItems = items.map(item => {
        let score = 0;
        const normTitle = normalizeStr(item.title);
        const normDesc = normalizeStr(item.description || "");
        const normPlatform = normalizeStr(item.platform || "");
        const normCategory = normalizeStr(item.category || "");

        // --- 1. Phrase Matching (Highest Priority) ---
        const normalizedQuery = normalizeStr(debouncedSearch);
        if (normTitle === normalizedQuery) score += 100;
        else if (normTitle.startsWith(normalizedQuery)) score += 80;
        else if (normTitle.includes(normalizedQuery)) score += 60;

        // --- 2. Token Matching (Smart Search) ---
        // Allows "Bleach War" to match "Bleach: Thousand-Year Blood War"
        // Check how many query tokens exist in the title tokens
        const titleTokens = tokenize(item.title);
        let tokenMatches = 0;
        let tokenScore = 0;

        for (const qToken of queryTokens) {
            let bestTokenMatch = 0;
            for (const tToken of titleTokens) {
                if (tToken === qToken) {
                    bestTokenMatch = 10; // Exact word match
                } else if (tToken.startsWith(qToken)) {
                    bestTokenMatch = Math.max(bestTokenMatch, 5); // Word starts with
                } else if (tToken.includes(qToken)) {
                    bestTokenMatch = Math.max(bestTokenMatch, 2); // Word contains
                } else {
                    const dist = getLevenshteinDistance(tToken, qToken);
                    if (dist <= 2) {
                        bestTokenMatch = Math.max(bestTokenMatch, 4); // Fuzzy word match
                    }
                }
            }
            if (bestTokenMatch > 0) {
                tokenMatches++;
                tokenScore += bestTokenMatch;
            }
        }

        // Bonus if ALL query tokens are found in the title (even out of order)
        if (tokenMatches === queryTokens.length && queryTokens.length > 0) {
            score += 40;
        }
        score += tokenScore;

        // --- 3. Acronym Match ---
        // e.g. "MHA" -> "My Hero Academia"
        const acronym = titleTokens.map(t => t[0]).join('');
        if (acronym === normalizedQuery && acronym.length > 1) {
            score += 30;
        }

        // --- 4. Metadata Match ---
        if (normPlatform.includes(normalizedQuery) || normCategory === normalizedQuery) {
            score += 20;
        }
        
        // --- 5. Description Match ---
        if (normDesc.includes(normalizedQuery)) {
            score += 5;
        }

        return { item, score };
      });

      // Filter out items with low score and sort by score desc
      items = scoredItems
        .filter(si => si.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(si => si.item);
    }
    
    return items;
  }, [data, activeTab, debouncedSearch]);

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 selection:bg-indigo-500/30">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/30">
                <IconCalendar className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400 tracking-tight">
                PremierePulse
              </h1>
            </div>
            <p className="text-slate-400 font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {todayStr}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Search Bar */}
             <div className="relative group w-full md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IconSearch className="h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search titles (e.g. 'Bleach')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-xl leading-5 bg-slate-800/50 text-slate-300 placeholder-slate-500 focus:outline-none focus:bg-slate-800 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 sm:text-sm transition-all shadow-sm"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white"
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                )}
             </div>

             <button 
               onClick={loadData}
               disabled={loading}
               className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
               title="Refresh Data"
             >
               <IconRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
             </button>

             <button 
               onClick={() => setSettingsOpen(true)}
               className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
               title="Settings"
             >
               <IconSettings className="w-5 h-5" />
             </button>
          </div>
        </header>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <FilterTab active={activeTab === 'All'} label="All Releases" onClick={() => handleCategoryChange('All')} />
          <FilterTab active={activeTab === 'Anime'} label="Anime" icon={IconAnime} onClick={() => handleCategoryChange('Anime')} />
          <FilterTab active={activeTab === 'Drama'} label="Dramas" icon={IconDrama} onClick={() => handleCategoryChange('Drama')} />
          <FilterTab active={activeTab === 'Movie'} label="Movies" icon={IconMovie} onClick={() => handleCategoryChange('Movie')} />
          <FilterTab active={activeTab === 'Series'} label="TV Series" icon={IconSeries} onClick={() => handleCategoryChange('Series')} />
          <FilterTab active={activeTab === 'Documentary'} label="Docs" icon={IconDocumentary} onClick={() => handleCategoryChange('Documentary')} />
          
          <div className="ml-auto text-xs text-slate-500 font-medium px-3 py-1 rounded-full bg-slate-900/50 border border-slate-800 hidden sm:block">
            {filteredReleases.length} Items Found
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-500">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-indigo-500/10 rounded-full blur-md animate-pulse" />
              </div>
            </div>
            <p className="mt-8 text-slate-400 text-lg font-medium animate-pulse">Syncing with global APIs...</p>
            <p className="text-slate-600 text-sm mt-2">Connecting to TMDB, AniList, Viki, Netflix & Prime</p>
          </div>
        ) : error ? (
           <div className="flex flex-col items-center justify-center py-20 bg-slate-800/30 border border-red-500/20 rounded-3xl p-8 text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <IconWifiOff className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Connection Issue</h3>
              <p className="text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">{error}</p>
              <button 
                onClick={loadData}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-red-500/20 flex items-center gap-2"
              >
                <IconRefresh className="w-4 h-4" />
                Retry Connection
              </button>
           </div>
        ) : filteredReleases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in duration-500">
             <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <IconSearch className="w-10 h-10 text-slate-600" />
             </div>
             <h3 className="text-xl font-bold text-slate-200 mb-2">No Releases Found</h3>
             <p className="text-slate-400 max-w-sm mx-auto">
               {searchQuery ? `No matches for "${searchQuery}". Try a broader term or check spelling.` : "Looks like a quiet day! No releases matched your current filters."}
             </p>
             {searchQuery && (
               <button onClick={() => setSearchQuery('')} className="mt-6 text-indigo-400 hover:text-indigo-300 font-medium">
                 Clear Search
               </button>
             )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
            {filteredReleases.map((item) => (
              <ReleaseCard 
                key={item.id} 
                item={item} 
                isNotified={notifiedItems.has(item.id)}
                onToggleNotify={() => handleToggleNotify(item.id, item.title)}
                onRemoveNotify={() => initRemoveNotify(item.id, item.title)}
                isWatchlisted={watchlistItems.has(item.id)}
                onToggleWatchlist={() => handleToggleWatchlist(item.id)}
                searchQuery={debouncedSearch}
              />
            ))}
          </div>
        )}

        {/* Footer Attribution */}
        <footer className="border-t border-slate-800 mt-12 py-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <p className="text-slate-500 text-sm">
                Data sourced strictly from <span className="text-indigo-400 font-medium">TMDB</span>, <span className="text-indigo-400 font-medium">AniList</span>, <span className="text-indigo-400 font-medium">MyAnimeList</span>, & <span className="text-indigo-400 font-medium">Viki</span>.
              </p>
              <div className="flex gap-4 text-xs text-slate-600">
                <span>• Netflix</span>
                <span>• Amazon Prime</span>
                <span>• Disney+</span>
              </div>
            </div>
        </footer>

      </div>

      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        settings={settings}
        onUpdate={setSettings}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmRemoveNotify}
        title={confirmModal.title}
      />
    </div>
  );
};

const App = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

export default App;