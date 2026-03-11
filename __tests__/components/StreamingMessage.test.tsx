import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StreamingMessage from '@/app/chat/components/StreamingMessage';

describe('StreamingMessage', () => {
  it('renders with data-testid', () => {
    render(<StreamingMessage content="Hello world" />);
    expect(screen.getByTestId('streaming-message')).toBeInTheDocument();
  });

  it('renders plain text content', () => {
    render(<StreamingMessage content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('shows cursor when isStreaming=true', () => {
    render(<StreamingMessage content="typing..." isStreaming />);
    expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument();
  });

  it('hides cursor when isStreaming=false', () => {
    render(<StreamingMessage content="done" isStreaming={false} />);
    expect(screen.queryByTestId('streaming-cursor')).not.toBeInTheDocument();
  });

  it('hides cursor by default', () => {
    render(<StreamingMessage content="done" />);
    expect(screen.queryByTestId('streaming-cursor')).not.toBeInTheDocument();
  });

  it('renders bold markdown', () => {
    render(<StreamingMessage content="This is **bold** text" />);
    const bold = screen.getByText('bold');
    expect(bold.tagName).toBe('STRONG');
  });

  it('renders italic markdown', () => {
    render(<StreamingMessage content="This is *italic* text" />);
    const italic = screen.getByText('italic');
    expect(italic.tagName).toBe('EM');
  });

  it('renders inline code markdown', () => {
    render(<StreamingMessage content="Run `npm install` now" />);
    const code = screen.getByText('npm install');
    expect(code.tagName).toBe('CODE');
  });

  it('renders fenced code block', () => {
    const content = '```\nconst x = 1;\n```';
    render(<StreamingMessage content={content} />);
    expect(screen.getByTestId('md-code-block')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('renders h1 heading', () => {
    render(<StreamingMessage content="# Title" />);
    expect(screen.getByTestId('md-h1')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('renders h2 heading', () => {
    render(<StreamingMessage content="## Section" />);
    expect(screen.getByTestId('md-h2')).toBeInTheDocument();
    expect(screen.getByText('Section')).toBeInTheDocument();
  });

  it('renders h3 heading', () => {
    render(<StreamingMessage content="### Subsection" />);
    expect(screen.getByTestId('md-h3')).toBeInTheDocument();
    expect(screen.getByText('Subsection')).toBeInTheDocument();
  });

  it('renders unordered list', () => {
    const content = '- Item one\n- Item two';
    render(<StreamingMessage content={content} />);
    expect(screen.getByTestId('md-ul')).toBeInTheDocument();
    expect(screen.getByText('Item one')).toBeInTheDocument();
    expect(screen.getByText('Item two')).toBeInTheDocument();
  });

  it('renders ordered list', () => {
    const content = '1. First\n2. Second';
    render(<StreamingMessage content={content} />);
    expect(screen.getByTestId('md-ol')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders empty content without errors', () => {
    const { container } = render(<StreamingMessage content="" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('cursor has pulse animation when streaming', () => {
    render(<StreamingMessage content="streaming" isStreaming />);
    const cursor = screen.getByTestId('streaming-cursor');
    expect(cursor).toHaveStyle({ animation: 'pulse 1s ease-in-out infinite' });
  });

  it('cursor has accent background color', () => {
    render(<StreamingMessage content="streaming" isStreaming />);
    const cursor = screen.getByTestId('streaming-cursor');
    expect(cursor).toHaveStyle({ background: 'var(--accent)' });
  });

  it('renders star-style unordered list items', () => {
    const content = '* Alpha\n* Beta';
    render(<StreamingMessage content={content} />);
    expect(screen.getByTestId('md-ul')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('skips blank lines without errors', () => {
    const content = 'First paragraph\n\nSecond paragraph';
    render(<StreamingMessage content={content} />);
    expect(screen.getByText('First paragraph')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph')).toBeInTheDocument();
  });

  it('renders mixed inline markdown in a heading', () => {
    render(<StreamingMessage content="## Title with **bold**" />);
    expect(screen.getByTestId('md-h2')).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });
});
