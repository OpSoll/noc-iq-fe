/**
 * Unit tests for the composed Skeleton placeholders (closes #610)
 *
 * Covers:
 *  - The original `Skeleton` primitive still renders a pulse block
 *  - `SkeletonText` honours the `lines` prop and shortens the last line
 *  - `SkeletonMetricCard` / `SkeletonStat` mirror the KPICard box model
 *  - `SkeletonChart` mirrors the SLATrendChart bar-row shape
 *  - `SkeletonCard` renders a heading and body placeholders
 *  - `SkeletonStatus` emits exactly one accessible "Loading…" announcement
 *  - Decorative bars stay hidden from assistive technology
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  Skeleton,
  SkeletonCard,
  SkeletonChart,
  SkeletonMetricCard,
  SkeletonStat,
  SkeletonStatus,
  SkeletonText,
} from '../skeleton';

describe('Skeleton', () => {
  it('renders a div with the pulse treatment', () => {
    const { container } = render(<Skeleton data-testid="block" />);
    const block = container.firstElementChild as HTMLElement;
    expect(block.tagName).toBe('DIV');
    expect(block).toHaveClass('animate-pulse');
    expect(block).toHaveClass('bg-muted');
  });

  it('merges caller classNames and forwards DOM props', () => {
    const { container } = render(
      <Skeleton className="h-4 w-full" data-testid="block" />
    );
    const block = container.firstElementChild as HTMLElement;
    expect(block).toHaveClass('h-4');
    expect(block).toHaveClass('w-full');
    expect(block).toHaveAttribute('data-testid', 'block');
  });
});

describe('SkeletonText', () => {
  it('defaults to three lines', () => {
    const { container } = render(<SkeletonText />);
    const lines = container.querySelectorAll('.animate-pulse');
    expect(lines).toHaveLength(3);
  });

  it('honours the lines prop', () => {
    const { container } = render(<SkeletonText lines={5} />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5);
  });

  it('shortens the final line so it reads as a paragraph', () => {
    const { container } = render(<SkeletonText lines={2} />);
    const lines = container.querySelectorAll('.animate-pulse');
    expect(lines[0]).not.toHaveClass('w-2/3');
    expect(lines[1]).toHaveClass('w-2/3');
  });

  it('renders nothing for zero or negative line counts', () => {
    const { container } = render(<SkeletonText lines={0} />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });

  it('hides the decorative lines from assistive technology', () => {
    const { container } = render(<SkeletonText lines={3} />);
    expect(container.firstElementChild).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });
});

describe('SkeletonStat', () => {
  it('renders a title, a value and a caption', () => {
    const { container } = render(<SkeletonStat />);
    const blocks = container.querySelectorAll('.animate-pulse');
    expect(blocks).toHaveLength(3);
    // 20px label + 36px value + 16px caption matches the real KPI card.
    expect(blocks[0]).toHaveClass('h-5');
    expect(blocks[1]).toHaveClass('h-9');
    expect(blocks[2]).toHaveClass('h-4');
  });

  it('can drop the caption line', () => {
    const { container } = render(<SkeletonStat withCaption={false} />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2);
  });
});

describe('SkeletonMetricCard', () => {
  it('keeps the KPICard shell so the grid row does not resize', () => {
    const { container } = render(<SkeletonMetricCard />);
    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveClass('rounded-xl');
    expect(card).toHaveClass('border-l-4');
    expect(card).toHaveClass('shadow-sm');
    // The KPI card's own p-5 body padding is reproduced on the inner shell.
    expect(card.firstElementChild).toHaveClass('p-5');
  });

  it('applies the highlight tone border', () => {
    const { container } = render(<SkeletonMetricCard highlight="red" />);
    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveClass('border-l-red-500');
  });

  it('defaults to the blue tone', () => {
    const { container } = render(<SkeletonMetricCard />);
    expect(container.firstElementChild).toHaveClass('border-l-blue-500');
  });

  it('merges a caller className onto the card shell', () => {
    const { container } = render(
      <SkeletonMetricCard className="col-span-2" />
    );
    expect(container.firstElementChild).toHaveClass('col-span-2');
  });
});

describe('SkeletonChart', () => {
  it('renders a heading plus the requested bar rows', () => {
    const { container } = render(<SkeletonChart rows={3} />);
    expect(container.querySelector('.h-5')).not.toBeNull();
    // 1 heading + (2 label/value + 1 track) per row
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(10);
  });

  it('defaults to four rows', () => {
    const { container } = render(<SkeletonChart />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(13);
  });

  it('mirrors the chart card surface', () => {
    const { container } = render(<SkeletonChart rows={1} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveClass('bg-white');
    expect(card).toHaveClass('shadow-sm');
  });
});

describe('SkeletonCard', () => {
  it('renders a heading placeholder and body text', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelector('.h-5')).not.toBeNull();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
  });

  it('can render body content only', () => {
    const { container } = render(<SkeletonCard withHeader={false} />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3);
  });
});

describe('SkeletonStatus', () => {
  it('announces loading exactly once', () => {
    render(
      <SkeletonStatus>
        <SkeletonMetricCard />
        <SkeletonChart rows={2} />
      </SkeletonStatus>
    );

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getAllByText('Loading…')).toHaveLength(1);
  });

  it('accepts a custom label', () => {
    render(
      <SkeletonStatus label="Loading outage metrics">
        <SkeletonStat />
      </SkeletonStatus>
    );
    expect(screen.getByText('Loading outage metrics')).toBeInTheDocument();
  });
});
