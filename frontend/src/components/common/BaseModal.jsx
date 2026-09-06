import React, { useEffect } from "react";

export default function BaseModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  children,
  footer,
  maxWidth = "max-w-2xl",
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xl w-full ${maxWidth} flex flex-col max-h-[90vh] overflow-hidden animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            {icon && <span className="text-xl sm:text-2xl shrink-0 mt-0.5">{icon}</span>}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                  {title}
                </h3>
                {badge && (
                  <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0">
                    {badge}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-all cursor-pointer shrink-0 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto modal-scroll-container flex-1 space-y-4">
          {children}
        </div>

        {/* Modal Optional Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
