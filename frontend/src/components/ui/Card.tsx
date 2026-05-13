import React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

const cx = (...parts: (string | undefined | false)[]): string =>
  parts.filter(Boolean).join(" ");

export const Card: React.FC<DivProps> = ({ className, children, ...rest }) => (
  <div
    className={cx("bg-gray-800 rounded-lg shadow-soft overflow-hidden", className)}
    {...rest}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<DivProps> = ({ className, children, ...rest }) => (
  <div
    className={cx("px-6 py-4 border-b border-gray-700", className)}
    {...rest}
  >
    {children}
  </div>
);

export const CardBody: React.FC<DivProps> = ({ className, children, ...rest }) => (
  <div className={cx("p-6", className)} {...rest}>
    {children}
  </div>
);

export const CardFooter: React.FC<DivProps> = ({ className, children, ...rest }) => (
  <div
    className={cx("px-6 py-4 border-t border-gray-700", className)}
    {...rest}
  >
    {children}
  </div>
);
