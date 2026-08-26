import crypto from 'crypto';

export interface QuantEnvironmentVersions {
  python: string;
  vectorbt: string;
  numpy: string;
  pandas: string;
  numba?: string;
}

/**
 * Builds the canonical version payload in strictly deterministic order.
 * Format: py=<pythonVersion>|vbt=<vectorbtVersion>|np=<numpyVersion>|pd=<pandasVersion>|nb=<numbaVersion>
 */
export function buildQuantEnvironmentPayload(versions: QuantEnvironmentVersions): string {
  const nb = versions.numba || 'none';
  return `py=${versions.python}|vbt=${versions.vectorbt}|np=${versions.numpy}|pd=${versions.pandas}|nb=${nb}`;
}

/**
 * Computes the canonical quantEnvironmentFingerprint using UTF-8 SHA-256 and taking the first 16 hex characters.
 * Result: qenv_<16 hex chars>
 */
export function computeQuantEnvironmentFingerprint(versions: QuantEnvironmentVersions): string {
  const payload = buildQuantEnvironmentPayload(versions);
  const hash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  return `qenv_${hash.substring(0, 16)}`;
}
