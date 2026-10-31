export function verdictSourceKey(source?: string | null): string | null {
  if (!source) return null;
  return `confirmOutcome.source.${source}`;
}
