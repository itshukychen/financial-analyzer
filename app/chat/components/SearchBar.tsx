'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SearchResult {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  snippet: string;
  role: string;
  createdAt: string;
  score?: number;
}

interface SearchBarProps {
  onSelectResult: (conversationId: string, messageId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function HighlightedSnippet({ snippet, query }: { snippet: string; query: string }) {
  if (!query.trim()) return <span>{snippet}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = snippet.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            style={{
              background: 'rgba(79,142,247,0.3)',
              color: 'var(--text-primary)',
              borderRadius: '2px',
              padding: '0 1px',
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export default function SearchBar({ onSelectResult }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searched, setSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setSearched(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch('/api/chat/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, limit: 20 }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResults(json.results ?? []);
      setOpen(true);
      setActiveIndex(-1);
      setSearched(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setResults([]);
      setOpen(true);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      setSearched(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        selectResult(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function selectResult(result: SearchResult) {
    setOpen(false);
    setQuery('');
    setResults([]);
    setSearched(false);
    onSelectResult(result.conversationId, result.messageId);
  }

  const showNoResults = open && searched && !loading && results.length === 0;
  const showResults = open && results.length > 0;

  return (
    <div
      data-testid="search-bar"
      style={{ position: 'relative', width: '100%' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '8px 12px',
        }}
      >
        {/* Search icon */}
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          style={{ flexShrink: 0, color: 'var(--text-muted)' }}
        >
          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="2" />
          <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          data-testid="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0 || searched) setOpen(true);
          }}
          placeholder="Search conversations..."
          aria-label="Search conversations"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="search-results-dropdown"
          aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
          role="combobox"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '13px',
          }}
        />

        {/* Loading spinner */}
        {loading && (
          <div
            data-testid="search-spinner"
            aria-label="Searching..."
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid var(--border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {/* Dropdown */}
      {(showResults || showNoResults) && (
        <div
          ref={dropdownRef}
          id="search-results-dropdown"
          data-testid="search-dropdown"
          role="listbox"
          aria-label="Search results"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
            zIndex: 50,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            maxHeight: '360px',
            overflowY: 'auto',
          }}
        >
          {showNoResults && (
            <div
              data-testid="search-no-results"
              style={{
                padding: '16px',
                textAlign: 'center',
                fontSize: '13px',
                color: 'var(--text-muted)',
              }}
            >
              No results found
            </div>
          )}

          {showResults &&
            results.map((result, index) => (
              <div
                key={`${result.conversationId}-${result.messageId}`}
                id={`search-result-${index}`}
                data-testid={`search-result-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onClick={() => selectResult(result)}
                onMouseEnter={() => setActiveIndex(index)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: index < results.length - 1 ? '1px solid var(--border)' : 'none',
                  background: index === activeIndex ? 'rgba(79,142,247,0.1)' : 'transparent',
                  transition: 'background 0.1s ease',
                }}
              >
                {/* Conversation title and date */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '4px',
                    gap: '8px',
                  }}
                >
                  <span
                    data-testid={`search-result-title-${index}`}
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {result.conversationTitle}
                  </span>
                  <span
                    data-testid={`search-result-date-${index}`}
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {formatDate(result.createdAt)}
                  </span>
                </div>

                {/* Snippet with highlight */}
                <div
                  data-testid={`search-result-snippet-${index}`}
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: '1.4',
                  }}
                >
                  <HighlightedSnippet snippet={result.snippet} query={query} />
                </div>
              </div>
            ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
