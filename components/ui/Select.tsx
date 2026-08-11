'use client';

import * as React from "react";

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
}

const SelectContext = React.createContext<SelectContextValue>({});

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}

export function Select({ value, onValueChange, children }: SelectProps) {
  return (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return <div className={`relative ${className}`}>{children}</div>;
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = React.useContext(SelectContext);
  return (
    <span className="block truncate text-sm">
      {context.value || placeholder || ""}
    </span>
  );
}

interface SelectItemProps {
  value: string;
  children?: React.ReactNode;
}

export function SelectContent({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(SelectContext);

  const items: Array<{ value: string; label: React.ReactNode }> = [];

  React.Children.forEach(children, (child) => {
    if (React.isValidElement<SelectItemProps>(child) && (child.type as { displayName?: string })?.displayName === 'SelectItem') {
      items.push({ value: child.props.value, label: child.props.children });
    }
  });

  return (
    <select
      value={context.value || ""}
      onChange={(e) => context.onValueChange?.(e.target.value)}
      className={`w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${className}`}
    >
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {typeof item.label === "string" ? item.label : item.value}
        </option>
      ))}
    </select>
  );
}

export function SelectItem({
  value,
  children,
}: SelectItemProps) {
  return null;
}
SelectItem.displayName = "SelectItem";
