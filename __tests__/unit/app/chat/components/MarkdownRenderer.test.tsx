import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownRenderer, {
  formatCurrency,
  formatPercentage,
} from '@/app/chat/components/MarkdownRenderer';

// CSS imports are no-ops in the test environment — highlight.js theme import is harmless.
vi.mock('highlight.js/styles/vs2015.css', () => ({}));

describe('MarkdownRenderer', () => {
  // ── Container ────────────────────────────────────────────────────────────

  it('renders the container with data-testid', () => {
    render(<MarkdownRenderer content="hello" />);
    expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument();
  });

  it('accepts an optional className prop', () => {
    render(<MarkdownRenderer content="hi" className="extra" />);
    expect(screen.getByTestId('markdown-renderer')).toHaveClass('extra');
  });

  // ── Basic markdown elements ──────────────────────────────────────────────

  it('renders bold text', () => {
    render(<MarkdownRenderer content="**bold**" />);
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('renders italic text', () => {
    render(<MarkdownRenderer content="_italic_" />);
    expect(screen.getByText('italic').tagName).toBe('EM');
  });

  it('renders a level-1 heading', () => {
    render(<MarkdownRenderer content="# Heading One" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Heading One' })).toBeInTheDocument();
  });

  it('renders a level-2 heading', () => {
    render(<MarkdownRenderer content="## Heading Two" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Heading Two' })).toBeInTheDocument();
  });

  it('renders a level-3 heading', () => {
    render(<MarkdownRenderer content="### Heading Three" />);
    expect(screen.getByRole('heading', { level: 3, name: 'Heading Three' })).toBeInTheDocument();
  });

  it('renders an unordered list', () => {
    render(<MarkdownRenderer content="- item one\n- item two" />);
    expect(screen.getByText('item one')).toBeInTheDocument();
    expect(screen.getByText('item two')).toBeInTheDocument();
  });

  it('renders an ordered list', () => {
    render(<MarkdownRenderer content="1. first\n2. second" />);
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  it('renders a blockquote', () => {
    render(<MarkdownRenderer content="> quoted text" />);
    expect(screen.getByText('quoted text').closest('blockquote')).toBeInTheDocument();
  });

  it('renders a horizontal rule', () => {
    const { container } = render(<MarkdownRenderer content={'---'} />);
    expect(container.querySelector('hr')).toBeInTheDocument();
  });

  // ── Links ────────────────────────────────────────────────────────────────

  it('renders links with data-testid and rel="noopener noreferrer"', () => {
    render(<MarkdownRenderer content="[click](https://example.com)" />);
    const link = screen.getByTestId('markdown-link');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  // ── Code ─────────────────────────────────────────────────────────────────

  it('renders inline code with data-testid', () => {
    render(<MarkdownRenderer content="Use `const` keyword." />);
    expect(screen.getByTestId('inline-code')).toHaveTextContent('const');
  });

  it('renders a fenced code block with data-testid', () => {
    render(
      <MarkdownRenderer
        content={'```\nconsole.log("hi");\n```'}
      />,
    );
    expect(screen.getByTestId('code-block')).toBeInTheDocument();
  });

  it('renders a language-tagged code block', () => {
    const { container } = render(
      <MarkdownRenderer content={'```javascript\nconst x = 1;\n```'} />,
    );
    // rehype-highlight adds hljs classes; at minimum the code block renders
    expect(screen.getByTestId('code-block')).toBeInTheDocument();
    const code = container.querySelector('code');
    expect(code).toBeInTheDocument();
  });

  // ── GFM tables ───────────────────────────────────────────────────────────

  it('renders a GFM table with data-testid', () => {
    const md = `| Header | Value |\n|--------|-------|\n| Row 1  | 100   |`;
    render(<MarkdownRenderer content={md} />);
    expect(screen.getByTestId('markdown-table')).toBeInTheDocument();
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Row 1')).toBeInTheDocument();
  });

  // ── XSS / Sanitisation ───────────────────────────────────────────────────

  it('strips <script> tags (XSS prevention)', () => {
    const { container } = render(
      <MarkdownRenderer content={'<script>alert("xss")</script> safe text'} />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('safe text');
  });

  it('removes javascript: href from links', () => {
    render(<MarkdownRenderer content={'[click](javascript:alert(1))'} />);
    // The link should either not render or have the href stripped
    const links = document.querySelectorAll('a');
    links.forEach((link) => {
      expect(link.getAttribute('href') ?? '').not.toContain('javascript:');
    });
  });

  it('strips iframe elements', () => {
    const { container } = render(
      <MarkdownRenderer content={'<iframe src="https://evil.com"></iframe> text'} />,
    );
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('strips inline event handlers (onerror)', () => {
    const { container } = render(
      <MarkdownRenderer content={'<img src="x" onerror="alert(1)">text'} />,
    );
    const img = container.querySelector('img');
    if (img) {
      expect(img.getAttribute('onerror')).toBeNull();
    }
  });

  // ── Financial number highlighting ────────────────────────────────────────

  it('highlights currency values with data-testid="financial-number"', () => {
    render(<MarkdownRenderer content="The price is $1,234.56 today." />);
    const nodes = screen.getAllByTestId('financial-number');
    const texts = nodes.map((n) => n.textContent);
    expect(texts).toContain('$1,234.56');
  });

  it('highlights percentage values with data-testid="financial-number"', () => {
    render(<MarkdownRenderer content="Volatility rose 12.5%." />);
    const nodes = screen.getAllByTestId('financial-number');
    const texts = nodes.map((n) => n.textContent);
    expect(texts).toContain('12.5%');
  });

  it('applies loss colour to negative percentages', () => {
    render(<MarkdownRenderer content="Down -3.2% today." />);
    const nodes = screen.getAllByTestId('financial-number');
    const negative = nodes.find((n) => n.textContent === '-3.2%');
    expect(negative).toBeDefined();
    expect(negative?.getAttribute('style') ?? '').toContain('var(--loss)');
  });

  it('applies gain colour to positive percentages', () => {
    render(<MarkdownRenderer content="Up +5.0% today." />);
    const nodes = screen.getAllByTestId('financial-number');
    const positive = nodes.find((n) => n.textContent === '+5.0%');
    expect(positive).toBeDefined();
    expect(positive?.getAttribute('style') ?? '').toContain('var(--gain)');
  });

  it('highlights abbreviated currency (e.g. $1.2M)', () => {
    render(<MarkdownRenderer content="Market cap is $1.2M." />);
    const nodes = screen.getAllByTestId('financial-number');
    const texts = nodes.map((n) => n.textContent);
    expect(texts).toContain('$1.2M');
  });
});

// ── Utility function tests ──────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats whole numbers with two decimal places', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00');
  });

  it('formats fractional numbers correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats negative values correctly', () => {
    expect(formatCurrency(-99.9)).toBe('-$99.90');
  });
});

describe('formatPercentage', () => {
  it('prefixes positive values with +', () => {
    expect(formatPercentage(1.24)).toBe('+1.24%');
  });

  it('keeps the - sign for negative values', () => {
    expect(formatPercentage(-0.87)).toBe('-0.87%');
  });

  it('formats zero as +0.00%', () => {
    expect(formatPercentage(0)).toBe('+0.00%');
  });

  it('rounds to two decimal places', () => {
    expect(formatPercentage(3.14159)).toBe('+3.14%');
  });
});
