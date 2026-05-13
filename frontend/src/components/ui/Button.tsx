import React from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
  secondary: "bg-gray-700 hover:bg-gray-600 text-white focus:ring-gray-500",
  danger: "bg-danger-600 hover:bg-danger-500 text-white focus:ring-danger-500",
  ghost:
    "bg-transparent hover:bg-gray-800 text-gray-100 focus:ring-gray-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-fluid-sm",
  md: "px-4 py-2 text-fluid-base",
  lg: "px-6 py-3 text-fluid-lg",
};

const baseClasses =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}) => {
  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={classes} {...rest} />;
};
