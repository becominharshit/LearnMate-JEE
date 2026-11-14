import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Database, CloudUpload, CheckCircle2 } from 'lucide-react';
import { fetchLazyPyqPack } from '../services/workspaceService';

export interface PwaOfflineAndJobsBarProps {
  pendingSyncCount?: number;
  isAdmin?: boolean;
  onOpenAdminConsole?: () => void;
  onOpenAdminQuestionBank?: () => void;
}

export const PwaOfflineAndJobsBar: React.FC<PwaOfflineAndJobsBarProps> = ({
  pendingSyncCount = 0,
  isAdmin = false,
  onOpenAdminConsole,
  onOpenAdminQuestionBank,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [swReady, setSwReady] = useState<boolean>(false);
  const [cachedPacksCount, setCachedPacksCount] = useState<number>(0);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setSwReady(true))
        .catch(() => setSwReady(false));
    }

    // Pre-warm lazy PYQ packs into offline cache
    Promise.all([
      fetchLazyPyqPack('jee-main-shifts').catch(() => null),
      fetchLazyPyqPack('jee-advanced-papers').catch(() => null),
    ]).then((results) => {
      setCachedPacksCount(results.filter(Boolean).length);
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const showDeveloperConsoles = Boolean(isAdmin || import.meta.env.DEV);

  return (
    <div className="hidden lg:flex fixed bottom-0 inset-x-0 z-30 h-8 bg-white dark:bg-[#111113] border-t border-zinc-200 dark:border-white/[0.07] px-4 lg:px-8 items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
      <div className="flex items-center gap-4">
        <span className="inline-flex items-center gap-1.5">
          {isOnline ? (
            <Wifi className="w-3 h-3 text-emerald-500" />
          ) : (
            <WifiOff className="w-3 h-3 text-amber-500" />
          )}
          <span>{isOnline ? 'Synced' : 'Offline'}</span>
        </span>

        <span className="inline-flex items-center gap-1.5">
          <Database className="w-3 h-3 text-zinc-400" />
          <span className="font-mono tabular-nums">
            PYQ Cache {cachedPacksCount}/2{swReady ? ' · Ready' : ''}
          </span>
        </span>

        {pendingSyncCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-amber-500">
            <CloudUpload className="w-3 h-3 animate-pulse" />
            <span>Syncing {pendingSyncCount}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>58 Chapters Ready</span>
          </span>
        )}
      </div>

      {showDeveloperConsoles && (
        <div className="flex items-center gap-3">
          {onOpenAdminQuestionBank && (
            <button
              type="button"
              onClick={onOpenAdminQuestionBank}
              className="text-[10px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-[#fafafa] cursor-pointer transition-colors duration-150"
            >
              PYQ Bank
            </button>
          )}
          {onOpenAdminConsole && (
            <button
              type="button"
              onClick={onOpenAdminConsole}
              className="text-[10px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-[#fafafa] cursor-pointer transition-colors duration-150"
            >
              Plans Console
            </button>
          )}
        </div>
      )}
    </div>
  );
};
