import React, { useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { fetchDailyReleases } from './services/geminiService';
import { ReleaseItem, Category, FetchResponse } from './types';
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
  IconStar 
} from './components/Icons';

// --- Types ---

interface AppSettings {
  notificationsEnabled: boolean;
  alertTiming: 'at-release' | '15-min-before' | '1-hour-before';
  soundEnabled: boolean;
}

type ViewMode = 'grid' | 'list';

// --- Constants ---

const FALLBACK_IMAGES = {
  Anime: "https://images.unsplash.com/photo-1560167164-61677bc496ae?q=60&w=400&auto=format&fit=crop", 
  Drama: "https://images.unsplash.com/photo-1507676184212-d03ab07a11d0?q=60&w=400&auto=format&fit=crop",
  Movie: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=60&w=400&auto=format&fit=crop", 
  Series: "https://images.unsplash.com/photo-1522869635100-894668ed3a63?q=60&w=400&auto=format&fit=crop", 
  Documentary: "https://images.unsplash.com/photo-1505664194779-8beaceb93744?q=60&w=400&auto=format&fit=crop"
};

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

const PlatformIcon = ({ name, className = "w-3 h-3" }: { name: string; className?: string }) => {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Streaming Services
  if (n.includes('netflix')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#E50914]`}><path d="M14.017 21L14.017 18.0044L14.017 16.0776L21.108 8.79056L21.108 21.0008L24 21.0008L24 2.9928L19.912 2.9928L11.002 12.6072L11.002 5.9928L11.002 2.9928L2.9912 2.9928L2.9912 21L8 21L8 12.3176L14.017 18.8472L14.017 21Z" /></svg>;
  if (n.includes('disney')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#113CCF]`}><path d="M10.86,13.41c-0.5-0.12-1.46-0.34-1.92-0.45l-0.03,0.01c0,0-0.65,2.15-0.65,2.15 c0,0,1.52,0.35,2.02,0.48c0.61,0.16,0.85-0.03,0.92-0.29C11.28,14.93,10.86,13.41,10.86,13.41z M17.43,8.04 c-0.18-0.08-0.38-0.12-0.6-0.12c-0.61,0-1.16,0.32-1.46,0.84c-0.06,0.1-0.1,0.21-0.12,0.32l-0.01,0.04 c-0.01,0.11-0.02,0.22-0.02,0.33c-0.62,4.89-1.99,10.23-6.52,11.23c-0.45,0.1-0.91,0.15-1.37,0.15c-1.89,0-3.61-0.85-4.73-2.16 c-0.26-0.31-0.49-0.63-0.7-0.97c-0.81-1.33-1.28-2.9-1.28-4.57c0-2.3,0.88-4.39,2.33-5.93c1.4-1.49,3.37-2.42,5.55-2.42 c0.69,0,1.35,0.09,1.99,0.27c0.41,0.11,0.81,0.26,1.2,0.43c0.16-0.6,0.7-1.04,1.35-1.04c0.77,0,1.4,0.63,1.4,1.4 c0,0.15-0.02,0.29-0.07,0.43c1.23,0.56,2.33,1.36,3.24,2.35l-1.35,1.32C17.75,8.5,17.43,8.04,17.43,8.04z" /></svg>;
  if (n.includes('amazon') || n.includes('prime')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#00A8E1]`}><path d="M19.46 16.29C19.1 16.48 18.72 16.59 18.32 16.59C17.65 16.59 17.15 16.29 17.15 15.68V10.74C17.15 9.77 16.74 9.17 15.74 9.17C14.71 9.17 14.15 9.89 14.15 11.08V15.68H11.95V10.74C11.95 9.77 11.54 9.17 10.53 9.17C9.5 9.17 8.95 9.89 8.95 11.08V16.4H6.75V8.16H8.95V8.89C9.27 8.35 10 7.96 10.92 7.96C11.83 7.96 12.63 8.35 13 9.07C13.43 8.35 14.22 7.96 15.13 7.96C17.12 7.96 19.35 9.05 19.35 11.56V16.4H21.55V11.09C21.55 10.27 22.21 9.61 23.03 9.61H24V7.41H23.03C21 7.41 19.35 9.05 19.35 11.09V14.51C19.35 15.3 19.78 15.93 20.46 16.14L19.46 16.29ZM13.84 21.05C11.97 22.06 7.42 22.56 3.03 21.09C1.94 20.72 0.44 20.07 0 19.33C0.84 19.26 2.44 19.41 3.23 19.38C6.91 19.23 11.39 18.3 13.9 16.89C14.17 16.74 14.79 17.27 14.65 17.47C14.53 17.64 14.27 17.81 13.84 21.05Z" /></svg>;
  if (n.includes('crunchy')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#F47521]`}><path d="M4.69,15.82a6.38,6.38,0,0,1,6-9,6.23,6.23,0,0,1,3.46,1,7.24,7.24,0,0,0-2.82-.57,7.12,7.12,0,0,0-7.13,7.13,7.27,7.27,0,0,0,.52,2.7A6.32,6.32,0,0,1,4.69,15.82Zm14.28-7a5.57,5.57,0,0,1-.9,3.27,5.65,5.65,0,0,1-3,2.23,6.34,6.34,0,0,0,3.3-1.68A6.2,6.2,0,0,0,20.25,8.2a6,6,0,0,0-.31-1.92A5.63,5.63,0,0,1,19,8.78Zm-7.79,3.69a4.83,4.83,0,0,0-4.83,4.83,4.68,4.68,0,0,0,.76,2.6A5.56,5.56,0,0,1,6,17.3a5.59,5.59,0,0,1,5.59-5.59,5.71,5.71,0,0,1,2.83.75A4.8,4.8,0,0,0,11.18,12.47Z" /></svg>;
  if (n.includes('funimation')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#5D0084]`}><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12 12-12C5.373 0 0 5.373 0 12zm8.5 3h-5v5h5v3.5h-5v-1.5h-2v1.5h-1.5v-1.5h-2v1.5H8.5V15h-2v3.5H3V7.5h15.5V15z" /></svg>;
  if (n.includes('hbo') || n.includes('max')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-white`}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6zm4 4h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>;
  if (n.includes('youtube')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#FF0000]`}><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>;
  if (n.includes('viki')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#00A3E0]`}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-1.3 0-2.43-.37-3.3-1.01l.9-1.42c.67.43 1.5.67 2.4.67 1.55 0 2.5-1.01 2.5-2.67V7h2v5.6c0 2.67-1.74 4.4-4.5 4.4zm-5-3.5H5V7h2v6.5zm-2.8-1.7L3.1 9.9 5 7h1.6l-2.4 3.6z"/></svg>;
  if (n.includes('peacock')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-white`}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/></svg>;
  if (n.includes('paramount')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#0064FF]`}><circle cx="12" cy="12" r="10"/></svg>;
  if (n.includes('tubi')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#FA4221]`}><circle cx="12" cy="12" r="10"/></svg>;
  if (n.includes('pluto')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-white`}><circle cx="12" cy="12" r="10"/></svg>;
  if (n.includes('apple')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#A2AAAD]`}><path d="M17.1,12.7c0-2.5,2-3.7,2.1-3.8c-1.1-1.6-2.9-1.8-3.5-1.9c-1.5-0.1-2.9,0.9-3.7,0.9c-0.8,0-1.9-0.8-3.1-0.8 C7.3,7.2,5.7,8,4.9,9.5C3.2,12.3,4.4,16.5,6.1,18.9c0.8,1.2,1.8,2.5,3,2.4c1.2-0.1,1.7-0.8,3.1-0.8c1.5,0,1.9,0.8,3.1,0.7 c1.3-0.1,2.1-1.2,2.9-2.3c0.9-1.3,1.3-2.6,1.3-2.6C19.3,16.3,17.1,15.1,17.1,12.7z M15,5.5c0.7-0.8,1.1-1.9,1-3 c-0.9,0-2.1,0.6-2.7,1.4C12.7,4.7,12.3,5.8,12.4,6.9C13.4,6.9,14.5,6.3,15,5.5z"/></svg>;
  if (n.includes('hulu')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#1CE783]`}><rect x="2" y="5" width="20" height="14" rx="2" /></svg>;
  if (n.includes('hidive')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#00AEEF]`}><rect x="2" y="2" width="20" height="20" rx="2" /></svg>;
  if (n.includes('bilibili')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#00A1D6]`}><rect x="2" y="5" width="20" height="14" rx="2" /></svg>;
  if (n.includes('iqiyi')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#00CC36]`}><rect x="2" y="5" width="20" height="14" rx="2" /></svg>;
  if (n.includes('rakuten')) return <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#BF0000]`}><circle cx="12" cy="12" r="10" /></svg>;
  
  // Generic Fallbacks
  if (n.includes('theater')) return <IconMovie className={`${className} text-amber-500`} />;
  if (n.includes('tv') || n.includes('channel') || n.includes('network') || n.includes('bbc') || n.includes('abc') || n.includes('nbc') || n.includes('cbs') || n.includes('fox') || n.includes('cw') || n.includes('syfy') || n.includes('fx') || n.includes('amc')) {
      return <IconTv className={`${className} text-slate-400`} />;
  }
  return <IconExternal className={`${className} text-slate-400`} />;
};

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

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
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
                {item.rating && (
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                    <IconStar className="w-3 h-3 fill-amber-400" /> {item.rating.toFixed(1)}
                  </span>
                )}
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
    <div className="group relative bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/20">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity duration-500 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500 via-purple-500 to-transparent" />
      <div className="relative aspect-[2/3] bg-slate-900 overflow-hidden cursor-pointer" onClick={() => (item.deepLink || item.link) && window.open(item.deepLink || item.link, '_blank')}>
        {imgState === 'loading' && <div className="absolute inset-0 bg-slate-800 animate-pulse z-10" />}
        {lowResUrl && imgState !== 'error' && <img src={lowResUrl} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 blur-sm scale-110 ${imgState === 'high-res-loaded' ? 'opacity-0' : 'opacity-100'}`} onLoad={handleLowResLoad} alt="" />}
        {imgSrc && imgState !== 'error' ? <img src={imgSrc} alt={item.title} loading="lazy" decoding="async" onLoad={handleHighResLoad} onError={handleError} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imgState === 'high-res-loaded' ? 'opacity-100' : 'opacity-0'}`} /> : <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/80 p-6 text-center"><IconTv className="w-10 h-10 text-slate-400" /><span className="text-xs text-slate-500 font-medium">{item.category}</span></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-80" />
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
           <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md shadow-lg ${badgeColor}`}>{item.category}</span>
           <div className="flex gap-1">
             {item.rating && <span className="px-2 py-1 rounded-md bg-slate-900/80 text-amber-400 text-xs font-bold backdrop-blur-md border border-slate-700 shadow-lg flex items-center gap-1"><IconStar className="w-3 h-3 fill-amber-400" />{item.rating.toFixed(1)}</span>}
             {item.episode && <span className="px-2 py-1 rounded-md bg-slate-900/80 text-slate-200 text-xs font-bold backdrop-blur-md border border-slate-700 shadow-lg">{item.episode}</span>}
           </div>
        </div>
        <div className="absolute bottom-3 left-3 group/time z-20">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 ${countdown && !countdown.isPast ? 'bg-amber-600 text-white border-amber-500/50' : 'bg-indigo-600 text-white border-indigo-500/50'} rounded-lg shadow-lg font-bold text-sm backdrop-blur-sm border`}>
            <IconClock className="w-3.5 h-3.5" /> <TimeDisplay />
          </div>
        </div>
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
      <div className="p-4 relative bg-slate-800">
        <h3 className="font-bold text-slate-100 text-lg leading-tight mb-3 line-clamp-1 group-hover:text-indigo-400 transition-colors" title={item.title}><HighlightText text={item.title} highlight={searchQuery} /></h3>
        {platforms.length > 0 && <div className="flex flex-wrap gap-2 mb-4">{platforms.map(p => <div key={p} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-slate-700/50 border border-slate-600/50 text-[10px] text-slate-300"><PlatformIcon name={p} className="w-3 h-3" /><span>{p}</span></div>)}</div>}
        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-700/50">
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
  const [notifications, setNotifications] = useState<string[]>(() => JSON.parse(localStorage.getItem('premierepulse_notifications') || '[]'));
  const [watchlist, setWatchlist] = useState<string[]>(() => JSON.parse(localStorage.getItem('premierepulse_watchlist') || '[]'));
  const [settings, setSettings] = useState<AppSettings>(() => JSON.parse(localStorage.getItem('premierepulse_settings') || '{"notificationsEnabled": true, "alertTiming": "at-release", "soundEnabled": false}'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, id: string, title: string} | null>(null);

  useEffect(() => { localStorage.setItem('premierepulse_notifications', JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem('premierepulse_watchlist', JSON.stringify(watchlist)); }, [watchlist]);
  useEffect(() => { localStorage.setItem('premierepulse_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('premierepulse_view_mode', viewMode); }, [viewMode]);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const cacheKey = `premierepulse_cache_${currentDate.toLocaleDateString('en-CA')}`;
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
      const response: FetchResponse = await fetchDailyReleases(currentDate);
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

  useEffect(() => { loadData(); }, [currentDate]);

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
    }
    return result;
  }, [releases, category, debouncedSearch]);

  const handlePrevDay = () => { const newDate = new Date(currentDate); newDate.setDate(currentDate.getDate() - 1); setCurrentDate(newDate); };
  const handleNextDay = () => { const newDate = new Date(currentDate); newDate.setDate(currentDate.getDate() + 1); setCurrentDate(newDate); };
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

  return (
    <div className="min-h-screen pb-12">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={setSettings} />
      <ConfirmationModal isOpen={!!confirmModal} onClose={() => setConfirmModal(null)} onConfirm={confirmRemoveNotification} title="Remove Notification?" message={`Are you sure you want to stop receiving alerts for "${confirmModal?.title}"?`} />

      {/* Modern Two-Tier Header */}
      <header className="sticky top-0 z-40 w-full">
        {/* Top Tier: Branding & Global Actions */}
        <div className="bg-slate-900/90 backdrop-blur-xl border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
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
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`} title="Grid View"><IconLayoutGrid className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`} title="List View"><IconList className="w-4 h-4" /></button>
              </div>

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
              
              {/* Centered Large Date Navigation */}
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

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading && releases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <IconLoader className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            <p className="text-slate-400 font-medium">Syncing with TMDB, AniList & Trakt...</p>
            <p className="text-xs text-slate-600 mt-2">Querying direct APIs for schedule</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4"><IconWifiOff className="w-8 h-8 text-red-500" /></div>
            <h2 className="text-2xl font-bold text-slate-200 mb-2">Connection Issue</h2>
            <p className="text-slate-400 max-w-md mb-6">{error}</p>
            <button onClick={() => loadData(true)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition flex items-center gap-2"><IconRefresh className="w-4 h-4" /> Try Again</button>
          </div>
        ) : filteredReleases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-80">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700"><IconSearch className="w-8 h-8 text-slate-500" /></div>
            <h2 className="text-xl font-bold text-slate-200 mb-2">No results found</h2>
            <p className="text-slate-400">Try adjusting your search or filters.</p>
            {category !== 'All' && <button onClick={() => setCategory('All')} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm underline">View all categories</button>}
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