import type { VolatilityRegime } from './db';

// ─── Standard Normal Distribution Helpers ────────────────────────────────────

/**
 * Approximation of standard normal CDF (Cumulative Distribution Function)
 * Based on Wichura's algorithm for good accuracy
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
 * Standard normal PDF (Probability Density Function)
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
 * Validate input parameters for option calculations
 * @throws Error if inputs are invalid
 */
function validateInputs(
  spotPrice: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number
): void {
  if (!Number.isFinite(spotPrice) || spotPrice <= 0) {
    throw new Error(`Invalid spotPrice: ${spotPrice}`);
  }
  if (!Number.isFinite(strike) || strike <= 0) {
    throw new Error(`Invalid strike: ${strike}`);
  }
  if (!Number.isFinite(timeToExpiry) || timeToExpiry < 0) {
    throw new Error(`Invalid timeToExpiry: ${timeToExpiry}`);
  }
  if (!Number.isFinite(volatility) || volatility < 0) {
    throw new Error(`Invalid volatility: ${volatility}`);
  }
  if (!Number.isFinite(riskFreeRate)) {
    throw new Error(`Invalid riskFreeRate: ${riskFreeRate}`);
  }
}

/**
 * Calculate d1 and d2 from Black-Scholes model
 * These are intermediate values used in multiple Greeks calculations
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

  validateInputs(spotPrice, strike, timeToExpiry, volatility, riskFreeRate);

  const d1 =
    (Math.log(spotPrice / strike) + (riskFreeRate + 0.5 * volatility ** 2) * timeToExpiry) /
    (volatility * Math.sqrt(timeToExpiry));

  const d2 = d1 - volatility * Math.sqrt(timeToExpiry);

  return { d1, d2 };
}

/**
 * Calculate Delta: sensitivity to underlying price movement
 * Call delta: 0 to 1
 * Put delta: -1 to 0
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
 * Calculate Gamma: second-order delta sensitivity
 * Same for calls and puts
 * Units: delta change per 1% move in underlying
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
 * Calculate Vega: sensitivity to volatility changes
 * Same for calls and puts
 * Units: option value change per 1% change in volatility
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
 * Calculate Theta: time decay
 * Call theta: typically negative (time decay costs)
 * Put theta: can be positive or negative depending on price and dividends
 * Units: option value loss per day
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
 * Calculate Rho: sensitivity to interest rate changes
 * Units: option value change per 1% change in interest rate
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
 * Calculate all Greeks at once
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

  // Validate all prices
  for (let i = 0; i < prices.length; i++) {
    if (!Number.isFinite(prices[i]) || prices[i] <= 0) {
      throw new Error(`Invalid price at index ${i}: ${prices[i]}`);
    }
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
 * Classify current IV into regime (low, normal, high)
 * Based on percentile rank in historical data
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
 * Calculate IV rank (percentile of current IV within historical range)
 * Returns 0-100
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
  if (!Number.isFinite(spotPrice) || spotPrice <= 0) {
    throw new Error(`Invalid spotPrice: ${spotPrice}`);
  }
  if (!Number.isFinite(timeToExpiry) || timeToExpiry <= 0) {
    throw new Error(`Invalid timeToExpiry: ${timeToExpiry}`);
  }

  if (optionChain.length === 0) {
    return [];
  }

  // Validate option chain data
  for (let i = 0; i < optionChain.length; i++) {
    const oc = optionChain[i];
    if (!Number.isFinite(oc.strike) || oc.strike <= 0) {
      throw new Error(`Invalid strike at index ${i}: ${oc.strike}`);
    }
    if (!Number.isFinite(oc.callPrice) || oc.callPrice < 0) {
      throw new Error(`Invalid callPrice at index ${i}: ${oc.callPrice}`);
    }
    if (!Number.isFinite(oc.putPrice) || oc.putPrice < 0) {
      throw new Error(`Invalid putPrice at index ${i}: ${oc.putPrice}`);
    }
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
  if (!Number.isFinite(spotPrice) || spotPrice <= 0) {
    throw new Error(`Invalid spotPrice: ${spotPrice}`);
  }
  if (!Number.isFinite(atmStraddlePrice) || atmStraddlePrice < 0) {
    throw new Error(`Invalid atmStraddlePrice: ${atmStraddlePrice}`);
  }
  if (!Number.isFinite(timeToExpiry) || timeToExpiry <= 0) {
    throw new Error(`Invalid timeToExpiry: ${timeToExpiry}`);
  }

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
  if (!Number.isFinite(spotPrice) || spotPrice <= 0) {
    throw new Error(`Invalid spotPrice: ${spotPrice}`);
  }
  if (!Number.isFinite(impliedMove) || impliedMove < 0) {
    throw new Error(`Invalid impliedMove: ${impliedMove}`);
  }
  if (!Number.isFinite(confidence) || confidence <= 0 || confidence > 1) {
    throw new Error(`Invalid confidence: ${confidence}`);
  }

  const movePercent = impliedMove / spotPrice;
  return {
    low: spotPrice * (1 - movePercent),
    high: spotPrice * (1 + movePercent),
  };
}
