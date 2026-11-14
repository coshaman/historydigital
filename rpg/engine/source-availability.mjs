const isoDate = value => String(value ?? '').match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

const addDays = (iso, days) => {
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function sourceAvailableOn(sourceIndex, sourceRecord, sourceObject, worldDate) {
  const explicitAccessDate = isoDate(sourceIndex?.accessibleToPlayerAt ?? sourceRecord?.accessibleToPlayerAt);
  const objectAccessDate = isoDate(sourceObject?.properties?.find(property => property.name === 'availableDate')?.value);
  const documentDateText = String(sourceIndex?.documentDate ?? sourceRecord?.documentDate ?? sourceRecord?.date ?? '');
  const rawDocumentDate = isoDate(documentDateText);
  const documentDate = rawDocumentDate && /julian/i.test(documentDateText)
    ? addDays(rawDocumentDate, 12)
    : rawDocumentDate;
  const yearOnlyDate = !documentDate && /(?:^|\D)(18\d{2}|19\d{2})(?!\d)/.exec(documentDateText)?.[1];
  const conservativeYearBoundary = yearOnlyDate ? `${Number(yearOnlyDate) + 1}-01-01` : null;
  const availableDate = explicitAccessDate ?? objectAccessDate ?? documentDate ?? conservativeYearBoundary;
  return !availableDate || availableDate <= worldDate;
}
