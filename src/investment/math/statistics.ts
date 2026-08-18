/**
 * Standard Statistical & Mathematical Utilities
 * Centralized, rigorous implementations avoiding code duplication across investment modules.
 */

export class MathStats {
  /**
   * Calculates the arithmetic mean of an array of numbers.
   * Returns null if the array is empty.
   */
  public static mean(values: number[]): number | null {
    if (!values || values.length === 0) return null;
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
    }
    return sum / values.length;
  }

  /**
   * Calculates sample variance using (n - 1) denominator.
   * Returns null if n < 2.
   */
  public static sampleVariance(values: number[]): number | null {
    if (!values || values.length < 2) return null;
    const m = MathStats.mean(values);
    if (m === null) return null;

    let sumSquaredDiff = 0;
    for (let i = 0; i < values.length; i++) {
      const diff = values[i] - m;
      sumSquaredDiff += diff * diff;
    }
    return sumSquaredDiff / (values.length - 1);
  }

  /**
   * Calculates sample standard deviation.
   * Returns null if n < 2 or variance is not calculable.
   */
  public static sampleStdDev(values: number[]): number | null {
    const variance = MathStats.sampleVariance(values);
    if (variance === null || variance < 0) return null;
    return Math.sqrt(variance);
  }

  /**
   * Calculates population variance using (n) denominator.
   */
  public static populationVariance(values: number[]): number | null {
    if (!values || values.length === 0) return null;
    const m = MathStats.mean(values);
    if (m === null) return null;

    let sumSquaredDiff = 0;
    for (let i = 0; i < values.length; i++) {
      const diff = values[i] - m;
      sumSquaredDiff += diff * diff;
    }
    return sumSquaredDiff / values.length;
  }

  /**
   * Calculates population standard deviation.
   */
  public static populationStdDev(values: number[]): number | null {
    const variance = MathStats.populationVariance(values);
    if (variance === null || variance < 0) return null;
    return Math.sqrt(variance);
  }

  /**
   * Calculates sample covariance between two equal-length arrays using (n - 1) denominator.
   * Returns null if arrays have different lengths or length < 2.
   */
  public static covariance(x: number[], y: number[]): number | null {
    if (!x || !y || x.length !== y.length || x.length < 2) return null;

    const meanX = MathStats.mean(x);
    const meanY = MathStats.mean(y);
    if (meanX === null || meanY === null) return null;

    let sumCrossDiff = 0;
    for (let i = 0; i < x.length; i++) {
      sumCrossDiff += (x[i] - meanX) * (y[i] - meanY);
    }
    return sumCrossDiff / (x.length - 1);
  }

  /**
   * Calculates Pearson correlation coefficient between two series.
   * Returns null if variance of either series is 0 or data is insufficient.
   */
  public static correlation(x: number[], y: number[]): number | null {
    if (!x || !y || x.length !== y.length || x.length < 2) return null;

    const cov = MathStats.covariance(x, y);
    const stdX = MathStats.sampleStdDev(x);
    const stdY = MathStats.sampleStdDev(y);

    if (cov === null || stdX === null || stdY === null) return null;
    if (stdX === 0 || stdY === 0) return null;

    const corr = cov / (stdX * stdY);
    // Clamp minor floating point inaccuracies
    return Math.max(-1, Math.min(1, corr));
  }

  /**
   * Calculates the median of an array of numbers.
   * Returns null if array is empty.
   */
  public static median(values: number[]): number | null {
    if (!values || values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Calculates the minimum value of an array of numbers.
   * Returns null if array is empty.
   */
  public static min(values: number[]): number | null {
    if (!values || values.length === 0) return null;
    let minimum = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] < minimum) minimum = values[i];
    }
    return minimum;
  }

  /**
   * Calculates the maximum value of an array of numbers.
   * Returns null if array is empty.
   */
  public static max(values: number[]): number | null {
    if (!values || values.length === 0) return null;
    let maximum = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] > maximum) maximum = values[i];
    }
    return maximum;
  }
}
