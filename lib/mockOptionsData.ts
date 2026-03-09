import type { OptionSnapshot, OptionProjection, ProbabilityPoint, KeyLevel, VolatilityRegime } from './db';

/**
 * Generate mock option snapshot for testing
 */
export function generateMockOptionSnapshot(
  ticker: string,
  date: string,
  spotPrice: number = 475
): Omit<OptionSnapshot, 'id' | 'created_at'> {
  const baseIV = 18 + Math.random() * 6; // 18-24%
  const hvSpread = -2 + Math.random() * 4; // HV typically lower
  const putOtmIv = baseIV + Math.random() * 3;
  const callOtmIv = baseIV + Math.random() * 2;
  const skewRatio = putOtmIv / (callOtmIv || 1);

  const regime: VolatilityRegime =
    baseIV < 16 ? 'low' : baseIV > 22 ? 'high' : 'normal';

  return {
    date,
    ticker,
    expiry: '30d',
    iv_30d: baseIV,
    iv_60d: baseIV + Math.random() * 2,
    hv_20d: baseIV + hvSpread,
    hv_60d: baseIV + hvSpread - 1,
    iv_rank: Math.floor(Math.random() * 100),
    net_delta: -50 + Math.random() * 100,
    atm_gamma: 0.001 + Math.random() * 0.002,
    vega_per_1pct: 400 + Math.random() * 200,
    theta_daily: -80 - Math.random() * 40,
    call_otm_iv: callOtmIv,
    put_otm_iv: putOtmIv,
    skew_ratio: skewRatio,
    implied_move_pct: 2 + Math.random() * 3,
    regime,
    raw_json: JSON.stringify({ 
      spotPrice,
      mockData: true, 
      timestamp: new Date().toISOString() 
    }),
  };
}

/**
 * Generate mock probability distribution around a spot price
 * Uses simplified normal distribution
 */
export function generateMockProbabilityDistribution(
  spotPrice: number,
  volatility: number,
  horizonDays: number
): ProbabilityPoint[] {
  const numPoints = 15;
  // Implied move expands with volatility and time
  const range = spotPrice * (volatility / 100) * Math.sqrt(horizonDays / 365);
  const distribution: ProbabilityPoint[] = [];

  for (let i = 0; i < numPoints; i++) {
    const price = spotPrice - range + (2 * range * i) / (numPoints - 1);
    const z = (price - spotPrice) / range;
    // Simple normal PDF
    const probability = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    distribution.push({ price: Math.round(price), probability });
  }

  // Normalize
  const sum = distribution.reduce((acc, p) => acc + p.probability, 0);
  return distribution.map(p => ({ ...p, probability: p.probability / sum }));
}

/**
 * Generate mock projection with key levels
 */
export function generateMockProjection(
  date: string,
  ticker: string,
  spotPrice: number,
  iv: number,
  horizonDays: number = 30,
  regime: VolatilityRegime = 'normal'
): Omit<OptionProjection, 'id' | 'created_at'> {
  const probDist = generateMockProbabilityDistribution(spotPrice, iv, horizonDays);

  // Calculate 2 SD range from probability distribution
  const sortedByPrice = [...probDist].sort((a, b) => a.price - b.price);
  let cumProb = 0;
  let lowerBound = sortedByPrice[0].price;
  let mode = spotPrice;
  let upperBound = sortedByPrice[sortedByPrice.length - 1].price;

  for (const point of sortedByPrice) {
    cumProb += point.probability;
    if (cumProb < 0.025 && lowerBound === sortedByPrice[0].price) {
      lowerBound = point.price;
    }
    if (point.probability > (mode === spotPrice ? 0.15 : 0)) {
      mode = point.price;
    }
    if (cumProb < 0.975) {
      upperBound = point.price;
    }
  }

  const keyLevels: KeyLevel[] = [
    { level: Math.round(spotPrice), type: 'mode', probability: 0.35 },
    { level: Math.round(lowerBound), type: '2sd_low', probability: null },
    { level: Math.round(upperBound), type: '2sd_high', probability: null },
  ];

  return {
    date,
    ticker,
    horizon_days: horizonDays,
    prob_distribution: probDist,
    key_levels: keyLevels,
    regime_classification: regime,
  };
}
