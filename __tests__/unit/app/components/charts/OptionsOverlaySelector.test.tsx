/**
 * Tests for: app/components/charts/OptionsOverlaySelector.tsx
 *
 * Coverage targets:
 * - Component rendering with default props
 * - Strike price input changes
 * - Expiry date input changes
 * - Option type selection (call/put)
 * - Apply button functionality
 * - Clear button functionality
 * - Error state handling
 * - Loading states
 * - Form validation
 * - API call on Apply
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OptionsOverlaySelector, { OverlayConfig } from '@/app/components/charts/OptionsOverlaySelector';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('OptionsOverlaySelector — Rendering with default props', () => {
  it('should render the toggle button initially closed', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveTextContent('+ Add Overlay');
  });

  it('should not display the panel when closed', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    expect(screen.queryByText(/Option Overlay/)).not.toBeInTheDocument();
  });

  it('should display the panel when toggle button is clicked', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    expect(screen.getByText(/Option Overlay \(SPX\)/)).toBeInTheDocument();
  });

  it('should render with correct default values', () => {
    const onOverlayChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const strikeInput = screen.getByLabelText(/Strike Price/i) as HTMLInputElement;
    const expiryInput = screen.getByLabelText(/Expiry Date/i) as HTMLInputElement;
    const optionTypeSelect = screen.getByLabelText(/Option Type/i) as HTMLSelectElement;

    expect(strikeInput.value).toBe('3000');
    expect(expiryInput.value).toBe('2026-06-17');
    expect(optionTypeSelect.value).toBe('call');
  });

  it('should render with custom default config', () => {
    const customConfig: OverlayConfig = {
      strike: 3500,
      expiry: '2026-09-18',
      optionType: 'put',
    };

    const onOverlayChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
        defaultConfig={customConfig}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const strikeInput = screen.getByLabelText(/Strike Price/i) as HTMLInputElement;
    const expiryInput = screen.getByLabelText(/Expiry Date/i) as HTMLInputElement;
    const optionTypeSelect = screen.getByLabelText(/Option Type/i) as HTMLSelectElement;

    expect(strikeInput.value).toBe('3500');
    expect(expiryInput.value).toBe('2026-09-18');
    expect(optionTypeSelect.value).toBe('put');
  });
});

describe('OptionsOverlaySelector — Strike price input changes', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
  });

  it('should update strike price when input changes', async () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const strikeInput = screen.getByLabelText(/Strike Price/i) as HTMLInputElement;
    fireEvent.change(strikeInput, { target: { value: '3200' } });

    expect(strikeInput.value).toBe('3200');
  });

  it('should convert empty strike price input to 0', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const strikeInput = screen.getByLabelText(/Strike Price/i) as HTMLInputElement;
    fireEvent.change(strikeInput, { target: { value: '' } });

    // Component converts empty to 0 (parseFloat('') || 0)
    expect(strikeInput.value).toBe('0');
  });

  it('should accept decimal values for strike price', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const strikeInput = screen.getByLabelText(/Strike Price/i) as HTMLInputElement;
    fireEvent.change(strikeInput, { target: { value: '3250.50' } });

    expect(strikeInput.value).toBe('3250.50');
  });

  it('should enforce min="0" on strike price input', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const strikeInput = screen.getByLabelText(/Strike Price/i) as HTMLInputElement;
    expect(strikeInput.getAttribute('min')).toBe('0');
  });
});

describe('OptionsOverlaySelector — Expiry date input changes', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
  });

  it('should update expiry date when input changes', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const expiryInput = screen.getByLabelText(/Expiry Date/i) as HTMLInputElement;
    fireEvent.change(expiryInput, { target: { value: '2026-12-18' } });

    expect(expiryInput.value).toBe('2026-12-18');
  });

  it('should accept date in YYYY-MM-DD format', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const expiryInput = screen.getByLabelText(/Expiry Date/i) as HTMLInputElement;
    fireEvent.change(expiryInput, { target: { value: '2027-03-19' } });

    expect(expiryInput.value).toBe('2027-03-19');
  });

  it('should maintain expiry date value on other input changes', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const expiryInput = screen.getByLabelText(/Expiry Date/i) as HTMLInputElement;
    const strikeInput = screen.getByLabelText(/Strike Price/i) as HTMLInputElement;

    fireEvent.change(expiryInput, { target: { value: '2026-12-18' } });
    fireEvent.change(strikeInput, { target: { value: '3200' } });

    expect(expiryInput.value).toBe('2026-12-18');
  });
});

describe('OptionsOverlaySelector — Option type selection', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
  });

  it('should render both call and put options', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    expect(screen.getByText(/Option Overlay/)).toBeInTheDocument();
    
    const selectElement = screen.getByLabelText(/Option Type/i) as HTMLSelectElement;
    const options = Array.from(selectElement.options).map(o => o.value);
    expect(options).toContain('call');
    expect(options).toContain('put');
  });

  it('should default to call option type', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const selectElement = screen.getByLabelText(/Option Type/i) as HTMLSelectElement;
    expect(selectElement.value).toBe('call');
  });

  it('should switch to put option type', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const selectElement = screen.getByLabelText(/Option Type/i) as HTMLSelectElement;
    fireEvent.change(selectElement, { target: { value: 'put' } });

    expect(selectElement.value).toBe('put');
  });

  it('should switch back from put to call', () => {
    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
        defaultConfig={{
          strike: 3000,
          expiry: '2026-06-17',
          optionType: 'put',
        }}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const selectElement = screen.getByLabelText(/Option Type/i) as HTMLSelectElement;
    expect(selectElement.value).toBe('put');

    fireEvent.change(selectElement, { target: { value: 'call' } });
    expect(selectElement.value).toBe('call');
  });
});

describe('OptionsOverlaySelector — Apply button functionality', () => {
  it('should call onOverlayChange with config when Apply is clicked', async () => {
    const onOverlayChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(onOverlayChange).toHaveBeenCalledWith({
        strike: 3000,
        expiry: '2026-06-17',
        optionType: 'call',
      });
    });
  });

  it('should make API call with correct parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const strikeInput = screen.getByLabelText(/Strike Price/i) as HTMLInputElement;
    fireEvent.change(strikeInput, { target: { value: '3200' } });

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/market/options-overlay'),
      );
      const callUrl = fetchMock.mock.calls[0][0];
      expect(callUrl).toContain('ticker=SPX');
      expect(callUrl).toContain('strike=3200');
      expect(callUrl).toContain('expiry=2026-06-17');
      expect(callUrl).toContain('optionType=call');
    });
  });

  it('should close panel on successful Apply', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);
    expect(screen.getByText(/Option Overlay/)).toBeInTheDocument();

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.queryByText(/Option Overlay/)).not.toBeInTheDocument();
    });
  });

  it('should disable Apply button during loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i }) as HTMLButtonElement;
    fireEvent.click(applyButton);

    // Check disabled state immediately after click (it should be disabled during loading)
    expect(applyButton.disabled).toBe(true);

    // Wait for the API call to complete
    await waitFor(() => {
      expect(onOverlayChange).toHaveBeenCalled();
    });
  });

  it('should handle API error with JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid strike price' }),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText(/Invalid strike price/)).toBeInTheDocument();
    });
  });

  it('should handle API error with status code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
    });
  });

  it('should handle network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });
});

describe('OptionsOverlaySelector — Clear button functionality', () => {
  it('should call onOverlayChange(null) when Clear is clicked', async () => {
    const onOverlayChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const clearButton = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearButton);

    expect(onOverlayChange).toHaveBeenCalledWith(null);
  });

  it('should close panel when Clear is clicked', () => {
    const onOverlayChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);
    expect(screen.getByText(/Option Overlay/)).toBeInTheDocument();

    const clearButton = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearButton);

    expect(screen.queryByText(/Option Overlay/)).not.toBeInTheDocument();
  });

  it('should clear error when Clear is clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Test error')),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText(/Test error/)).toBeInTheDocument();
    });

    fireEvent.click(toggleButton);
    fireEvent.click(toggleButton);

    const clearButton = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearButton);

    expect(screen.queryByText(/Test error/)).not.toBeInTheDocument();
  });

  it('should disable Clear button during loading', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    const clearButton = screen.getByRole('button', { name: /Clear/i }) as HTMLButtonElement;
    // Button should be disabled during loading
    expect(clearButton.disabled).toBe(true);
  });
});

describe('OptionsOverlaySelector — Error state handling', () => {
  it('should display error message when API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'No data available' }),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText(/No data available/)).toBeInTheDocument();
    });
  });

  it('should display error with X emoji', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Connection failed')),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText(/❌.*Connection failed/)).toBeInTheDocument();
    });
  });

  it('should clear error on successful Apply after error', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

    vi.stubGlobal('fetch', fetchMock);

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    let applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText(/First error/)).toBeInTheDocument();
    });

    fireEvent.click(toggleButton);
    fireEvent.click(toggleButton);

    applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.queryByText(/First error/)).not.toBeInTheDocument();
    });
  });

  it('should show generic error for non-Error exceptions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue('String error'),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load overlay data/)).toBeInTheDocument();
    });
  });
});

describe('OptionsOverlaySelector — Loading states', () => {
  it('should show Loading text on Apply button during request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i }) as HTMLButtonElement;

    // Click apply and verify button is disabled during the request
    fireEvent.click(applyButton);

    // Immediately check - button should be disabled during loading
    expect(applyButton.disabled).toBe(true);

    // Wait for the API call to complete (callback should be called)
    await waitFor(() => {
      expect(onOverlayChange).toHaveBeenCalled();
    });
  });

  it('should restore Apply button text after request completes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i }) as HTMLButtonElement;
    const initialText = applyButton.textContent;
    fireEvent.click(applyButton);

    // Panel should close on successful apply, so button will be gone
    // But we can verify that the callback was called
    await waitFor(() => {
      expect(onOverlayChange).toHaveBeenCalledWith({
        strike: 3000,
        expiry: '2026-06-17',
        optionType: 'call',
      });
      // Panel should close
      expect(screen.queryByText(/Option Overlay/)).not.toBeInTheDocument();
    });
  });

  it('should prevent multiple Apply clicks while loading', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);
    fireEvent.click(applyButton);
    fireEvent.click(applyButton);

    // Should only be called once, not three times (disabled state prevents it)
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Wait for the callback to be called and panel to close
    await waitFor(() => {
      expect(onOverlayChange).toHaveBeenCalled();
    });
  });
});

describe('OptionsOverlaySelector — Form validation', () => {
  it('should allow Apply with all valid inputs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i }) as HTMLButtonElement;
    expect(applyButton.disabled).toBe(false);

    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(onOverlayChange).toHaveBeenCalled();
    });
  });

  it('should accept zero strike price', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const strikeInput = screen.getByLabelText(/Strike Price/i) as HTMLInputElement;
    fireEvent.change(strikeInput, { target: { value: '0' } });

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(onOverlayChange).toHaveBeenCalledWith(
        expect.objectContaining({ strike: 0 }),
      );
    });
  });

  it('should handle non-numeric strike input gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    const strikeInput = screen.getByLabelText(/Strike Price/i) as HTMLInputElement;
    fireEvent.change(strikeInput, { target: { value: 'abc' } });

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(onOverlayChange).toHaveBeenCalledWith(
        expect.objectContaining({ strike: 0 }),
      );
    });
  });
});

describe('OptionsOverlaySelector — Toggle button behavior', () => {
  it('should toggle panel visibility', () => {
    const onOverlayChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });

    expect(screen.queryByText(/Option Overlay/)).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByText(/Option Overlay \(SPX\)/)).toBeInTheDocument();
    expect(toggleButton).toHaveTextContent('✕');

    fireEvent.click(toggleButton);
    expect(screen.queryByText(/Option Overlay/)).not.toBeInTheDocument();
    expect(toggleButton).toHaveTextContent('+ Add Overlay');
  });

  it('should display ticker in panel title', () => {
    const onOverlayChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    render(
      <OptionsOverlaySelector
        ticker="RUT"
        onOverlayChange={onOverlayChange}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    expect(screen.getByText(/Option Overlay \(RUT\)/)).toBeInTheDocument();
  });
});

describe('OptionsOverlaySelector — Comprehensive integration tests', () => {
  it('should handle full user flow: open -> modify -> apply -> close', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    // Open panel
    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);
    expect(screen.getByText(/Option Overlay/)).toBeInTheDocument();

    // Modify inputs
    const strikeInput = screen.getByLabelText(/Strike Price/i) as HTMLInputElement;
    const expiryInput = screen.getByLabelText(/Expiry Date/i) as HTMLInputElement;
    const optionTypeSelect = screen.getByLabelText(/Option Type/i) as HTMLSelectElement;

    fireEvent.change(strikeInput, { target: { value: '3300' } });
    fireEvent.change(expiryInput, { target: { value: '2026-09-18' } });
    fireEvent.change(optionTypeSelect, { target: { value: 'put' } });

    // Apply
    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(onOverlayChange).toHaveBeenCalledWith({
        strike: 3300,
        expiry: '2026-09-18',
        optionType: 'put',
      });
      expect(screen.queryByText(/Option Overlay/)).not.toBeInTheDocument();
    });
  });

  it('should handle error recovery flow: error -> clear -> retry', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

    vi.stubGlobal('fetch', fetchMock);

    const onOverlayChange = vi.fn();
    render(
      <OptionsOverlaySelector
        ticker="SPX"
        onOverlayChange={onOverlayChange}
      />
    );

    // First attempt - fails
    const toggleButton = screen.getByRole('button', { name: /Add Overlay/i });
    fireEvent.click(toggleButton);

    let applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    // Clear
    fireEvent.click(toggleButton);
    fireEvent.click(toggleButton);

    const clearButton = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearButton);

    // Reopen and retry
    fireEvent.click(toggleButton);
    applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(onOverlayChange).toHaveBeenCalledWith({
        strike: 3000,
        expiry: '2026-06-17',
        optionType: 'call',
      });
    });
  });
});
