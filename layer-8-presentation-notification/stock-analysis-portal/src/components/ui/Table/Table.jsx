import React from 'react';
import PropTypes from 'prop-types';

/**
 * Table Component
 * A reusable data table with header and body sections.
 * Styled with Tailwind CSS for high density and readability.
 */
export default function Table({
  striped = false,
  hoverable = false,
  children,
  className = '',
  ...props
}) {
  const classes = [
    'w-full border-collapse text-left',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="overflow-x-auto rounded-lg">
      <table className={classes} {...props}>
        {children}
      </table>
    </div>
  );
}

/**
 * Table Header Component
 */
export function TableHeader({ children, className = '', ...props }) {
  return (
    <thead className={`bg-slate-900/50 border-b border-white/5 ${className}`} {...props}>
      {children}
    </thead>
  );
}

/**
 * Table Body Component
 */
export function TableBody({ children, className = '', ...props }) {
  return (
    <tbody className={`divide-y divide-white/5 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

/**
 * Table Row Component
 */
export function TableRow({ children, className = '', ...props }) {
  return (
    <tr className={`group transition-colors ${className}`} {...props}>
      {children}
    </tr>
  );
}

/**
 * Table Cell Component
 */
export function TableCell({ children, className = '', ...props }) {
  return (
    <td className={`p-4 text-sm text-slate-300 ${className}`} {...props}>
      {children}
    </td>
  );
}

/**
 * Table Header Cell Component
 */
export function TableHeaderCell({ children, className = '', ...props }) {
  return (
    <th className={`p-4 text-xs font-bold text-slate-400 uppercase tracking-wider ${className}`} {...props}>
      {children}
    </th>
  );
}

Table.propTypes = {
  striped: PropTypes.bool,
  hoverable: PropTypes.bool,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

Table.Header = TableHeader;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Cell = TableCell;
Table.HeaderCell = TableHeaderCell;
