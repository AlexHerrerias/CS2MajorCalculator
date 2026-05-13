import React from "react";

const cx = (...parts: (string | undefined | false)[]): string =>
  parts.filter(Boolean).join(" ");

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div className="overflow-x-auto md:overflow-visible">
    <table className={cx("w-full text-fluid-sm text-gray-200", className)} {...rest}>
      {children}
    </table>
  </div>
);

export const TableHead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...rest
}) => (
  <thead className={cx("hidden md:table-header-group bg-gray-800", className)} {...rest} />
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...rest
}) => (
  <tbody
    className={cx(
      "block md:table-row-group divide-y divide-gray-800 md:divide-y-0",
      className,
    )}
    {...rest}
  />
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  className,
  ...rest
}) => (
  <tr
    className={cx(
      "block md:table-row md:border-b md:border-gray-800 mb-3 md:mb-0 rounded-lg md:rounded-none bg-gray-800/60 md:bg-transparent p-4 md:p-0",
      className,
    )}
    {...rest}
  />
);

export const TableHeader: React.FC<
  React.ThHTMLAttributes<HTMLTableCellElement>
> = ({ className, ...rest }) => (
  <th
    className={cx(
      "px-4 py-3 text-left text-fluid-xs font-semibold uppercase tracking-wider text-gray-400",
      className,
    )}
    {...rest}
  />
);

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Shown as an inline prefix in the mobile-stacked view. */
  label?: string;
}

export const TableCell: React.FC<TableCellProps> = ({
  className,
  label,
  children,
  ...rest
}) => (
  <td
    className={cx(
      "block md:table-cell px-0 md:px-4 py-1.5 md:py-3 md:border-0",
      className,
    )}
    {...rest}
  >
    {label && (
      <span className="md:hidden text-fluid-xs uppercase tracking-wider text-gray-500 font-semibold mr-2">
        {label}:
      </span>
    )}
    {children}
  </td>
);
