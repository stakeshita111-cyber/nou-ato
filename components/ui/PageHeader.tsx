"use client";

import React from "react";

type PageHeaderProps = {
  icon?: string;
  title: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
};

export default function PageHeader({ icon, title, subtitle, actionButton }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          {icon && <span>{icon}</span>}
          <span>{title}</span>
        </h1>
        {subtitle && (
          <p className="text-sm text-gray-500 font-medium mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {actionButton && <div>{actionButton}</div>}
    </div>
  );
}
