import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  IconTv
} from './components/Icons';

// --- Types ---

interface AppSettings {
  notificationsEnabled: boolean;
  alertTiming: 'at-release' | '15-min-before' | '1-hour-before';
  soundEnabled: boolean;
}

// --- Constants ---

const FALLBACK_IMAGES = {
  Anime: "https://images.unsplash.com/photo-1560167164-61677bc496ae?q=60&w=400&auto=format&fit=crop", // Tokyo Street (Anime Aesthetic)
  Drama: "https://images.unsplash.com/photo-1507676184212-d03ab07a11d0?q=60&w=400&auto=format&fit=crop", // Red Theater Curtain
  Movie: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=60&w=400&auto=format&fit=crop", // Dark Cinematic Movie Theater
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

const PlatformIcon = ({ name, className = "w-3 h-3" }: { name: string; className?: string }) => {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Netflix (Red)
  if (n.includes('netflix')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#E50914]`}>
        <path d="M14.017 21L14.017 18.0044L14.017 16.0776L21.108 8.79056L21.108 21.0008L24 21.0008L24 2.9928L19.912 2.9928L11.002 12.6072L11.002 5.9928L11.002 2.9928L2.9912 2.9928L2.9912 21L8 21L8 12.3176L14.017 18.8472L14.017 21Z" />
      </svg>
    );
  }

  // Disney+ (Blue)
  if (n.includes('disney')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#113CCF]`}>
        <path d="M10.86,13.41c-0.5-0.12-1.46-0.34-1.92-0.45l-0.03,0.01c0,0-0.65,2.15-0.65,2.15 c0,0,1.52,0.35,2.02,0.48c0.61,0.16,0.85-0.03,0.92-0.29C11.28,14.93,10.86,13.41,10.86,13.41z M17.43,8.04 c-0.18-0.08-0.38-0.12-0.6-0.12c-0.61,0-1.16,0.32-1.46,0.84c-0.06,0.1-0.1,0.21-0.12,0.32l-0.01,0.04 c-0.01,0.11-0.02,0.22-0.02,0.33c-0.62,4.89-1.99,10.23-6.52,11.23c-0.45,0.1-0.91,0.15-1.37,0.15c-1.89,0-3.61-0.85-4.73-2.16 c-0.26-0.31-0.49-0.63-0.7-0.97c-0.81-1.33-1.28-2.9-1.28-4.57c0-2.3,0.88-4.39,2.33-5.93c1.4-1.49,3.37-2.42,5.55-2.42 c0.69,0,1.35,0.09,1.99,0.27c0.41,0.11,0.81,0.26,1.2,0.43c0.16-0.6,0.7-1.04,1.35-1.04c0.77,0,1.4,0.63,1.4,1.4 c0,0.15-0.02,0.29-0.07,0.43c1.23,0.56,2.33,1.36,3.24,2.35l-1.35,1.32C17.75,8.5,17.43,8.04,17.43,8.04z" />
      </svg>
    );
  }

  // Amazon Prime (Blue/Cyan)
  if (n.includes('amazon') || n.includes('prime')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#00A8E1]`}>
        <path d="M19.46 16.29C19.1 16.48 18.72 16.59 18.32 16.59C17.65 16.59 17.15 16.29 17.15 15.68V10.74C17.15 9.77 16.74 9.17 15.74 9.17C14.71 9.17 14.15 9.89 14.15 11.08V15.68H11.95V10.74C11.95 9.77 11.54 9.17 10.53 9.17C9.5 9.17 8.95 9.89 8.95 11.08V16.4H6.75V8.16H8.95V8.89C9.27 8.35 10 7.96 10.92 7.96C11.83 7.96 12.63 8.35 13 9.07C13.43 8.35 14.22 7.96 15.13 7.96C17.12 7.96 19.35 9.05 19.35 11.56V16.4H21.55V11.09C21.55 10.27 22.21 9.61 23.03 9.61H24V7.41H23.03C21 7.41 19.35 9.05 19.35 11.09V14.51C19.35 15.3 19.78 15.93 20.46 16.14L19.46 16.29ZM13.84 21.05C11.97 22.06 7.42 22.56 3.03 21.09C1.94 20.72 0.44 20.07 0 19.33C0.84 19.26 2.44 19.41 3.23 19.38C6.91 19.23 11.39 18.3 13.9 16.89C14.17 16.74 14.79 17.27 14.65 17.47C14.53 17.64 14.27 17.81 13.84 21.05Z" />
      </svg>
    );
  }

  // Crunchyroll (Orange)
  if (n.includes('crunchy')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#F47521]`}>
        <path d="M4.69,15.82a6.38,6.38,0,0,1,6-9,6.23,6.23,0,0,1,3.46,1,7.24,7.24,0,0,0-2.82-.57,7.12,7.12,0,0,0-7.13,7.13,7.27,7.27,0,0,0,.52,2.7A6.32,6.32,0,0,1,4.69,15.82Zm14.28-7a5.57,5.57,0,0,1-.9,3.27,5.65,5.65,0,0,1-3,2.23,6.34,6.34,0,0,0,3.3-1.68A6.2,6.2,0,0,0,20.25,8.2a6,6,0,0,0-.31-1.92A5.63,5.63,0,0,1,19,8.78Zm-7.79,3.69a4.83,4.83,0,0,0-4.83,4.83,4.68,4.68,0,0,0,.76,2.6A5.56,5.56,0,0,1,6,17.3a5.59,5.59,0,0,1,5.59-5.59,5.71,5.71,0,0,1,2.83.75A4.8,4.8,0,0,0,11.18,12.47Z" />
      </svg>
    );
  }

  // Funimation (Purple)
  if (n.includes('funimation')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#5D0084]`}>
         <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18.632c-3.662 0-6.632-2.97-6.632-6.632S8.338 5.368 12 5.368s6.632 2.97 6.632 6.632-2.97 6.632-6.632 6.632z"/>
         <path d="M14.61 12.053c0 .878-.71 1.588-1.588 1.588H9.368V9.368h3.654c.878 0 1.588.71 1.588 1.588v1.097z"/>
      </svg>
    );
  }

  // HIDIVE (Blue)
  if (n.includes('hidive')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#00AEEF]`}>
        <path d="M2 4h20v16H2V4zm4 4v8h3v-2h2v2h3v-8h-3v2H9V8H6z"/>
      </svg>
    );
  }

  // Hulu (Green)
  if (n.includes('hulu')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#1CE783]`}>
        <path d="M20.2 16.6h2.8V6.4h-2.8v5.8c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V6.4h-2.8v5.8c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V6.4H4.3v5.8c0 3 2.4 5.4 5.4 5.4 1.2 0 2.2-.4 3.1-1 1 .7 2.1 1 3.3 1 1.2 0 2.4-.4 3.3-1 .1.6.5 1 .8 1z"/>
      </svg>
    );
  }

  // Apple TV (Grey/White)
  if (n.includes('apple')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-slate-300`}>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.55 1.48-.55 2.83-1.3 3.32-.94.71-2.43 1.01-3.4.47-.59-1.42.56-2.76 1.3-3.25C10.54 3.32 12.44 2.96 13 3.5z" />
      </svg>
    );
  }
  
  // HBO / Max (Purple)
  if (n.includes('hbo') || n.includes('max')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#7E5BEC]`}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    );
  }

  // Peacock (Colorful/Yellow)
  if (n.includes('peacock')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#EFA400]`}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/>
      </svg>
    );
  }

  // Paramount+ (Blue)
  if (n.includes('paramount')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#0064FF]`}>
        <path d="M22 12l-2.5-4.33L17 3.34 14.5 7.67 12 12l2.5 4.33 2.5 4.33 2.5-4.33L22 12zM2 12l2.5 4.33 2.5 4.33 2.5-4.33L12 12 9.5 7.67 7 3.34 4.5 7.67 2 12z"/>
      </svg>
    );
  }

  // YouTube (Red)
  if (n.includes('youtube')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#FF0000]`}>
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    );
  }
  
  // TMDB (Green/Blue)
  if (n.includes('tmdb') || n.includes('themoviedb')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#90CEA1]`}>
         <path d="M2 5h20v14H2V5zm2 2v10h16V7H4z"/>
      </svg>
    );
  }
  
  // AniList (Blue)
  if (n.includes('anilist')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#3DB4F2]`}>
        <path d="M6 5.5l-2 13H1l5-16h4l5 16h-3l-2-6H6z M8.8 10L7.2 6.5L5.6 10H8.8z M17 15.5h5v3h-5V15.5z"/>
      </svg>
    );
  }

  // Theaters / Cinema (Generic Film Icon)
  if (n.includes('theater') || n.includes('cinema')) {
    return <IconMovie className={`${className} text-amber-400`} />;
  }

  // Common US Networks (Color coded)
  if (n.includes('amc')) return <IconTv className={`${className} text-slate-200`} />;
  if (n.includes('bbc')) return <IconTv className={`${className} text-pink-500`} />; // iPlayer Pink
  if (n.includes('fx')) return <IconTv className={`${className} text-slate-100`} />;
  if (n.includes('showtime')) return <IconTv className={`${className} text-red-600`} />;
  if (n.includes('starz')) return <IconTv className={`${className} text-white`} />;

  // Fallback
  return <IconTv className={`${className} text-slate-500`} />;
};

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
  // This state machine acts as the "imgError" manager for fallback logic
  const [imgSrcType, setImgSrcType] = useState<'primary' | 'bing' | 'unsplash' | 'fallback'>('primary');
  
  // Progressive loading states
  const [isLowResLoaded, setIsLowResLoaded] = useState(false);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Initialize state based on item availability
  useEffect(() => {
    setIsLowResLoaded(false);
    setIsHighResLoaded(false);
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
  const getImgSrcs = () => {
    // 1. Primary Source (TMDB)
    if (imgSrcType === 'primary' && item.imageUrl) {
      // TMDB Image manipulation for progressive loading
      // API returns w500 by default in our service.
      const highRes = item.imageUrl;
      let lowRes = null;

      if (highRes.includes('image.tmdb.org')) {
        // Create a tiny blur placeholder from TMDB
        lowRes = highRes.replace('/w500/', '/w92/');
      } else if (item.category === 'Anime' && item.imageUrl) {
        // AniList returns large/extraLarge.
        return { low: null, high: highRes };
      }

      return { low: lowRes, high: highRes };
    }

    // 2. Bing Image Proxy for exact match
    if (imgSrcType === 'bing') {
      const query = encodeURIComponent(`${item.title} ${item.category} poster vertical`);
      // Bing URL (Standard quality)
      const highRes = `https://tse2.mm.bing.net/th?q=${query}&w=400&h=600&c=7&rs=1&p=0&dpr=2&pid=1.7&mkt=en-US&adlt=moderate`;
      return { low: null, high: highRes };
    }

    // 3. Optimized Unsplash abstract based on category
    if (imgSrcType === 'unsplash') {
      const original = FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.Movie;
      // Generate tiny placeholder
      const lowRes = original.replace('q=60&w=400', 'q=10&w=50');
      return { low: lowRes, high: original };
    }

    return { low: null, high: null }; 
  };

  const { low: lowResUrl, high: highResUrl } = getImgSrcs();

  const handleError = () => {
    // Determine next state in waterfall
    if (imgSrcType === 'primary') setImgSrcType('bing');
    else if (imgSrcType === 'bing') setImgSrcType('unsplash');
    else setImgSrcType('fallback');
    
    // Reset loaded status so skeleton shows for the new source attempt
    setIsHighResLoaded(false);
    setIsLowResLoaded(false);
  };

  // Timezone formatting
  const timeZoneInfo = useMemo(() => {
    try {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Get abbreviation if possible
      const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date());
      const abbr = parts.find(p => p.type === 'timeZoneName')?.value || resolved;
      return { name: resolved, abbr };
    } catch(e) { return { name: 'Local Time', abbr: 'LOC' }; }
  }, []);

  // Determine if we should show the skeleton: 
  // Show if High Res isn't loaded AND (Low Res isn't loaded OR we don't have a low res option)
  // But if we are in fallback mode (icons), don't show skeleton
  const showSkeleton = !isHighResLoaded && (!isLowResLoaded || !lowResUrl) && imgSrcType !== 'fallback';

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
        
        {/* Skeleton Loader - Layer 0 */}
        <div className={`absolute inset-0 z-20 bg-slate-800 flex items-center justify-center transition-opacity duration-700 ${showSkeleton ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 animate-shimmer bg-[length:200%_100%]" 
               style={{ animation: 'shimmer 2s infinite linear' }}
          />
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}} />
          <IconLoader className="w-8 h-8 text-indigo-500/50 animate-spin relative z-10" />
        </div>

        {imgSrcType !== 'fallback' ? (
          <>
             {/* Low Res Blur Placeholder - Layer 1 */}
             {lowResUrl && (
               <img 
                 src={lowResUrl}
                 alt=""
                 className={`absolute inset-0 w-full h-full object-cover filter blur-md scale-105 transition-opacity duration-700 z-0 ${isHighResLoaded ? 'opacity-0' : 'opacity-100'}`}
                 onLoad={() => setIsLowResLoaded(true)}
               />
             )}
             
             {/* High Res Image - Layer 2 */}
             {highResUrl && (
                <img 
                  key={`${item.id}-${imgSrcType}`} // Force re-mount on source switch
                  src={highResUrl} 
                  alt={item.title}
                  className={`relative z-10 w-full h-full object-cover transition-opacity duration-700 ${isHighResLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setIsHighResLoaded(true)}
                  onError={handleError}
                  loading="lazy"
                  decoding="async"
                />
             )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-600 p-4 text-center animate-in fade-in">
            {item.category === 'Anime' ? <IconAnime className="w-12 h-12 mb-2 opacity-50" /> :
             item.category === 'Drama' ? <IconDrama className="w-12 h-12 mb-2 opacity-50" /> :
             item.category === 'Movie' ? <IconMovie className="w-12 h-12 mb-2 opacity-50" /> :
             item.category === 'Series' ? <IconSeries className="w-12 h-12 mb-2 opacity-50" /> :
             <IconDocumentary className="w-12 h-12 mb-2 opacity-50" />}
            <span className="text-xs uppercase tracking-wider font-medium opacity-50">{item.category}</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-90 z-20 pointer-events-none" />

        {/* Hover Detail Overlay */}
        <div className={`absolute inset-0 bg-slate-900/80 backdrop-blur-sm p-6 flex flex-col justify-center transition-all duration-300 z-30 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <h4 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider mb-2">Synopsis</h4>
          <p className="text-slate-300 text-sm leading-relaxed line-clamp-6">
            <HighlightText text={item.description || "No description available for this release."} highlight={searchQuery || ''} />
          </p>
        </div>

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-30 pointer-events-none">
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
            className="absolute bottom-3 left-3 z-40"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/90 text-white shadow-lg shadow-indigo-900/50 backdrop-blur-md border border-indigo-500/50 hover:bg-indigo-600 transition-colors cursor-help">
              <IconClock className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase">{item.time.replace(/Available now/i, 'NOW')}</span>
            </div>
            {/* Tooltip */}
            <div className={`absolute bottom-full left-0 mb-2 w-56 bg-slate-900/95 text-slate-200 text-xs rounded-xl p-4 shadow-2xl border border-slate-700/80 backdrop-blur-xl transition-all transform origin-bottom-left z-50 ${showTooltip ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}`}>
               <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700/50">
                 <IconCalendar className="w-3.5 h-3.5 text-indigo-400" />
                 <span className="font-bold text-white tracking-wide">Schedule Details</span>
               </div>
               
               <div className="space-y-1.5">
                 <div className="flex justify-between">
                    <span className="text-slate-400">Date:</span>
                    <span className="text-slate-100 font-medium">{item.releaseDate}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-400">Time:</span>
                    <span className="text-slate-100 font-medium">{item.time}</span>
                 </div>
                 {/* Only show timezone info if it looks like a time */}
                 {/\d/.test(item.time) && (
                   <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/30">
                      <span className="text-slate-500 text-[10px] uppercase tracking-wider">Timezone</span>
                      <span className="text-indigo-300 font-bold text-[10px] bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                        {timeZoneInfo.name.replace(/_/g, ' ')}
                      </span>
                   </div>
                 )}
               </div>
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

        {/* Platform / Network Badge - Visible on Card Body */}
        {item.platform && (
          <div className="flex flex-wrap gap-2 mb-4">
             {item.platform.split(',').slice(0, 2).map((p, i) => (
               <div key={`${p}-${i}`} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-700/40 border border-slate-600/50">
                 <PlatformIcon name={p} className="w-4 h-4" />
                 <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300">{p.trim()}</span>
               </div>
             ))}
          </div>
        )}

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
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Explicitly defining state property to fix TS error "Property 'state' does not exist"
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
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
    // Cast this to any to access props safely without generic overhead
    return (this as any).props.children;
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
  
  // Guard to prevent double fetching in Strict Mode
  const dataFetchedRef = useRef(false);

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

    // Prevent double invocation
    if (dataFetchedRef.current) return;
    dataFetchedRef.current = true;
    
    loadData(false); // Initial load, check cache first
  }, []);

  const loadData = async (forceRefresh: boolean = false) => {
    if (!forceRefresh) setError(null);
    
    const todayKey = new Date().toLocaleDateString('en-CA');
    const CACHE_KEY = 'premiere_pulse_cache_v1';
    const REVALIDATE_WINDOW = 60 * 60 * 1000; // 1 Hour

    let usingCache = false;

    // 1. Try Cache Strategy (if not forced)
    if (!forceRefresh) {
        try {
            const cachedRaw = localStorage.getItem(CACHE_KEY);
            if (cachedRaw) {
                const { date, timestamp, data } = JSON.parse(cachedRaw);
                
                // STRICT CHECK: Date must match today
                if (date !== todayKey) {
                    console.debug(`[Cache] Date mismatch. Saved: ${date}, Today: ${todayKey}. Invalidating.`);
                    localStorage.removeItem(CACHE_KEY);
                    usingCache = false; 
                } else if (data?.items?.length > 0) {
                    console.debug("[Cache] Hit found for today.");
                    setData(data);
                    usingCache = true;
                    
                    // Check if stale (older than window)
                    const age = Date.now() - (timestamp || 0);
                    if (age < REVALIDATE_WINDOW) {
                        console.debug(`[Cache] Data is fresh (${(age/1000/60).toFixed(1)}m old). Skipping network.`);
                        setLoading(false);
                        return; // Exit, no network needed
                    } else {
                        console.debug("[Cache] Data is stale. Revalidating in background...");
                        // Continue to network block below, but since usingCache is true, we won't show the full spinner
                    }
                }
            }
        } catch (e) {
            console.warn("[Cache] Parse failed, clearing.", e);
            localStorage.removeItem(CACHE_KEY);
        }
    }

    // 2. Network Strategy
    // Only show full loading spinner if we have no valid cache (or forced refresh)
    if (!usingCache) {
        setLoading(true);
        setError(null);
    }

    try {
      const response = await fetchDailyReleases(new Date());
      
      // Update state
      setData(response);
      
      // Update Cache
      if (response.items.length > 0) {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            date: todayKey,
            timestamp: Date.now(),
            data: response
        }));
      }
      
      console.debug("[Network] Data updated successfully.");
    } catch (err: any) {
      console.error("[Network] Fetch failed.", err);
      
      // If we are relying on background update (usingCache=true) and it failed, keep showing cached data silently
      // If we are showing loading screen (usingCache=false), we MUST show error
      if (!usingCache) {
          if (err?.message?.includes('429') || err?.status === 429) {
              setError("Traffic is high right now. The daily limit for the AI service has been reached. Please try again later.");
          } else {
              setError("Failed to load today's releases. Please check your internet connection and try again.");
          }
      } else {
          console.warn("Background revalidation failed, keeping stale data.");
      }
    } finally {
      // Always turn off loading spinner when done
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
               onClick={() => loadData(true)} // Force refresh new data
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
            <p className="mt-8 text-slate-400 text-lg font-medium animate-pulse">Scanning Data Sources...</p>
            <p className="text-slate-600 text-sm mt-2">Syncing schedules from TMDB & AniList</p>
          </div>
        ) : error ? (
           <div className="flex flex-col items-center justify-center py-20 bg-slate-800/30 border border-red-500/20 rounded-3xl p-8 text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <IconWifiOff className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Connection Issue</h3>
              <p className="text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">{error}</p>
              <button 
                onClick={() => loadData(true)} // Retry implies new attempt
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
                Powered by <span className="text-indigo-400 font-medium">TMDB API</span> & <span className="text-pink-400 font-medium">AniList API</span>.
              </p>
              <div className="flex gap-4 text-xs text-slate-600">
                <span>• Movies (TMDB)</span>
                <span>• TV Series (TMDB)</span>
                <span>• Anime (AniList/MAL)</span>
                <span>• Dramas (TMDB)</span>
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