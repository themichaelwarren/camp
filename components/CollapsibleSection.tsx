import React, { useState, useRef, useEffect, useCallback } from 'react';

interface CollapsibleSectionProps {
  title: string;
  icon?: string;
  storageKey: string;
  defaultOpen?: boolean;
  badge?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  storageKey,
  defaultOpen = false,
  badge,
  headerRight,
  children,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(`collapse-${storageKey}`);
      if (stored !== null) return stored === '1';
    } catch {}
    return defaultOpen;
  });
  const [height, setHeight] = useState<number | 'auto'>(isOpen ? 'auto' : 0);
  const contentRef = useRef<HTMLDivElement>(null);
  const animating = useRef(false);

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(`collapse-${storageKey}`, next ? '1' : '0'); } catch {}
      return next;
    });
  }, [storageKey]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    if (isOpen) {
      // Expanding: set exact height then transition to auto
      const h = el.scrollHeight;
      setHeight(h);
      animating.current = true;
      const timer = setTimeout(() => {
        if (animating.current) {
          setHeight('auto');
          animating.current = false;
        }
      }, 250);
      return () => clearTimeout(timer);
    } else {
      // Collapsing: set exact height first, then 0
      const h = el.scrollHeight;
      setHeight(h);
      animating.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHeight(0);
          const timer = setTimeout(() => { animating.current = false; }, 250);
          return () => clearTimeout(timer);
        });
      });
    }
  }, [isOpen]);

  return (
    <section className={`bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-8 py-5 text-left hover:bg-slate-50/50 transition-colors"
      >
        <i
          className={`fa-solid fa-chevron-right text-slate-300 text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        />
        {icon && <i className={`${icon} text-slate-400 text-sm`}></i>}
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex-1">{title}</h3>
        {badge && !isOpen && (
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{badge}</span>
        )}
        {headerRight && <div onClick={e => e.stopPropagation()}>{headerRight}</div>}
      </button>
      <div
        ref={contentRef}
        style={{ height: height === 'auto' ? 'auto' : `${height}px` }}
        className="transition-[height] duration-250 ease-in-out overflow-hidden"
      >
        <div className="px-8 pb-8">
          {children}
        </div>
      </div>
    </section>
  );
};

export default CollapsibleSection;
