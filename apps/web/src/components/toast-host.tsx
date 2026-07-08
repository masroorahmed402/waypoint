'use client';
import { useEffect, useState } from 'react';
import { TOAST_EVENT } from '@/lib/toast';

export default function ToastHost() {
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  useEffect(() => {
    let nextId = 0;
    function onToast(e: Event) {
      const id = nextId++;
      const message = (e as CustomEvent<string>).detail;
      setToasts((prev) => [...prev, { id, message }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-fade-up rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
