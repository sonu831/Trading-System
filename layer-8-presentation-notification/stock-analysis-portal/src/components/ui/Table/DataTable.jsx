import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import Table from './Table';
import { Input, Button } from '@/components/ui';

const DataTable = ({
  columns,
  data,
  pagination = null, // { currentPage, totalPages, onPageChange, pageSize }
  sorting = null, // { column, direction, onSort }
  filtering = null, // { filters, onFilterChange }
  className = '',
  loading = false,
}) => {
  // Local state for client-side usage if props not provided
  const [localSort, setLocalSort] = useState({ column: null, direction: 'asc' });
  const [localPage, setLocalPage] = useState(1);
  const [localFilters, setLocalFilters] = useState({});

  // Resolve effective state (Prop > Local)
  const currentSort = sorting || localSort;
  const currentPage = pagination?.currentPage || localPage;
  const currentFilters = filtering?.filters || localFilters;

  // Handlers
  const handleSort = (key) => {
    const direction =
      currentSort.column === key && currentSort.direction === 'asc' ? 'desc' : 'asc';
    if (sorting?.onSort) {
      sorting.onSort(key, direction);
    } else {
      setLocalSort({ column: key, direction });
    }
  };

  const handleFilter = (key, value) => {
    const newFilters = { ...currentFilters, [key]: value };
    if (filtering?.onFilterChange) {
      filtering.onFilterChange(newFilters);
    } else {
      setLocalFilters(newFilters);
    }
    // Reset page on filter
    if (!pagination && !filtering) setLocalPage(1);
  };

  // Process Data (Client-side Fallback)
  const processedData = useMemo(() => {
    // Only skip client-side processing if handlers are provided (Server-Side Mode)
    const isServerSide = !!(
      pagination?.onPageChange ||
      sorting?.onSort ||
      filtering?.onFilterChange
    );
    if (isServerSide) return data;

    let processed = [...data];

    // 1. Filter
    Object.keys(localFilters).forEach((key) => {
      const value = localFilters[key]?.toLowerCase();
      if (value) {
        processed = processed.filter((item) => String(item[key]).toLowerCase().includes(value));
      }
    });

    // 2. Sort
    if (currentSort.column) {
      processed.sort((a, b) => {
        const valA = a[currentSort.column];
        const valB = b[currentSort.column];
        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return processed;
  }, [data, pagination, sorting, filtering, localSort, localFilters]);

  // Pagination Logic (Client-side)
  const pageSize = pagination?.pageSize || 10;
  const totalItems = pagination ? pagination.totalItems : processedData.length;
  const totalPages = pagination ? pagination.totalPages : Math.ceil(totalItems / pageSize);

  const displayData = pagination
    ? data
    : processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filters (Optional: Render above table) */}

      <Table className="w-full">
        <Table.Header>
          <Table.Row className="bg-surface text-text-tertiary">
            {columns.map((col) => (
              <Table.HeaderCell
                key={col.key}
                className={`px-4 py-3 font-semibold ${col.sortable ? 'cursor-pointer hover:text-text-primary select-none' : ''} ${col.className || ''}`}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <div className="flex items-center gap-2">
                  {col.label}
                  {col.sortable && (
                    <span
                      className={`text-[10px] ${currentSort.column === col.key ? 'text-primary' : 'text-text-tertiary/30'}`}
                    >
                      {currentSort.column === col.key
                        ? currentSort.direction === 'asc'
                          ? '▲'
                          : '▼'
                        : '▲▼'}
                    </span>
                  )}
                </div>
                {/* Inline Filter Input */}
                {col.filterable && (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-text-primary focus:border-primary focus:outline-none"
                      placeholder={`Filter...`}
                      value={currentFilters[col.key] || ''}
                      onChange={(e) => handleFilter(col.key, e.target.value)}
                    />
                  </div>
                )}
              </Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body className="divide-y divide-border">
          {loading ? (
            <Table.Row>
              <Table.Cell
                colSpan={columns.length}
                className="px-6 py-8 text-center text-text-tertiary animate-pulse"
              >
                Loading data...
              </Table.Cell>
            </Table.Row>
          ) : displayData.length === 0 ? (
            <Table.Row>
              <Table.Cell
                colSpan={columns.length}
                className="px-6 py-8 text-center text-text-tertiary"
              >
                No results found.
              </Table.Cell>
            </Table.Row>
          ) : (
            displayData.map((row, idx) => (
              <Table.Row
                key={row.id || idx}
                className="hover:bg-surface-hover/50 transition-colors"
              >
                {columns.map((col) => (
                  <Table.Cell
                    key={`${idx}-${col.key}`}
                    className={`px-4 py-3 ${col.cellClassName || ''}`}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-text-tertiary">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
          </div>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === 1}
              onClick={() =>
                pagination?.onPageChange
                  ? pagination.onPageChange(currentPage - 1)
                  : setLocalPage((p) => p - 1)
              }
            >
              Previous
            </Button>
            <span className="flex items-center px-2 text-sm font-mono text-text-secondary">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() =>
                pagination?.onPageChange
                  ? pagination.onPageChange(currentPage + 1)
                  : setLocalPage((p) => p + 1)
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      sortable: PropTypes.bool,
      filterable: PropTypes.bool,
      render: PropTypes.func,
      className: PropTypes.string,
      cellClassName: PropTypes.string,
    })
  ).isRequired,
  data: PropTypes.array.isRequired,
  pagination: PropTypes.object,
  sorting: PropTypes.object,
  filtering: PropTypes.object,
  className: PropTypes.string,
  loading: PropTypes.bool,
};

export default DataTable;
