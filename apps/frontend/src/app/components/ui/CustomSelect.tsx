'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ElementType;
  description?: string;
  badge?: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  label,
  disabled = false,
  className = '',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const SelectedIcon = selectedOption?.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && <label className="text-[11px] font-semibold text-muted-foreground block mb-1">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full min-h-[40px] text-xs font-semibold px-3 py-2 rounded-xl border border-border bg-secondary/20 text-foreground flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all shadow-xs ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <div className="flex items-center truncate gap-2 min-w-0">
          {SelectedIcon && <SelectedIcon className="w-4 h-4 text-primary shrink-0" />}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180 text-primary' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[9999] top-full mt-1.5 w-full left-0 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-1.5 space-y-1">
          <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-thin pr-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              const OptIcon = opt.icon;

              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                      : 'hover:bg-secondary text-foreground font-medium border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    {OptIcon && <OptIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />}
                    <span className="truncate">{opt.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
