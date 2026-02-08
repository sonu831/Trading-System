import React from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { Card } from '../../ui';

export default function NotificationToast() {
  const { toasts, removeToast } = useNotifications();

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-80 md:w-96 pointer-events-none">
      {toasts.map((toast) => (
        <div 
          key={toast.id}
          className="pointer-events-auto transform transition-all duration-300 ease-in-out animate-slide-in"
        >
          <Card className="bg-surface border border-accent/20 shadow-xl p-3 backdrop-blur-md bg-opacity-95">
            <div className="flex justify-between items-start">
               <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                      {toast.type === 'BACKFILL_STATS' ? '📊 Data Update' : '🔔 Notification'}
                    </h4>
                    {toast.count > 1 && (
                      <span className="px-2 py-0.5 text-xs bg-primary text-white rounded-full font-bold">
                        {toast.count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-primary mt-1">
                    {toast.message}
                  </p>
                  {toast.count > 1 && (
                    <p className="text-[10px] text-text-tertiary mt-1">
                      Click notification bell to view all
                    </p>
                  )}
               </div>
               <button 
                 onClick={() => removeToast(toast.id)}
                 className="text-text-tertiary hover:text-text-primary ml-2 text-xl leading-none"
               >
                 ×
               </button>
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}
