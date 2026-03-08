import React from 'react';

export function StatusBadge({ status }: { status: string } ): React.ReactElement {
  const color = status === 'approved' || status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
  return <span className={`px-2 py-1 rounded text-xs ${color}`}>{status}</span>;
}
