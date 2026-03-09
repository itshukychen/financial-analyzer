'use client';

import { useState, useEffect } from 'react';
import styles from './RegimeChangeAlert.module.css';

interface Props {
  regimeChange: {
    from: 'elevated' | 'normal' | 'depressed';
    to: 'elevated' | 'normal' | 'depressed';
    severity: number;
    timestamp: string;
  };
  onDismiss?: () => void;
}

export default function RegimeChangeAlert({ regimeChange, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed (localStorage)
    const key = `regime-alert-${regimeChange.timestamp}`;
    if (typeof window !== 'undefined' && localStorage.getItem(key) === 'dismissed') {
      setDismissed(true);
    }
  }, [regimeChange.timestamp]);

  const handleDismiss = () => {
    const key = `regime-alert-${regimeChange.timestamp}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, 'dismissed');
    }
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <div
      className={styles.alert}
      data-testid="regime-change-alert"
      data-severity={regimeChange.severity > 0.7 ? 'high' : 'medium'}
    >
      <div className={styles.icon}>⚠️</div>
      <div className={styles.content}>
        <strong>Volatility Regime Change Detected</strong>
        <p>
          {regimeChange.from.toUpperCase()} → {regimeChange.to.toUpperCase()}
        </p>
        <span className={styles.timestamp}>
          {new Date(regimeChange.timestamp).toLocaleString()}
        </span>
      </div>
      <button className={styles.dismissBtn} onClick={handleDismiss}>
        ✕
      </button>
    </div>
  );
}
