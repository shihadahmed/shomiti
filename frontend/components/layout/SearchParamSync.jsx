'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function SearchParamReader({ onChange }) {
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || '';

  useEffect(() => {
    onChange(search);
  }, [search, onChange]);

  return null;
}

/**
 * Pushes the `?search=` query-string value into a page's search state so links
 * from the global navbar search open the matching list already filtered.
 */
export default function SearchParamSync({ onChange }) {
  return (
    <Suspense fallback={null}>
      <SearchParamReader onChange={onChange} />
    </Suspense>
  );
}
