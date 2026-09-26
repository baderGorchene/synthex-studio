import React from 'react';
import { ToastMessage } from '@/types/canvas';

interface ToastNotificationProps {
  toast: ToastMessage | null;
  isLight: boolean;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, isLight }) => {
  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-3.5 py-2 rounded-xl border text-xs shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150 select-none ${
        isLight ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-zinc-900/95 border-zinc-700 text-zinc-200'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          toast.type === 'success'
            ? 'bg-emerald-500'
            : toast.type === 'warning'
            ? 'bg-amber-500'
            : toast.type === 'error'
            ? 'bg-rose-500'
            : 'bg-indigo-500'
        }`}
      />
      <span>{toast.msg}</span>
    </div>
  );
};
