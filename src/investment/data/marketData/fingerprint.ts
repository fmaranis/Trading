import { PriceBar } from '../../backtesting/types';

/**
 * Generates a deterministic fingerprint for a dataset of PriceBar objects.
 * Uses 64-bit FNV-1a hash over serialized chronological bar data:
 * timestamp|open|high|low|close|volume
 */
export function calculateDatasetFingerprint(bars: PriceBar[]): string {
  if (!bars || bars.length === 0) return 'fp_empty_dataset';

  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (const b of bars) {
    const row = `${b.timestamp}|${b.open}|${b.high}|${b.low}|${b.close}|${b.volume ?? 0}\n`;
    for (let j = 0; j < row.length; j++) {
      hash ^= BigInt(row.charCodeAt(j));
      hash = (hash * prime) & 0xffffffffffffffffn;
    }
  }

  return `fp_${hash.toString(16).padStart(16, '0')}`;
}
