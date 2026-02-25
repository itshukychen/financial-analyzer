import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlaceholderWidget from '@/app/components/PlaceholderWidget';

describe('PlaceholderWidget', () => {
  it('renders label', () => {
    render(<PlaceholderWidget label="Market Heatmap" />);
    expect(screen.getByText('Market Heatmap')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<PlaceholderWidget label="Heatmap" description="Visual sector breakdown" />);
    expect(screen.getByText('Visual sector breakdown')).toBeInTheDocument();
  });

  it('does NOT render description element when not provided', () => {
    const { container } = render(<PlaceholderWidget label="Heatmap" />);
    // description would be a <span> — check it's not present
    expect(container.querySelector('span[style*="opacity"]')).not.toBeInTheDocument();
  });

  it('always renders "Coming soon" badge', () => {
    render(<PlaceholderWidget label="Whatever" />);
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('default minHeight of 200px is applied to the container', () => {
    render(<PlaceholderWidget label="Test" />);
    const widget = screen.getByTestId('placeholder-widget');
    expect(widget).toHaveStyle({ minHeight: '200px' });
  });

  it('custom minHeight is applied to the container style', () => {
    render(<PlaceholderWidget label="Test" minHeight="400px" />);
    const widget = screen.getByTestId('placeholder-widget');
    expect(widget).toHaveStyle({ minHeight: '400px' });
  });
});
