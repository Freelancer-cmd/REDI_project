/**
 * Basic statistical functions for normal distribution calculations.
 */

/**
 * Error function approximation (erf) using a numerical approximation.
 * See: Abramowitz and Stegun formula 7.1.26.
 */
export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

/**
 * Compute the cumulative distribution function (CDF) of the normal distribution
 * at point x with given mean and standard deviation.
 * Returns a value in [0, 1] representing the percentile rank (fraction).
 */
export function normalCdf(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) {
    return x < mean ? 0 : 1;
  }
  const z = (x - mean) / (stdDev * Math.SQRT2);
  return 0.5 * (1 + erf(z));
}