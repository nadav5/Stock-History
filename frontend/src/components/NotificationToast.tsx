import React from 'react';
import { ShieldAlert, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isWarning = toast.type === 'warning';
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl p-3.5 shadow-2xl border flex items-start gap-3 backdrop-blur-md transition-all animate-in slide-in-from-bottom-3 ${
              isWarning
                ? 'bg-rose-950/90 border-rose-600/50 text-rose-100'
                : isSuccess
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
                : isError
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
                : 'bg-slate-900/95 border-slate-700 text-slate-100'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isWarning && <ShieldAlert className="h-4 w-4 text-rose-400" />}
              {isSuccess && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              {isError && <ShieldAlert className="h-4 w-4 text-rose-400" />}
              {!isWarning && !isSuccess && !isError && <Info className="h-4 w-4 text-cyan-400" />}
            </div>

            <div className="flex-1 text-xs">
              <div className="font-bold mb-0.5">{toast.title}</div>
              <p className="text-[11px] opacity-90 leading-relaxed">{toast.message}</p>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
