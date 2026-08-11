'use client';

import * as React from "react";

interface RadioGroupContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({});

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className = "", value, onValueChange, children, ...props }, ref) => {
    return (
      <RadioGroupContext.Provider value={{ value, onValueChange }}>
        <div ref={ref} role="radiogroup" className={`grid gap-2 ${className}`} {...props}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ className = "", value, id, disabled = false, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    const checked = context.value === value;

    return (
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        id={id}
        ref={ref}
        disabled={disabled}
        onClick={() => !disabled && context.onValueChange?.(value)}
        className={`aspect-square h-4 w-4 rounded-full border border-slate-400 text-emerald-600 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center cursor-pointer ${
          checked ? "border-emerald-600 bg-white" : "bg-white"
        } ${className}`}
        {...props}
      >
        {checked && (
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
        )}
      </button>
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";
