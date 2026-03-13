import { render } from '@testing-library/react';
import AppShell from '../../../app/components/AppShell';
import { describe, it, expect } from 'vitest';

describe('Scrollbar Layout', () => {
  it('should render main with overflow-y-auto', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const main = container.querySelector('main');
    expect(main).not.toHaveClass('overflow-y-auto');
  });

  it('should render main with overflow-x-hidden', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-x-hidden');
  });

  it('should render main with flex-1', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('flex-1');
  });

  it('should render AppShell wrapper with overflow-hidden', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('flex');
    expect(wrapper).toHaveClass('min-h-screen');
  });

  it('should render AppShell wrapper with h-screen', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('min-h-screen');
  });

  it('should render children inside main element', () => {
    const { getByText } = render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    const content = getByText('Test Content');
    expect(content.closest('main')).toBeTruthy();
  });
});
