"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useEffect,
} from "react";

const DURATION = 4000;

const ToastWithProgress = ({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [width, setWidth] = useState(100);
  const remaining = useRef(DURATION);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef(0);

  const variantClass: Record<ToastVariant, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-slate-200 bg-white text-slate-800",
  };

  const resume = useCallback(() => {
    start.current = Date.now();
    timer.current = setTimeout(onDismiss, remaining.current);
    setIsPaused(false);
  }, [onDismiss]);

  const pause = useCallback(() => {
    clearTimeout(timer.current);
    remaining.current -= Date.now() - start.current;
    setIsPaused(true);
  }, []);

  useEffect(() => {
    // Check if user prefers reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      // If reduced motion is preferred, set width to 0 immediately without animation
      setWidth(0);
      return;
    }

    let frame: number;
    if (!isPaused) {
      const animate = () => {
        const timePassed = Date.now() - start.current;
        const newWidth = 100 - (timePassed / remaining.current) * 100;
        setWidth(newWidth);
        if (newWidth > 0) {
          frame = requestAnimationFrame(animate);
        }
      };
      frame = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(frame);
  }, [isPaused]);

  useEffect(() => {
    // Check if user prefers reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      // If reduced motion is preferred, dismiss toast immediately
      setTimeout(onDismiss, 100);
      return;
    }

    start.current = Date.now();
    timer.current = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timer.current);
      remaining.current -= Date.now() - start.current;
    };
  }, [onDismiss]);

  return (
    <div
      onMouseEnter={pause}
      onMouseLeave={resume}
      className={`relative flex items-center justify-between gap-4 overflow-hidden rounded-lg border px-4 py-3 text-sm shadow-md ${variantClass[toast.variant]}`}
    >
      <span>{toast.message}</span>
      <button
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        ×
      </button>
      <div
        style={{ width: `${width}%` }}
        className="absolute bottom-0 left-0 h-1 bg-black/20 transition-[width] duration-75 ease-linear motion-reduce:transition-none"
      />
    </div>
  );
};

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
    },
    [],
  );

  const onDismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastWithProgress
            key={t.id}
            toast={t}
            onDismiss={() => onDismiss(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}