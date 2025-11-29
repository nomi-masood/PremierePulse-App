import React from 'react';
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
  Video
} from 'lucide-react';

export const IconAnime = ({ className }: { className?: string }) => <Tv className={className} />;
export const IconDrama = ({ className }: { className?: string }) => <Clapperboard className={className} />;
export const IconMovie = ({ className }: { className?: string }) => <Film className={className} />;
export const IconSeries = ({ className }: { className?: string }) => <MonitorPlay className={className} />;
export const IconDocumentary = ({ className }: { className?: string }) => <Video className={className} />;
export const IconCalendar = ({ className }: { className?: string }) => <Calendar className={className} />;
export const IconBell = ({ className }: { className?: string }) => <Bell className={className} />;
export const IconBellActive = ({ className }: { className?: string }) => <CheckCircle className={className} />;
export const IconSearch = ({ className }: { className?: string }) => <Search className={className} />;
export const IconLoader = ({ className }: { className?: string }) => <Loader2 className={className} />;
export const IconExternal = ({ className }: { className?: string }) => <ExternalLink className={className} />;
export const IconInfo = ({ className }: { className?: string }) => <Info className={className} />;
export const IconClock = ({ className }: { className?: string }) => <Clock className={className} />;
export const IconSettings = ({ className }: { className?: string }) => <Settings className={className} />;
export const IconX = ({ className }: { className?: string }) => <X className={className} />;
export const IconAlertTriangle = ({ className }: { className?: string }) => <AlertTriangle className={className} />;
export const IconBookmark = ({ className }: { className?: string }) => <Bookmark className={className} />;
export const IconBookmarkCheck = ({ className }: { className?: string }) => <BookmarkCheck className={className} />;
export const IconWifiOff = ({ className }: { className?: string }) => <WifiOff className={className} />;
export const IconRefresh = ({ className }: { className?: string }) => <RefreshCw className={className} />;