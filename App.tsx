
import React, { useState, useEffect, useMemo, useRef, ReactNode, Component } from 'react';
import { fetchDailyReleases, fetchItemsByIds } from './services/geminiService';
import { ReleaseItem, Category, FetchResponse, AppSettings } from './types';
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
  IconTv, 
  IconLayoutGrid, 
  IconList, 
  IconChevronLeft, 
  IconChevronRight, 
  IconStar,
  IconGlobe,
  IconSort,
  PlatformIcon
} from './components/Icons';

// --- Types ---

type ViewMode = 'grid' | 'list';
type SortOption = 'popularity' | 'rating' | 'time';
type AppMode = 'daily' | 'watchlist';

// --- Constants ---

const FALLBACK_IMAGES = {
  Anime: "https://images.unsplash.com/photo-1560167164-61677bc496ae?q=60&w=400&auto=format&fit=crop", 
  Drama: "https://images.unsplash.com/photo-1507676184212-d03ab07a11d0?q=60&w=400&auto=format&fit=crop",
  Movie: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=60&w=400&auto=format&fit=crop", 
  Series: "https://images.unsplash.com/photo-1522869635100-894668ed3a63?q=60&w=400&auto=format&fit=crop", 
  Documentary: "https://images.unsplash.com/photo-1505664194779-8beaceb93744?q=60&w=400&auto=format&fit=crop"
};

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'BR', name: 'Brazil' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
];

// --- Helper Hooks ---

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function useCountdown(targetDate: number | undefined) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  } | null>(null);

  useEffect(() => {
    if (!targetDate) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }

      setTimeLeft({
        hours: Math.floor((difference / (1000 * 60 * 60))),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isPast: false
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

// --- Helper Functions ---

const sendNativeNotification = (title: string, body: string) => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: '/icon.png', silent: false });
  }
};

const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
};

const normalizeStr = (str: string) => 
  (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

const tokenize = (str: string) => normalizeStr(str).split(' ').filter(t => t.length > 0);

// --- Helper Components ---

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <>{text}</>;
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split(' ').join('|')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? <span key={i} className="bg-yellow-500/30 text-yellow-200 font-medium px-0.5 rounded">{part}</span> : part
      )}
    </>
  );
};

