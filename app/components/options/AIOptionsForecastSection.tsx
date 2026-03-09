'use client';

import type { AIOptionsForecast } from '@/lib/types/aiOptionsForecast';
import styles from './AIOptionsForecastSection.module.css';

interface Props {
  analysis: AIOptionsForecast;
  loading?: boolean;
  error?: string;
}

export default function AIOptionsForecastSection({ analysis, loading, error }: Props) {
  if (loading) {
    return (
      <div className={styles.container} data-testid="ai-forecast-section">
        <div className={styles.loading}>Generating AI analysis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container} data-testid="ai-forecast-section">
        <div className={styles.error}>⚠️ {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="ai-forecast-section">
      <h2 className={styles.title}>AI-Powered Forecast</h2>

      {/* Executive Summary */}
      <div className={styles.summary}>
        <p>{analysis.summary}</p>
        <span className={styles.outlookBadge} data-outlook={analysis.outlook}>
          {analysis.outlook.toUpperCase()}
        </span>
      </div>

      {/* Price Targets */}
      <div className={styles.priceTargets}>
        <h3>Price Targets (4 Weeks)</h3>
        <div className={styles.targetGrid}>
          <div className={styles.target}>
            <span className={styles.label}>Conservative (25th %ile)</span>
            <span className={styles.value} data-testid="price-target-conservative">
              ${analysis.priceTargets.conservative.toFixed(2)}
            </span>
          </div>
          <div className={styles.target}>
            <span className={styles.label}>Base Case (50th %ile)</span>
            <span className={styles.value} data-testid="price-target-base">
              ${analysis.priceTargets.base.toFixed(2)}
            </span>
          </div>
          <div className={styles.target}>
            <span className={styles.label}>Aggressive (75th %ile)</span>
            <span className={styles.value} data-testid="price-target-aggressive">
              ${analysis.priceTargets.aggressive.toFixed(2)}
            </span>
          </div>
        </div>
        <div className={styles.confidenceBar}>
          <div
            className={styles.confidenceFill}
            style={{ width: `${analysis.priceTargets.confidence * 100}%` }}
          />
          <span className={styles.confidenceLabel}>
            {(analysis.priceTargets.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
      </div>

      {/* Regime Analysis */}
      <div className={styles.regime}>
        <h3>Volatility Regime</h3>
        <div
          className={styles.regimeBadge}
          data-regime={analysis.regimeAnalysis.classification}
          data-testid="regime-badge"
        >
          {analysis.regimeAnalysis.classification.toUpperCase()}
        </div>
        <p className={styles.justification}>{analysis.regimeAnalysis.justification}</p>
        <p className={styles.recommendation}>
          <strong>Recommendation:</strong> {analysis.regimeAnalysis.recommendation}
        </p>
      </div>

      {/* Trading Levels */}
      <div className={styles.tradingLevels}>
        <h3>Key Trading Levels</h3>
        <div className={styles.levelGrid}>
          <div className={styles.level}>
            <span className={styles.label}>Support</span>
            <span className={styles.value}>${analysis.tradingLevels.keySupport.toFixed(2)}</span>
          </div>
          <div className={styles.level}>
            <span className={styles.label}>Resistance</span>
            <span className={styles.value}>${analysis.tradingLevels.keyResistance.toFixed(2)}</span>
          </div>
          <div className={styles.level}>
            <span className={styles.label}>Stop Loss</span>
            <span className={styles.value}>${analysis.tradingLevels.stopLoss.toFixed(2)}</span>
          </div>
        </div>
        <div className={styles.profitTargets}>
          <strong>Profit Targets:</strong>{' '}
          {analysis.tradingLevels.profitTargets.map((pt, i) => (
            <span key={i} className={styles.profitTarget}>
              ${pt.toFixed(2)}
            </span>
          ))}
        </div>
      </div>

      {/* Confidence */}
      <div className={styles.confidence} data-testid="confidence-badge">
        <strong>Overall Confidence:</strong>{' '}
        <span className={styles.confidenceScore}>
          {(analysis.confidence.overall * 100).toFixed(0)}%
        </span>
        <p className={styles.reasoning}>{analysis.confidence.reasoning}</p>
      </div>
    </div>
  );
}
