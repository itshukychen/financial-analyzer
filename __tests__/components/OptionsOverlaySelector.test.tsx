import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OptionsOverlaySelector from '@/app/components/charts/OptionsOverlaySelector';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OptionsOverlaySelector', () => {
  const mockOnOverlayChange = vi.fn();

  beforeEach(() => {
    mockOnOverlayChange.mockClear();
    (global.fetch as any).mockClear();
  });

  // ─── Toggle Button Tests ───────────────────────────────────────────────────────

  it('renders toggle button initially', () => {
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );
    expect(screen.getByRole('button', { name: /add overlay/i })).toBeInTheDocument();
  });

  it('opens panel when toggle button is clicked', async () => {
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );
    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText(/option overlay/i)).toBeInTheDocument();
    });
  });

  it('closes panel when toggle button is clicked again', async () => {
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );
    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });

    // Open
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(screen.getByText(/option overlay/i)).toBeInTheDocument();
    });

    // Close
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(screen.queryByText(/option overlay/i)).not.toBeInTheDocument();
    });
  });

  // ─── Form Input Tests ──────────────────────────────────────────────────────────

  it('renders form inputs in open state', async () => {
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );
    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/strike price/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/expiry date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/option type/i)).toBeInTheDocument();
    });
  });

  it('updates strike price input', async () => {
    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );
    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const strikeInput = await screen.findByLabelText(/strike price/i);
    await user.clear(strikeInput);
    await user.type(strikeInput, '3500');

    expect((strikeInput as HTMLInputElement).value).toBe('3500');
  });

  it('updates expiry date input', async () => {
    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );
    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const expiryInput = await screen.findByLabelText(/expiry date/i);
    await user.clear(expiryInput);
    await user.type(expiryInput, '2026-12-31');

    expect((expiryInput as HTMLInputElement).value).toBe('2026-12-31');
  });

  it('updates option type select', async () => {
    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );
    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const typeSelect = await screen.findByLabelText(/option type/i) as HTMLSelectElement;
    expect(typeSelect.value).toBe('call');

    await user.selectOptions(typeSelect, 'put');
    expect(typeSelect.value).toBe('put');
  });

  // ─── Apply Button Tests ────────────────────────────────────────────────────────

  it('applies overlay on valid API response', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ points: [] }),
    });

    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const applyBtn = await screen.findByRole('button', { name: /apply/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(mockOnOverlayChange).toHaveBeenCalledWith({
        strike: 3000,
        expiry: '2026-06-17',
        optionType: 'call',
      });
    });
  });

  it('closes panel after successful apply', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ points: [] }),
    });

    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const applyBtn = await screen.findByRole('button', { name: /apply/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(screen.queryByText(/option overlay/i)).not.toBeInTheDocument();
    });
  });

  it('disables apply button while loading', async () => {
    (global.fetch as any).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    );

    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const applyBtn = await screen.findByRole('button', { name: /apply/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(applyBtn).toBeDisabled();
      expect(applyBtn).toHaveTextContent('Loading...');
    });
  });

  it('shows error when API returns error status', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Invalid parameters' }),
    });

    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const applyBtn = await screen.findByRole('button', { name: /apply/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Invalid parameters/)).toBeInTheDocument();
    });
  });

  it('shows error when API returns non-JSON error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const applyBtn = await screen.findByRole('button', { name: /apply/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
    });
  });

  it('shows error when fetch throws', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const applyBtn = await screen.findByRole('button', { name: /apply/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('clears error when applying again after error', async () => {
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ points: [] }),
      });

    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const applyBtn = await screen.findByRole('button', { name: /apply/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    // Click again to retry
    await user.click(applyBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Network error/)).not.toBeInTheDocument();
    });
  });

  // ─── Clear Button Tests ────────────────────────────────────────────────────────

  it('calls onOverlayChange(null) when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const clearBtn = await screen.findByRole('button', { name: /clear/i });
    await user.click(clearBtn);

    expect(mockOnOverlayChange).toHaveBeenCalledWith(null);
  });

  it('closes panel after clear', async () => {
    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const clearBtn = await screen.findByRole('button', { name: /clear/i });
    await user.click(clearBtn);

    await waitFor(() => {
      expect(screen.queryByText(/option overlay/i)).not.toBeInTheDocument();
    });
  });

  it('disables clear button while loading', async () => {
    (global.fetch as any).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    );

    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const applyBtn = await screen.findByRole('button', { name: /apply/i });
    await user.click(applyBtn);

    const clearBtn = await screen.findByRole('button', { name: /clear/i });

    await waitFor(() => {
      expect(clearBtn).toBeDisabled();
    });
  });

  // ─── Default Config Tests ──────────────────────────────────────────────────────

  it('uses default config when not provided', () => {
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );
    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const strikeInput = screen.getByLabelText(/strike price/i) as HTMLInputElement;
    const expiryInput = screen.getByLabelText(/expiry date/i) as HTMLInputElement;
    const typeSelect = screen.getByLabelText(/option type/i) as HTMLSelectElement;

    expect(strikeInput.value).toBe('3000');
    expect(expiryInput.value).toBe('2026-06-17');
    expect(typeSelect.value).toBe('call');
  });

  it('uses provided default config', () => {
    const customConfig = {
      strike: 4000,
      expiry: '2027-01-15',
      optionType: 'put' as const,
    };

    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
        defaultConfig={customConfig}
      />
    );
    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const strikeInput = screen.getByLabelText(/strike price/i) as HTMLInputElement;
    const expiryInput = screen.getByLabelText(/expiry date/i) as HTMLInputElement;
    const typeSelect = screen.getByLabelText(/option type/i) as HTMLSelectElement;

    expect(strikeInput.value).toBe('4000');
    expect(expiryInput.value).toBe('2027-01-15');
    expect(typeSelect.value).toBe('put');
  });

  // ─── Edge Case Tests ───────────────────────────────────────────────────────────

  it('handles non-Error thrown by fetch', async () => {
    (global.fetch as any).mockRejectedValueOnce('String error');

    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const applyBtn = await screen.findByRole('button', { name: /apply/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load overlay data/)).toBeInTheDocument();
    });
  });

  it('handles zero strike price input', async () => {
    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );
    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const strikeInput = await screen.findByLabelText(/strike price/i);
    await user.clear(strikeInput);
    await user.type(strikeInput, '0');

    expect((strikeInput as HTMLInputElement).value).toBe('0');
  });

  it('clears error message on clear button', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const applyBtn = await screen.findByRole('button', { name: /apply/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    const clearBtn = await screen.findByRole('button', { name: /clear/i });
    await user.click(clearBtn);

    // Error should be cleared when panel closes
    await waitFor(() => {
      expect(screen.queryByText(/Network error/)).not.toBeInTheDocument();
    });
  });

  it('ticker prop displays in panel title', async () => {
    render(
      <OptionsOverlaySelector
        ticker="QQQ"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText(/QQQ/)).toBeInTheDocument();
    });
  });

  it('passes correct parameters to API call', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ points: [] }),
    });

    const user = userEvent.setup();
    render(
      <OptionsOverlaySelector
        ticker="SPY"
        onOverlayChange={mockOnOverlayChange}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /add overlay/i });
    fireEvent.click(toggleBtn);

    const strikeInput = await screen.findByLabelText(/strike price/i);
    const expiryInput = await screen.findByLabelText(/expiry date/i);
    const typeSelect = await screen.findByLabelText(/option type/i);

    await user.clear(strikeInput);
    await user.type(strikeInput, '425');
    await user.clear(expiryInput);
    await user.type(expiryInput, '2026-09-18');
    await user.selectOptions(typeSelect, 'put');

    const applyBtn = screen.getByRole('button', { name: /apply/i });
    await user.click(applyBtn);

    await waitFor(() => {
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('ticker=SPY');
      expect(callUrl).toContain('strike=425');
      expect(callUrl).toContain('expiry=2026-09-18');
      expect(callUrl).toContain('optionType=put');
    });
  });
});
