export interface AIAnalysisRequest {
  ticker: string;
  date?: string;
  expiry?: string;
  regenerate?: boolean;
}

export interface AIAnalysisResponse {
  success: boolean;
  sections: Section[];
  nextDayProjection: NextDayProjection;
  metadata: Metadata;
  error?: string;
}

export interface Section {
  id: string;
  title: string;
  icon: string;
  prose: string;
  highlights?: Highlight[];
  chart?: Chart;
}

export interface Highlight {
  label: string;
  value: string;
  color?: 'gain' | 'loss' | 'neutral';
}

export interface Chart {
  type: 'line' | 'bar' | 'histogram';
  data: Record<string, unknown>;
}

export interface NextDayProjection {
  targetLow: number;
  targetHigh: number;
  mode: number;
  confidence: 'high' | 'medium' | 'low';
  moveProb: number;
  description: string;
}

export interface Metadata {
  ticker: string;
  date: string;
  generatedAt: string;
  isCached: boolean;
  cacheAge: number;
  nextUpdate: string;
}

export interface Snapshot {
  ticker: string;
  date: string;
  netDelta: number;
  atmGamma: number;
  vega: number;
  theta: number;
  iv30d: number;
  ivRank: number;
  hv20d: number;
  move1w: number;
  regime: string;
  skewRatio: number;
  putIV: number;
  callIV: number;
}

export interface Projection {
  ticker: string;
  date: string;
  mode: number;
  rangeLow: number;
  rangeHigh: number;
}
