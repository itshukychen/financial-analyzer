'use client';

import { useState } from 'react';
import styles from './OptionsOverlaySelector.module.css';

export interface OverlayConfig {
  strike: number;
  expiry: string;
  optionType: 'call' | 'put';
}

interface OptionsOverlaySelectorProps {
  ticker: string;
  onOverlayChange: (config: OverlayConfig | null) => void;
  defaultConfig?: OverlayConfig;
}

export default function OptionsOverlaySelector({
  ticker,
  onOverlayChange,
  defaultConfig = {
    strike: 3000,
    expiry: '2026-06-17',
    optionType: 'call',
  },
}: OptionsOverlaySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<OverlayConfig>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    setLoading(true);
    setError(null);
    try {
      // Validate that we can fetch data from the API
      const params = new URLSearchParams({
        ticker,
        strike: config.strike.toString(),
        expiry: config.expiry,
        optionType: config.optionType,
      });

      const response = await fetch(`/api/market/options-overlay?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Notify parent component
      onOverlayChange(config);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overlay data');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    onOverlayChange(null);
    setIsOpen(false);
    setError(null);
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.toggleButton}
        onClick={() => setIsOpen(!isOpen)}
        title="Add option price overlay to chart"
      >
        {isOpen ? '✕' : '+ Add Overlay'}
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Option Overlay ({ticker})</h3>

          <div className={styles.formGroup}>
            <label htmlFor="strike-input">Strike Price</label>
            <input
              id="strike-input"
              type="number"
              value={config.strike}
              onChange={(e) => setConfig({ ...config, strike: parseFloat(e.target.value) || 0 })}
              placeholder="3000"
              min="0"
              step="1"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="expiry-input">Expiry Date</label>
            <input
              id="expiry-input"
              type="date"
              value={config.expiry}
              onChange={(e) => setConfig({ ...config, expiry: e.target.value })}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="option-type-select">Option Type</label>
            <select
              id="option-type-select"
              value={config.optionType}
              onChange={(e) => setConfig({ ...config, optionType: e.target.value as 'call' | 'put' })}
              className={styles.select}
            >
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
          </div>

          {error && (
            <div className={styles.error}>
              <p>❌ {error}</p>
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.applyButton}
              onClick={handleApply}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Apply'}
            </button>
            <button
              className={styles.clearButton}
              onClick={handleClear}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
