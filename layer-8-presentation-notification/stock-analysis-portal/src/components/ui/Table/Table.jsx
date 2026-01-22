import React from 'react';
import PropTypes from 'prop-types';

/**
 * Table Component
 * A reusable data table with header and body sections
 */
export default function Table({
  striped = false,
  hoverable = false,
  children,
  className = '',
  ...props
}) {
  const classes = ['table', striped && 'table-striped', hoverable && 'table-hoverable', className]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className="table-wrapper">
        <table className={classes} {...props}>
          {children}
        </table>
      </div>

      <style jsx>{`
        .table-wrapper {
          overflow-x: auto;
          border-radius: 8px;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }

        .table :global(th),
        .table :global(td) {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #2a2a3e;
        }

        .table :global(th) {
          background: #16213e;
          color: #888;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .table :global(td) {
          color: #ddd;
          font-size: 14px;
        }

        .table :global(tbody) :global(tr):last-child :global(td) {
          border-bottom: none;
        }

        .table-striped :global(tbody) :global(tr):nth-child(even) {
          background: rgba(255, 255, 255, 0.02);
        }

        .table-hoverable :global(tbody) :global(tr) {
          transition: background 0.2s;
        }

        .table-hoverable :global(tbody) :global(tr):hover {
          background: rgba(102, 126, 234, 0.1);
        }
      `}</style>
    </>
  );
}

/**
 * Table Header Component
 */
export function TableHeader({ children, className = '', ...props }) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
}

/**
 * Table Body Component
 */
export function TableBody({ children, className = '', ...props }) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

/**
 * Table Row Component
 */
export function TableRow({ children, className = '', ...props }) {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
}

/**
 * Table Cell Component
 */
export function TableCell({ children, className = '', ...props }) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  );
}

/**
 * Table Header Cell Component
 */
export function TableHeaderCell({ children, className = '', ...props }) {
  return (
    <th className={className} {...props}>
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
