import React from "react";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-success-900/40 text-success-400 ring-success-500/30",
  warning: "bg-warning-900/40 text-warning-400 ring-warning-500/30",
  danger: "bg-danger-900/40 text-danger-400 ring-danger-500/30",
  info: "bg-info-900/40 text-info-400 ring-info-500/30",
  neutral: "bg-gray-800 text-gray-300 ring-gray-700",
};

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  className,
  ...rest
}) => {
  const classes = [
    "inline-flex items-center px-2 py-0.5 rounded-full text-fluid-xs font-medium ring-1 ring-inset",
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} {...rest} />;
};