// --- Main Components ---

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState { return { hasError: true }; }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
          <IconAlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Something went wrong</h2>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 transition">Reload Application</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SettingsModal = ({ isOpen, onClose, settings, onSave }: { isOpen: boolean; onClose: () => void; settings: AppSettings; onSave: (s: AppSettings) => void; }) => {
  if (!isOpen) return null;
  const [localSettings, setLocalSettings] = useState(settings);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2"><IconSettings className="w-5 h-5 text-indigo-400" /> Settings</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition"><IconX className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div><p className="font-medium text-slate-200">Enable Notifications</p><p className="text-sm text-slate-500">Get alerts for tracked releases</p></div>
            <button onClick={() => setLocalSettings(s => ({...s, notificationsEnabled: !s.notificationsEnabled}))} className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${localSettings.notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${localSettings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`} /></button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Alert Timing</label>
            <select value={localSettings.alertTiming} onChange={(e) => setLocalSettings(s => ({...s, alertTiming: e.target.value as any}))} disabled={!localSettings.notificationsEnabled} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"><option value="at-release">At release time</option><option value="15-min-before">15 minutes before</option><option value="1-hour-before">1 hour before</option></select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Streaming Region</label>
            <div className="relative">
              <IconGlobe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select 
                value={localSettings.region || 'US'} 
                onChange={(e) => setLocalSettings(s => ({...s, region: e.target.value}))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 pl-10 text-slate-200 focus:ring-2 focus:ring-indigo-500"
              >
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-1">Shows "Where to Watch" links for this country.</p>
          </div>
        </div>
        <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition">Cancel</button>
          <button onClick={() => { onSave(localSettings); onClose(); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><IconAlertTriangle className="w-6 h-6 text-amber-500" /></div>
          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-slate-400 mb-6">{message}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition">Cancel</button>
            <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReleaseCard: React.FC<{ item: ReleaseItem; viewMode: ViewMode; onToggleNotify: (id: string, title: string) => Promise<void>; onToggleWatchlist: (id: string) => void; isNotified: boolean; isWatchlisted: boolean; searchQuery: string; }> = ({ item, viewMode, onToggleNotify, onToggleWatchlist, isNotified, isWatchlisted, searchQuery }) => {
  const [imgState, setImgState] = useState<'loading' | 'low-res-loaded' | 'high-res-loaded' | 'error'>('loading');
  const [imgSrc, setImgSrc] = useState<string | undefined>(undefined);
  
  const countdown = useCountdown(item.timestamp);

  useEffect(() => {
    setImgState('loading');
    if (item.imageUrl) {
      setImgSrc(item.imageUrl);
    } else {
      const bingUrl = `https://tse2.mm.bing.net/th?q=${encodeURIComponent(item.title + " " + item.category + " poster")}&w=400&h=600&c=7&rs=1&p=0&dpr=3&pid=1.7&mkt=en-US&adlt=moderate`;
      setImgSrc(bingUrl);
    }
  }, [item.id, item.imageUrl]);

  const handleHighResLoad = () => setImgState('high-res-loaded');
  const handleLowResLoad = () => { if (imgState !== 'high-res-loaded') setImgState('low-res-loaded'); };
  const handleError = () => {
    if (imgSrc === item.imageUrl && item.imageUrl) {
      setImgSrc(`https://tse2.mm.bing.net/th?q=${encodeURIComponent(item.title + " " + item.category + " poster")}&w=400&h=600&c=7&rs=1&p=0&dpr=3&pid=1.7&mkt=en-US&adlt=moderate`);
    } else if (imgSrc?.includes('bing.net')) {
      setImgSrc(FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES['Series']);
    } else {
      setImgState('error');
    }
  };

  const lowResUrl = item.imageUrl && item.imageUrl.includes('tmdb.org') ? item.imageUrl.replace('w500', 'w92') : undefined;
  const badgeColor = item.category === 'Anime' ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' : item.category === 'Drama' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : item.category === 'Movie' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : item.category === 'Documentary' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  const platforms = item.platform ? item.platform.split(',').map(p => p.trim()) : [];
  const localTime = item.time;
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const TimeDisplay = () => {
    if (countdown && !countdown.isPast) {
      return (
        <span className="tabular-nums tracking-tight">
          {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
        </span>
      );
    }
    return <span>{localTime}</span>;
  };

  const RatingDisplay = () => (
    <div className="flex gap-2">
        {item.rating && (
            <span className="px-2 py-1 rounded-md bg-slate-900/80 text-amber-400 text-xs font-bold backdrop-blur-md border border-slate-700 shadow-lg flex items-center gap-1">
                <IconStar className="w-3 h-3 fill-amber-400" />
                {item.rating.toFixed(1)} <span className="text-[9px] opacity-70 ml-0.5 uppercase">{item.category === 'Anime' ? 'AniList' : 'TMDB'}</span>
            </span>
        )}
        {item.imdbRating && (
            <span className="px-2 py-1 rounded-md bg-yellow-400/10 text-yellow-300 text-xs font-bold backdrop-blur-md border border-yellow-500/30 shadow-lg flex items-center gap-1">
                <span className="bg-yellow-400 text-black text-[9px] font-black px-1 rounded-sm leading-none py-0.5">IMDb</span> {item.imdbRating.toFixed(1)}
            </span>
        )}
    </div>
  );

  if (viewMode === 'list') {
    return (
      <div className="group relative bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 flex flex-col md:flex-row">
        <div className="relative w-full md:w-48 h-48 md:h-auto shrink-0 bg-slate-900 overflow-hidden">
          {imgState === 'loading' && <div className="absolute inset-0 bg-slate-800 animate-pulse z-10" />}
          {lowResUrl && imgState !== 'error' && <img src={lowResUrl} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 blur-sm scale-105 ${imgState === 'high-res-loaded' ? 'opacity-0' : 'opacity-100'}`} onLoad={handleLowResLoad} alt="" />}
          {imgSrc && imgState !== 'error' ? <img src={imgSrc} alt={item.title} loading="lazy" decoding="async" onLoad={handleHighResLoad} onError={handleError} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imgState === 'high-res-loaded' ? 'opacity-100' : 'opacity-0'}`} /> : <div className="absolute inset-0 flex items-center justify-center bg-slate-800"><IconTv className="w-12 h-12 text-slate-700" /></div>}
        </div>
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <div className="flex gap-2 items-center flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}>{item.category}</span>
                {item.episode && <span className="text-xs text-slate-400 font-medium bg-slate-900 px-2 py-0.5 rounded">{item.episode}</span>}
                <RatingDisplay />
              </div>
              <div className="flex items-center gap-1">
                 <button onClick={() => onToggleWatchlist(item.id)} className={`p-2 rounded-lg transition-all ${isWatchlisted ? 'bg-emerald-500/10 text-emerald-500' : 'hover:bg-slate-700 text-slate-400 hover:text-white'}`}>{isWatchlisted ? <IconBookmarkCheck className="w-5 h-5" /> : <IconBookmark className="w-5 h-5" />}</button>
                 <button onClick={() => onToggleNotify(item.id, item.title)} className={`p-2 rounded-lg transition-all ${isNotified ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-slate-700 text-slate-400 hover:text-white'}`}>{isNotified ? <IconBellActive className="w-5 h-5" /> : <IconBell className="w-5 h-5" />}</button>
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 line-clamp-1 group-hover:text-indigo-400 transition-colors"><HighlightText text={item.title} highlight={searchQuery} /></h3>
            {item.subGenres && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {item.subGenres.map(g => <span key={g} className="text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">{g}</span>)}
              </div>
            )}
            <p className="text-slate-400 text-sm md:text-base line-clamp-3 mb-3"><HighlightText text={item.description || ''} highlight={searchQuery} /></p>
          </div>
          <div className="flex items-center justify-between mt-auto border-t border-slate-700/50 pt-3">
             <div className="flex items-center gap-4 text-sm">
                <div className={`flex items-center gap-1.5 font-medium ${countdown && !countdown.isPast ? 'text-amber-400' : 'text-indigo-400'}`} title={`Timezone: ${userTimezone}`}>
                  <IconClock className="w-4 h-4" /> <TimeDisplay />
                </div>
                {platforms.length > 0 && <div className="flex items-center gap-3">{platforms.map(p => <div key={p} className="flex items-center gap-1.5 text-slate-300"><PlatformIcon name={p} className="w-4 h-4" /><span className="hidden sm:inline text-xs">{p}</span></div>)}</div>}
             </div>
             <div className="flex gap-2">
                <a href={item.deepLink || item.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-400 transition-colors">Watch <IconExternal className="w-3 h-3" /></a>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/20 flex flex-col h-full">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity duration-500 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500 via-purple-500 to-transparent" />
      
      {/* Image Container */}
      <div className="relative aspect-[2/3] bg-slate-900 overflow-hidden cursor-pointer shrink-0" onClick={() => (item.deepLink || item.link) && window.open(item.deepLink || item.link, '_blank')}>
        {imgState === 'loading' && <div className="absolute inset-0 bg-slate-800 animate-pulse z-10" />}
        {lowResUrl && imgState !== 'error' && <img src={lowResUrl} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 blur-sm scale-110 ${imgState === 'high-res-loaded' ? 'opacity-0' : 'opacity-100'}`} onLoad={handleLowResLoad} alt="" />}
        {imgSrc && imgState !== 'error' ? <img src={imgSrc} alt={item.title} loading="lazy" decoding="async" onLoad={handleHighResLoad} onError={handleError} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imgState === 'high-res-loaded' ? 'opacity-100' : 'opacity-0'}`} /> : <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/80 p-6 text-center"><IconTv className="w-10 h-10 text-slate-400" /><span className="text-xs text-slate-500 font-medium">{item.category}</span></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-80" />
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
           <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md shadow-lg ${badgeColor}`}>{item.category}</span>
           <div className="flex gap-1 flex-col items-end">
             <RatingDisplay />
             {item.episode && <span className="px-2 py-1 rounded-md bg-slate-900/80 text-slate-200 text-xs font-bold backdrop-blur-md border border-slate-700 shadow-lg">{item.episode}</span>}
           </div>
        </div>

        {/* Time Badge */}
        <div className="absolute bottom-3 left-3 group/time z-20">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 ${countdown && !countdown.isPast ? 'bg-amber-600 text-white border-amber-500/50' : 'bg-indigo-600 text-white border-indigo-500/50'} rounded-lg shadow-lg font-bold text-sm backdrop-blur-sm border`}>
            <IconClock className="w-3.5 h-3.5" /> <TimeDisplay />
          </div>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-6 flex flex-col justify-center text-center z-30 pointer-events-none group-hover:pointer-events-auto">
            {item.subGenres && <div className="flex flex-wrap gap-1.5 justify-center mb-3">{item.subGenres.map(g => <span key={g} className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{g}</span>)}</div>}
            <p className="text-slate-300 text-sm line-clamp-5 leading-relaxed mb-4"><HighlightText text={item.description || ''} highlight={searchQuery} /></p>
            <div className="flex justify-center gap-3">
              {item.link && (
                <a href={item.deepLink || item.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 shadow-lg shadow-indigo-900/20 rounded-lg text-xs font-bold flex items-center gap-1.5 transition transform active:scale-95">Source <IconExternal className="w-3 h-3" /></a>
              )}
            </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 relative bg-slate-800/90 backdrop-blur-sm border-t border-slate-700/50 flex-1 flex flex-col">
        <h3 className="font-bold text-slate-50 text-base md:text-lg leading-snug mb-2 line-clamp-2 min-h-[3rem] group-hover:text-indigo-400 transition-colors" title={item.title}><HighlightText text={item.title} highlight={searchQuery} /></h3>
        
        {/* Platforms with improved styling */}
        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 mt-auto">
            {platforms.map(p => (
              <div key={p} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-950/50 border border-slate-700/50 hover:border-indigo-500/30 hover:bg-slate-900 transition-colors cursor-default text-[10px] font-medium text-slate-300 shadow-sm whitespace-nowrap">
                <PlatformIcon name={p} className="w-3.5 h-3.5" />
                <span>{p}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Actions */}
        <div className={`flex items-center gap-2 pt-3 border-t border-slate-700/50 ${platforms.length === 0 ? 'mt-auto' : ''}`}>
          <button onClick={() => onToggleWatchlist(item.id)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${isWatchlisted ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'}`}>{isWatchlisted ? <><IconBookmarkCheck className="w-4 h-4" /> Added</> : <><IconBookmark className="w-4 h-4" /> Watchlist</>}</button>
          <button onClick={() => onToggleNotify(item.id, item.title)} className={`p-2 rounded-lg transition-all ${isNotified ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'}`} title="Toggle Notification">{isNotified ? <IconBellActive className="w-5 h-5" /> : <IconBell className="w-5 h-5" />}</button>
        </div>
      </div>
    </div>
  );
};

const AppContent = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [category, setCategory] = useState<Category>('All');
  const [viewMode, setViewMode] = useState<ViewMode>(() => localStorage.getItem('premierepulse_view_mode') as ViewMode || 'grid');
  const [appMode, setAppMode] = useState<AppMode>('daily');
  const [sortOption, setSortOption] = useState<SortOption>('popularity');
  const [notifications, setNotifications] = useState<string[]>(() => JSON.parse(localStorage.getItem('premierepulse_notifications') || '[]'));
  const [watchlist, setWatchlist] = useState<string[]>(() => JSON.parse(localStorage.getItem('premierepulse_watchlist') || '[]'));
  const [settings, setSettings] = useState<AppSettings>(() => JSON.parse(localStorage.getItem('premierepulse_settings') || '{"notificationsEnabled": true, "alertTiming": "at-release", "soundEnabled": false, "region": "US"}'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, id: string, title: string} | null>(null);

  // Swipe state refs (optimization to avoid re-renders on scroll)
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const minSwipeDistance = 75;

  useEffect(() => { localStorage.setItem('premierepulse_notifications', JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem('premierepulse_watchlist', JSON.stringify(watchlist)); }, [watchlist]);
  useEffect(() => { localStorage.setItem('premierepulse_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('premierepulse_view_mode', viewMode); }, [viewMode]);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      // If Watchlist mode, fetch watchlist items specifically
      if (appMode === 'watchlist') {
          if (watchlist.length === 0) {
              setReleases([]);
              setLoading(false);
              return;
          }
          // We don't cache watchlist view as heavily because it changes based on user's list
          const items = await fetchItemsByIds(watchlist, settings.region || 'US');
          setReleases(items);
          setLoading(false);
          return;
      }

      // Daily Release Mode
      const cacheKey = `premierepulse_cache_${currentDate.toLocaleDateString('en-CA')}_${settings.region || 'US'}`;
      const cached = localStorage.getItem(cacheKey);
      let initialData: ReleaseItem[] = [];
      
      if (cached && !forceRefresh) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.data) && parsed.timestamp) {
           initialData = parsed.data;
           setReleases(initialData);
           setLoading(false);
           const age = Date.now() - parsed.timestamp;
           if (age < 1000 * 60 * 60) return;
        } else {
           localStorage.removeItem(cacheKey);
        }
      }
      const response: FetchResponse = await fetchDailyReleases(currentDate, settings.region || 'US');
      setReleases(response.items);
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: response.items }));
    } catch (err: any) {
      console.error("Fetch Error:", err);
      setReleases(prev => {
        if (prev.length > 0) return prev;
        setError(err.message || "Failed to load schedule.");
        return [];
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [currentDate, settings.region, appMode]); // Reload when mode changes

  // We need to re-fetch watchlist if the watchlist array changes while we are in watchlist mode
  useEffect(() => {
    if (appMode === 'watchlist') {
        loadData();
    }
  }, [watchlist]);


  const filteredReleases = useMemo(() => {
    let result = category === 'All' ? releases : releases.filter(r => r.category === category);
    if (debouncedSearch.trim()) {
      const query = normalizeStr(debouncedSearch);
      const queryTokens = tokenize(debouncedSearch);
      result = result.map(item => {
          let score = 0;
          const title = normalizeStr(item.title);
          const desc = normalizeStr(item.description || "");
          const platform = normalizeStr(item.platform || "");
          if (title === query) score += 100;
          else if (title.startsWith(query)) score += 50;
          else if (title.includes(query)) score += 30;
          const titleMatches = queryTokens.filter(t => title.includes(t)).length;
          score += (titleMatches * 10);
          const acronym = item.title.split(' ').map(w => w[0]).join('').toLowerCase();
          if (acronym === query) score += 30;
          if (platform.includes(query)) score += 15;
          if (desc.includes(query)) score += 5;
          if (score < 20) {
            const dist = getLevenshteinDistance(query, title);
            if (dist <= 3) score += (15 - (dist * 3));
          }
          return { item, score };
        }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).map(r => r.item);
    } else {
       if (sortOption === 'time') {
           result = [...result].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
       } else if (sortOption === 'rating') {
           result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
       } else if (sortOption === 'popularity') {
           result = [...result].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
       }
    }
    return result;
  }, [releases, category, debouncedSearch, sortOption]);

  const handlePrevDay = () => { const newDate = new Date(currentDate); newDate.setDate(currentDate.getDate() - 1); setCurrentDate(newDate); };
  const handleNextDay = () => { const newDate = new Date(currentDate); newDate.setDate(currentDate.getDate() + 1); setCurrentDate(newDate); };
  
  // Swipe Handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null; 
    touchStart.current = e.targetTouches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };
  const onTouchEnd = () => {
    if (appMode === 'watchlist') return; // Disable swipe in watchlist
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) handleNextDay();
    if (isRightSwipe) handlePrevDay();
  };

  const handleToggleNotify = async (id: string, title: string) => {
    if (notifications.includes(id)) { setConfirmModal({ isOpen: true, id, title }); } 
    else {
      if (!("Notification" in window)) { alert("This browser does not support desktop notifications"); return; }
      if (Notification.permission !== "granted") { const permission = await Notification.requestPermission(); if (permission !== "granted") return; }
      setNotifications(prev => [...prev, id]); sendNativeNotification("Reminder Set!", `You will be notified when ${title} releases.`);
    }
  };
  const confirmRemoveNotification = () => { if (confirmModal) { setNotifications(prev => prev.filter(n => n !== confirmModal.id)); setConfirmModal(null); } };
  const handleToggleWatchlist = (id: string) => { setWatchlist(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]); };
  const handleCategoryChange = (newCat: Category) => { setCategory(newCat); setSearchQuery(''); };

  const toggleAppMode = () => {
    setAppMode(prev => prev === 'daily' ? 'watchlist' : 'daily');
    setCategory('All');
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen flex flex-col pb-12">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={setSettings} />
      <ConfirmationModal isOpen={!!confirmModal} onClose={() => setConfirmModal(null)} onConfirm={confirmRemoveNotification} title="Remove Notification?" message={`Are you sure you want to stop receiving alerts for "${confirmModal?.title}"?`} />

      {/* Modern Two-Tier Header */}
      <header className="sticky top-0 z-40 w-full">
        {/* Top Tier: Branding & Global Actions */}
        <div className="bg-slate-900/90 backdrop-blur-xl border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => setAppMode('daily')}>
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <IconCalendar className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:block">PremierePulse</h1>
            </div>

            {/* Global Actions */}
            <div className="flex items-center gap-3 flex-1 justify-end">
              <div className="relative w-full max-w-md group hidden md:block">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search titles, platforms..." className="w-full bg-slate-800 border border-slate-700/50 rounded-full py-2 pl-10 pr-10 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-500 text-slate-200" />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 rounded-full hover:bg-slate-700 transition"><IconX className="w-3.5 h-3.5" /></button>}
              </div>

               <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
                <div className="relative">
                    <select 
                        value={sortOption} 
                        onChange={(e) => setSortOption(e.target.value as SortOption)}
                        className="appearance-none bg-transparent pl-8 pr-4 py-1.5 text-sm text-slate-300 font-medium focus:outline-none cursor-pointer hover:text-white"
                        title="Sort By"
                    >
                        <option value="popularity" className="bg-slate-800 text-slate-300">Most Popular</option>
                        <option value="rating" className="bg-slate-800 text-slate-300">Rating</option>
                        <option value="time" className="bg-slate-800 text-slate-300">Time</option>
                    </select>
                    <IconSort className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`} title="Grid View"><IconLayoutGrid className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`} title="List View"><IconList className="w-4 h-4" /></button>
              </div>

              <button 
                onClick={toggleAppMode} 
                className={`p-2 rounded-lg transition-all relative ${appMode === 'watchlist' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} 
                title="My Watchlist"
              >
                <IconBookmark className="w-5 h-5" />
                {watchlist.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full"></span>}
              </button>

              <button onClick={() => loadData(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" title="Refresh"><IconRefresh className={`w-5 h-5 ${loading ? 'animate-spin text-indigo-400' : ''}`} /></button>
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" title="Settings"><IconSettings className="w-5 h-5" /></button>
            </div>
          </div>
          
          {/* Mobile Search (visible only on small screens) */}
          <div className="md:hidden px-4 pb-3">
             <div className="relative w-full group">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-slate-800 border border-slate-700/50 rounded-lg py-2 pl-10 pr-10 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-200" />
                 {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"><IconX className="w-3.5 h-3.5" /></button>}
              </div>
          </div>
        </div>

        {/* Bottom Tier: Context Bar (Date & Filter) */}
        <div className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800/50 shadow-sm">
           <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Context Title or Date Navigation */}
              {appMode === 'watchlist' ? (
                  <div className="flex items-center gap-3 bg-slate-950/30 p-2 px-4 rounded-xl border border-indigo-500/20 shadow-inner w-full md:w-auto">
                    <IconBookmarkCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                        <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase block">Tracking</span>
                        <span className="text-lg font-bold text-slate-100">My Watchlist</span>
                    </div>
                    <span className="ml-auto bg-slate-800 text-slate-300 text-xs font-bold px-2 py-1 rounded-md">{filteredReleases.length} items</span>
                  </div>
              ) : (
                  <div className="flex items-center gap-4 bg-slate-950/30 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                      <button onClick={handlePrevDay} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition active:scale-95 border border-slate-700/50" title="Previous Day">
                        <IconChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="flex flex-col items-center min-w-[140px] px-2">
                        <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">{currentDate.toLocaleDateString('en-US', { weekday: 'long' })}</span>
                        <span className="text-xl font-bold text-slate-100 leading-none mt-0.5">{currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <button onClick={handleNextDay} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition active:scale-95 border border-slate-700/50" title="Next Day">
                        <IconChevronRight className="w-5 h-5" />
                      </button>
                  </div>
              )}

              {/* Categories */}
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 no-scrollbar mask-gradient-right">
                {(['All', 'Anime', 'Movie', 'Series', 'Drama', 'Documentary'] as Category[]).map(cat => (
                  <button key={cat} onClick={() => handleCategoryChange(cat)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${category === cat ? 'bg-slate-100 text-slate-900 border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}>
                    {cat}
                  </button>
                ))}
              </div>
           </div>
        </div>
      </header>

      <main 
        className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <IconLoader className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            <p className="text-slate-400 font-medium">{appMode === 'watchlist' ? 'Syncing watchlist details...' : 'Syncing with TMDB, AniList & Trakt...'}</p>
            {appMode !== 'watchlist' && <p className="text-xs text-slate-600 mt-2">Querying direct APIs for schedule ({settings.region || 'US'})</p>}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                <IconWifiOff className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Oops! Connection Failed</h2>
            <p className="text-slate-400 max-w-md mb-8 leading-relaxed">
                {error.includes("404") 
                    ? "We couldn't find the schedule for this specific date. It might be too far in the past or future." 
                    : "We're having trouble connecting to the data sources. Please check your internet connection."}
            </p>
            <button 
                onClick={() => loadData(true)} 
                className="group relative px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95 flex items-center gap-2"
            >
                <IconRefresh className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                <span>Retry Connection</span>
            </button>
          </div>
        ) : filteredReleases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-slate-700 shadow-inner">
                {appMode === 'watchlist' ? <IconBookmark className="w-10 h-10 text-slate-600" /> : <IconSearch className="w-10 h-10 text-slate-600" />}
            </div>
            
            <h2 className="text-2xl font-bold text-slate-200 mb-2">
                {appMode === 'watchlist' ? "Watchlist is Empty" : "No Releases Found"}
            </h2>
            
            <p className="text-slate-400 max-w-sm mb-8 leading-relaxed">
                {appMode === 'watchlist' 
                    ? "You haven't tracked any shows yet. Browse the daily feed and click the bookmark icon to add them here." 
                    : searchQuery 
                        ? `No matches found for "${searchQuery}". Try a different term or check for typos.`
                        : "We couldn't find any releases matching your current filters for this day."}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
                {appMode === 'watchlist' ? (
                    <button onClick={() => { setAppMode('daily'); setCategory('All'); }} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-900/20">
                        Browse Releases
                    </button>
                ) : (
                    <>
                        {(searchQuery || category !== 'All') && (
                            <button 
                                onClick={() => { setSearchQuery(''); setCategory('All'); }} 
                                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium transition"
                            >
                                Clear Filters
                            </button>
                        )}
                        <button 
                            onClick={() => loadData(true)} 
                            className="px-5 py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-lg font-medium transition flex items-center gap-2"
                        >
                            <IconRefresh className="w-4 h-4" />
                            Refresh Data
                        </button>
                    </>
                )}
            </div>
          </div>
        ) : (
          <div className={`${viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6' : 'flex flex-col gap-4 max-w-4xl mx-auto'}`}>
            {filteredReleases.map(item => (
              <ReleaseCard 
                key={item.id} 
                item={item} 
                viewMode={viewMode}
                onToggleNotify={handleToggleNotify}
                onToggleWatchlist={handleToggleWatchlist}
                isNotified={notifications.includes(item.id)}
                isWatchlisted={watchlist.includes(item.id)}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 mt-auto py-8 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 text-center">
           <p className="text-slate-500 text-sm mb-2">Data provided by <span className="text-slate-300">TMDB</span>, <span className="text-slate-300">AniList</span> & <span className="text-slate-300">Trakt</span>.</p>
           <p className="text-slate-600 text-xs">PremierePulse © {new Date().getFullYear()} • Daily Release Tracker</p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
