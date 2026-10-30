import React from 'react';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

/**
 * Reusable responsive data table component.
 * @param {Object} props
 * @param {Array<{key: string, label: string, render?: Function, align?: 'left'|'center'|'right', width?: string}>} props.columns
 * @param {Array<Object>} props.data
 * @param {boolean} [props.loading]
 * @param {string} [props.emptyTitle]
 * @param {string} [props.emptyMessage]
 * @param {Function} [props.onRowClick]
 * @param {string} [props.className]
 */
export function Table({
  columns,
  data = [],
  loading = false,
  emptyTitle = 'No data available',
  emptyMessage = 'There are no records to display at this time.',
  onRowClick,
  className = '',
  ...props
}) {
  if (loading) {
    return (
      <div className="table-wrapper">
        <LoadingState message="Loading records..." />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="table-wrapper">
        <EmptyState title={emptyTitle} description={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={`table-wrapper ${className}`.trim()} {...props}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: col.align || 'left',
                  width: col.width || 'auto',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={row.id || rowIndex}
              onClick={() => onRowClick && onRowClick(row)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{ textAlign: col.align || 'left' }}
                >
                  {col.render ? col.render(row[col.key], row, rowIndex) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
