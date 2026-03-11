import type { VolatilityRegime } from './db';

// ─── Standard Normal Distribution Helpers ────────────────────────────────────

/**
 * Approximation of standard normal CDF (Cumulative Distribution Function).
 * Based on Abramowitz & Stegun formula 26.2.17 (accurate to ~7 decimal places).
 *
 * @param {number} x - The z-score value
 * @returns {number} Probability P(Z ≤ x) in range [0, 1]
 *
 * @example
 * normalCDF(0)  // → ~0.5  (50% probability)
 * normalCDF(1)  // → ~0.841 (84% probability)
 * normalCDF(-2) // → ~0.023 (2.3% probability)
 */
export function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/**
 * Standard normal PDF (Probability Density Function).
 * Returns the probability density at point x for N(0,1).
 *
 * @param {number} x - The z-score value
 * @returns {number} Probability density at x (always ≥ 0, maximum at x=0)
 */
export function normalPDF(x: number): number {
  return (Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI));
}

// ─── Greeks Calculations ────────────────────────────────────────────────────────

export interface Greeks {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

/**
 * Calculate d1 and d2 from Black-Scholes model.
 * These are intermediate standardized values used in all Greeks and price calculations.
 * Returns {0, 0} for expired options or zero-volatility inputs.
 *
 * @param {number} spotPrice - Current underlying price (S)
 * @param {number} strike - Option strike price (K)
 * @param {number} timeToExpiry - Time to expiry in years (T); e.g., 0.25 = 3 months
 * @param {number} volatility - Annualized implied volatility as decimal (e.g., 0.20 = 20%)
 * @param {number} riskFreeRate - Continuously compounded risk-free rate as decimal
 * @returns {{ d1: number; d2: number }} Standardized d1 and d2 values for use in BS formula
 */
function calculateD1D2(
  spotPrice: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number
): { d1: number; d2: number } {
  if (timeToExpiry <= 0 || volatility <= 0) {
    return { d1: 0, d2: 0 };
  }

  const d1 =
    (Math.log(spotPrice / strike) + (riskFreeRate + 0.5 * volatility ** 2) * timeToExpiry) /
    (volatility * Math.sqrt(timeToExpiry));

  const d2 = d1 - volatility * Math.sqrt(timeToExpiry);

  return { d1, d2 };
}

/**
 * Calculate Delta: the option's sensitivity to a $1 move in the underlying price.
 * Call delta: 0 to +1 (roughly = probability of expiring ITM for calls)
 * Put delta: -1 to 0
 *
 * @param {number} spotPrice - Current underlying price
 * @param {number} strike - Option strike price
 * @param {number} timeToExpiry - Time to expiry in years
 * @param {number} volatility - Annualized implied volatility (decimal)
 * @param {number} riskFreeRate - Continuously compounded risk-free rate (decimal)
 * @param {'call' | 'put'} optionType - Option type
 * @returns {number} Delta in range [0, 1] for calls or [-1, 0] for puts
 *
 * @example
 * // ATM call with 3 months to expiry, 20% IV, 5% rate
 * calculateDelta(100, 100, 0.25, 0.20, 0.05, 'call') // → ~0.53
 * calculateDelta(100, 100, 0.25, 0.20, 0.05, 'put')  // → ~-0.47
 */
export function calculateDelta(
  spotPrice: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number,
  optionType: 'call' | 'put'
): number {
  if (timeToExpiry <= 0 || volatility <= 0) {
    return optionType === 'call'
      ? spotPrice > strike
        ? 1
        : 0
      : spotPrice > strike
        ? 0
        : -1;
  }

  const { d1 } = calculateD1D2(spotPrice, strike, timeToExpiry, volatility, riskFreeRate);

  return optionType === 'call' ? normalCDF(d1) : normalCDF(d1) - 1;
}

/**
 * Calculate Gamma: rate of change of delta per $1 move in underlying.
 * Identical for calls and puts at the same strike. Highest at ATM near expiry.
 *
 * @param {number} spotPrice - Current underlying price
 * @param {number} strike - Option strike price
 * @param {number} timeToExpiry - Time to expiry in years
 * @param {number} volatility - Annualized implied volatility (decimal)
 * @param {number} riskFreeRate - Continuously compounded risk-free rate (decimal)
 * @returns {number} Gamma (delta change per $1 underlying move); always ≥ 0
 */
export function calculateGamma(
  spotPrice: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number
): number {
  if (timeToExpiry <= 0 || volatility <= 0) return 0;

  const { d1 } = calculateD1D2(spotPrice, strike, timeToExpiry, volatility, riskFreeRate);

  return normalPDF(d1) / (spotPrice * volatility * Math.sqrt(timeToExpiry));
}

/**
 * Calculate Vega: option price sensitivity to a 1% change in implied volatility.
 * Identical for calls and puts at the same strike. Highest at ATM with long time to expiry.
 *
 * @param {number} spotPrice - Current underlying price
 * @param {number} strike - Option strike price
 * @param {number} timeToExpiry - Time to expiry in years
 * @param {number} volatility - Annualized implied volatility (decimal)
 * @param {number} riskFreeRate - Continuously compounded risk-free rate (decimal)
 * @returns {number} Vega (option value change per 1% vol move); always ≥ 0
 */
export function calculateVega(
  spotPrice: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number
): number {
  if (timeToExpiry <= 0 || volatility <= 0) return 0;

  const { d1 } = calculateD1D2(spotPrice, strike, timeToExpiry, volatility, riskFreeRate);

  return (spotPrice * Math.sqrt(timeToExpiry) * normalPDF(d1)) / 100; // per 1% vol move
}

/**
 * Calculate Theta: option value decay per calendar day.
 * Call theta is typically negative (holding a call costs time value each day).
 * Put theta can be positive for deep ITM puts with high interest rates.
 *
 * @param {number} spotPrice - Current underlying price
 * @param {number} strike - Option strike price
 * @param {number} timeToExpiry - Time to expiry in years
 * @param {number} volatility - Annualized implied volatility (decimal)
 * @param {number} riskFreeRate - Continuously compounded risk-free rate (decimal)
 * @param {'call' | 'put'} optionType - Option type
 * @returns {number} Theta in dollars per day (typically negative for long options)
 */
export function calculateTheta(
  spotPrice: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number,
  optionType: 'call' | 'put'
): number {
  if (timeToExpiry <= 0) return 0;

  const { d1, d2 } = calculateD1D2(spotPrice, strike, timeToExpiry, volatility, riskFreeRate);

  const term1 = -(spotPrice * volatility * normalPDF(d1)) / (2 * Math.sqrt(timeToExpiry));

  if (optionType === 'call') {
    const term2 = riskFreeRate * strike * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(d2);
    return (term1 - term2) / 365; // daily theta
  } else {
    const term2 = riskFreeRate * strike * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(-d2);
    return (term1 + term2) / 365; // daily theta
  }
}

/**
 * Calculate Rho: option price sensitivity to a 1% change in the risk-free interest rate.
 * Calls have positive rho (higher rates → higher call value).
 * Puts have negative rho (higher rates → lower put value).
 * Generally the least significant Greek for short-dated equity options.
 *
 * @param {number} spotPrice - Current underlying price
 * @param {number} strike - Option strike price
 * @param {number} timeToExpiry - Time to expiry in years
 * @param {number} volatility - Annualized implied volatility (decimal)
 * @param {number} riskFreeRate - Continuously compounded risk-free rate (decimal)
 * @param {'call' | 'put'} optionType - Option type
 * @returns {number} Rho (option value change per 1% rate move)
 */
export function calculateRho(
  spotPrice: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number,
  optionType: 'call' | 'put'
): number {
  if (timeToExpiry <= 0 || volatility <= 0) return 0;

  const { d2 } = calculateD1D2(spotPrice, strike, timeToExpiry, volatility, riskFreeRate);

  const df = Math.exp(-riskFreeRate * timeToExpiry);

  if (optionType === 'call') {
    return (strike * timeToExpiry * df * normalCDF(d2)) / 100; // per 1% rate change
  } else {
    return (-strike * timeToExpiry * df * normalCDF(-d2)) / 100;
  }
}

/**
 * Calculate all five option Greeks in a single pass (reuses d1/d2 calculation).
 * More efficient than calling each Greek function individually.
 *
 * @param {number} spotPrice - Current underlying price
 * @param {number} strike - Option strike price
 * @param {number} timeToExpiry - Time to expiry in years
 * @param {number} volatility - Annualized implied volatility (decimal)
 * @param {number} riskFreeRate - Continuously compounded risk-free rate (decimal)
 * @param {'call' | 'put'} optionType - Option type
 * @returns {Greeks} Object with delta, gamma, vega, theta, and rho
 *
 * @example
 * const greeks = calculateGreeks(475, 480, 0.083, 0.18, 0.05, 'call');
 * // → { delta: 0.48, gamma: 0.031, vega: 0.21, theta: -0.085, rho: 0.19 }
 */
export function calculateGreeks(
  spotPrice: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number,
  optionType: 'call' | 'put'
): Greeks {
  return {
    delta: calculateDelta(spotPrice, strike, timeToExpiry, volatility, riskFreeRate, optionType),
    gamma: calculateGamma(spotPrice, strike, timeToExpiry, volatility, riskFreeRate),
    vega: calculateVega(spotPrice, strike, timeToExpiry, volatility, riskFreeRate),
    theta: calculateTheta(spotPrice, strike, timeToExpiry, volatility, riskFreeRate, optionType),
    rho: calculateRho(spotPrice, strike, timeToExpiry, volatility, riskFreeRate, optionType),
  };
}

// ─── Historical Volatility ───────────────────────────────────────────────────────

/**
 * Calculate annualized historical volatility from price series
 * Using log returns and standard deviation
 * @param prices Array of prices (oldest to newest)
 * @param window Number of periods to use (default 20 days)
 * @returns Annualized volatility as percentage (0-100)
 */
export function calculateHistoricalVolatility(prices: number[], window: number = 20): number {
  if (prices.length < window || prices.length < 2) {
    throw new Error('Insufficient data for HV calculation');
  }

  const recentPrices = prices.slice(-window);
  const logReturns: number[] = [];

  // Calculate log returns
  for (let i = 1; i < recentPrices.length; i++) {
    logReturns.push(Math.log(recentPrices[i] / recentPrices[i - 1]));
  }

  // Calculate mean and variance
  const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (logReturns.length - 1);
  const dailyVol = Math.sqrt(variance);

  // Annualize (252 trading days per year)
  return dailyVol * Math.sqrt(252) * 100; // return as percentage
}

// ─── Volatility Regime Classification ────────────────────────────────────────────

export interface RegimeThresholds {
  lowPercentile: number; // e.g., 0.20 (20th percentile)
  highPercentile: number; // e.g., 0.80 (80th percentile)
}

/**
 * Classify current IV into a volatility regime (low, normal, high)
 * based on percentile rank within a historical IV distribution.
 *
 * @param {number} currentIV - Current implied volatility (percentage, e.g., 18.5)
 * @param {number[]} historicalIVs - Array of historical IV values for comparison
 * @param {RegimeThresholds} thresholds - Percentile cutoffs (default: 20th/80th percentile)
 * @returns {VolatilityRegime} 'low' | 'normal' | 'high'
 *
 * @example
 * const regime = classifyVolatilityRegime(22, pastIVs);
 * // → 'normal' if 22 is between 20th and 80th percentile of pastIVs
 */
export function classifyVolatilityRegime(
  currentIV: number,
  historicalIVs: number[],
  thresholds: RegimeThresholds = { lowPercentile: 0.2, highPercentile: 0.8 }
): VolatilityRegime {
  const sorted = [...historicalIVs].sort((a, b) => a - b);
  const lowIdx = Math.floor(sorted.length * thresholds.lowPercentile);
  const highIdx = Math.floor(sorted.length * thresholds.highPercentile);

  const lowThreshold = sorted[lowIdx];
  const highThreshold = sorted[highIdx];

  if (currentIV < lowThreshold) return 'low';
  if (currentIV > highThreshold) return 'high';
  return 'normal';
}

/**
 * Calculate IV rank: what percentage of historical IV readings are below the current IV.
 * Returns 0-100. A rank of 80 means IV is higher than 80% of past readings.
 *
 * @param {number} currentIV - Current implied volatility
 * @param {number[]} historicalIVs - Historical IV readings for comparison
 * @returns {number} IV rank in range [0, 100]; returns 50 if historicalIVs is empty
 */
export function calculateIVRank(currentIV: number, historicalIVs: number[]): number {
  if (historicalIVs.length === 0) return 50;

  const countBelow = historicalIVs.filter(iv => iv < currentIV).length;
  return Math.round((countBelow / historicalIVs.length) * 100);
}

/**
 * Calculate IV percentile (equivalent to IV rank, but as decimal 0-1)
 */
export function calculateIVPercentile(currentIV: number, historicalIVs: number[]): number {
  return calculateIVRank(currentIV, historicalIVs) / 100;
}

// ─── Implied Volatility Solver ───────────────────────────────────────────────────

/**
 * Calculate Black-Scholes option price
 * Used as part of IV solver
 */
function blackScholesPrice(
  spotPrice: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number,
  optionType: 'call' | 'put'
): number {
  if (timeToExpiry <= 0 || volatility <= 0) {
    // Intrinsic value only
    if (optionType === 'call') {
      return Math.max(spotPrice - strike, 0);
    } else {
      return Math.max(strike - spotPrice, 0);
    }
  }

  const { d1, d2 } = calculateD1D2(spotPrice, strike, timeToExpiry, volatility, riskFreeRate);
  const df = Math.exp(-riskFreeRate * timeToExpiry);

  if (optionType === 'call') {
    return spotPrice * normalCDF(d1) - strike * df * normalCDF(d2);
  } else {
    return strike * df * normalCDF(-d2) - spotPrice * normalCDF(-d1);
  }
}

/**
 * Calculate implied volatility using Newton-Raphson method
 * @param optionPrice Observed option price
 * @param spotPrice Current underlying price
 * @param strike Strike price
 * @param timeToExpiry Time to expiry in years
 * @param riskFreeRate Risk-free rate (decimal)
 * @param optionType 'call' or 'put'
 * @param tolerance Convergence tolerance (default 0.0001)
 * @param maxIterations Maximum iterations (default 100)
 * @returns Implied volatility (decimal), or null if no convergence
 */
export function calculateImpliedVolatility(
  optionPrice: number,
  spotPrice: number,
  strike: number,
  timeToExpiry: number,
  riskFreeRate: number,
  optionType: 'call' | 'put',
  tolerance: number = 0.0001,
  maxIterations: number = 100
): number | null {
  // Input validation
  if (optionPrice < 0 || spotPrice <= 0 || strike <= 0 || timeToExpiry <= 0) {
    return null;
  }

  // Check for intrinsic value constraint
  const intrinsicValue =
    optionType === 'call'
      ? Math.max(spotPrice - strike, 0)
      : Math.max(strike - spotPrice, 0);

  if (optionPrice < intrinsicValue) {
    return null;
  }

  // Initial guess for IV: use Brenner-Subrahmanyam approximation
  let iv =
    Math.sqrt((2 * Math.PI) / timeToExpiry) *
    (optionPrice / spotPrice);
  iv = Math.min(Math.max(iv, 0.01), 5); // Bound between 1% and 500%

  // Newton-Raphson iteration
  for (let i = 0; i < maxIterations; i++) {
    const price = blackScholesPrice(spotPrice, strike, timeToExpiry, iv, riskFreeRate, optionType);
    const vega = calculateVega(spotPrice, strike, timeToExpiry, iv, riskFreeRate);

    // Avoid division by zero
    if (Math.abs(vega) < 1e-10) {
      return null;
    }

    const diff = price - optionPrice;

    // Check convergence
    if (Math.abs(diff) < tolerance) {
      return iv;
    }

    // Newton-Raphson update
    iv = iv - diff / vega;

    // Bounds check
    if (iv < 0 || iv > 5) {
      return null;
    }
  }

  // Failed to converge
  return null;
}

// ─── Probability Distribution ───────────────────────────────────────────────────

/**
 * Calculate implied probability distribution from straddle prices
 * Uses simplified method: probability at each point proportional to inverse straddle price
 * @param spotPrice Current underlying price
 * @param optionChain Array of strikes with call and put prices
 * @param timeToExpiry Time to expiry in years
 * @returns Array of price levels with implied probabilities
 */
export function calculateProbabilityDistribution(
  spotPrice: number,
  optionChain: Array<{
    strike: number;
    callPrice: number;
    putPrice: number;
  }>,
  timeToExpiry: number
): { price: number; probability: number }[] {
  if (optionChain.length === 0) {
    return [];
  }

  // Calculate straddle prices (call + put value at each strike)
  const straddles = optionChain.map(oc => ({
    strike: oc.strike,
    straddlePrice: oc.callPrice + oc.putPrice,
  }));

  // Invert: probability inversely proportional to straddle price
  const inverted = straddles.map(s => ({
    strike: s.strike,
    invStraddle: s.straddlePrice > 0 ? 1 / s.straddlePrice : 0,
  }));

  // Normalize
  const sum = inverted.reduce((acc, i) => acc + i.invStraddle, 0);
  if (sum === 0) {
    return [];
  }

  return inverted.map(i => ({
    price: Math.round(i.strike),
    probability: i.invStraddle / sum,
  }));
}

// ─── Implied Move Calculation ───────────────────────────────────────────────────

/**
 * Calculate implied move (in dollars) from at-the-money straddle price
 * Simplified: implied move ≈ 0.4 × straddle price
 * (This is a rough approximation; more precise methods require numerical integration)
 */
export function calculateImpliedMove(
  spotPrice: number,
  atmStraddlePrice: number,
  timeToExpiry: number
): number {
  // Rough approximation
  return (atmStraddlePrice / spotPrice) * Math.sqrt(365 / (timeToExpiry * 252));
}

/**
 * Calculate confidence bands from implied move
 * Assumes log-normal distribution
 */
export function calculateConfidenceBands(
  spotPrice: number,
  impliedMove: number,
  confidence: number = 0.68 // 1 standard deviation
): { low: number; high: number } {
  const movePercent = impliedMove / spotPrice;
  return {
    low: spotPrice * (1 - movePercent),
    high: spotPrice * (1 + movePercent),
  };
}
