import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import RateLimitSlider from '@/components/webhooks/RateLimitSlider';
import { ToastProvider } from '@/components/ui/toast';
import {
  MAX_RATE_LIMIT,
  MIN_RATE_LIMIT,
  RECOMMENDED_MIN_RATE_LIMIT,
} from '@/lib/webhookRateLimit';

function renderSlider(
  value = 25,
  onSave = vi.fn().mockResolvedValue(undefined)
) {
  render(
    <ToastProvider>
      <RateLimitSlider webhookId="w1" value={value} onSave={onSave} />
    </ToastProvider>
  );
  return { onSave };
}

describe('RateLimitSlider', () => {
  it('renders a slider spanning 5 to 100 requests per second', () => {
    renderSlider();

    const slider = screen.getByTestId('rate-limit-slider');
    expect(slider).toHaveAttribute('min', String(MIN_RATE_LIMIT));
    expect(slider).toHaveAttribute('max', String(MAX_RATE_LIMIT));
    expect(slider).toHaveAttribute('type', 'range');
  });

  it('shows the current value', () => {
    renderSlider(40);
    expect(screen.getByTestId('rate-limit-value')).toHaveTextContent('40 req/s');
  });

  it('explains the per-hour consequence of the limit', () => {
    renderSlider(10);
    expect(screen.getByTestId('rate-limit-help')).toHaveTextContent(
      '10 dispatches per second (36000 per hour)'
    );
  });

  it('updates the displayed value when the slider moves', async () => {
    const user = userEvent.setup();
    renderSlider(25);

    const slider = screen.getByTestId('rate-limit-slider');
    slider.focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByTestId('rate-limit-value')).toHaveTextContent('26 req/s');
  });

  it('warns when the limit is below the recommended minimum', async () => {
    const user = userEvent.setup();
    renderSlider(RECOMMENDED_MIN_RATE_LIMIT);

    const slider = screen.getByTestId('rate-limit-slider');
    slider.focus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');

    const warning = screen.getByTestId('rate-limit-warning');
    expect(warning).toHaveTextContent('Below the recommended minimum');
    // A warning, not a hard error.
    expect(warning).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('rate-limit-save')).toBeEnabled();
  });

  it('does not warn at or above the recommended minimum', () => {
    renderSlider(RECOMMENDED_MIN_RATE_LIMIT);
    expect(screen.queryByTestId('rate-limit-warning')).not.toBeInTheDocument();
  });

  it('allows saving a below-recommended value, since it is only a warning', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSlider(25);

    const slider = screen.getByTestId('rate-limit-slider');
    slider.focus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');

    await user.click(screen.getByTestId('rate-limit-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  it('saves the adjusted rate limit for the endpoint', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSlider(25);

    const slider = screen.getByTestId('rate-limit-slider');
    slider.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');

    await user.click(screen.getByTestId('rate-limit-save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('w1', 27));
  });

  it('confirms the save with a toast', async () => {
    const user = userEvent.setup();
    renderSlider(25);

    const slider = screen.getByTestId('rate-limit-slider');
    slider.focus();
    await user.keyboard('{ArrowRight}');
    await user.click(screen.getByTestId('rate-limit-save'));

    expect(
      await screen.findByText('Rate limit saved: 26 req/s')
    ).toBeInTheDocument();
  });

  it('keeps the draft when saving fails and reports the error', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('Backend rejected limit'));
    renderSlider(25, onSave);

    const slider = screen.getByTestId('rate-limit-slider');
    slider.focus();
    await user.keyboard('{ArrowRight}');
    await user.click(screen.getByTestId('rate-limit-save'));

    expect(await screen.findByText('Backend rejected limit')).toBeInTheDocument();
    expect(screen.getByTestId('rate-limit-value')).toHaveTextContent('26 req/s');
    expect(screen.getByTestId('rate-limit-save')).toBeEnabled();
  });

  it('disables save until the value changes', () => {
    renderSlider(25);
    expect(screen.getByTestId('rate-limit-save')).toBeDisabled();
  });

  it('restores the persisted value with Reset', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSlider(25);

    const slider = screen.getByTestId('rate-limit-slider');
    slider.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(screen.getByTestId('rate-limit-value')).toHaveTextContent('28 req/s');

    await user.click(screen.getByRole('button', { name: /reset/i }));

    expect(screen.getByTestId('rate-limit-value')).toHaveTextContent('25 req/s');
    expect(screen.getByTestId('rate-limit-save')).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('clamps an out-of-range persisted value into the slider bounds', () => {
    renderSlider(500);
    expect(screen.getByTestId('rate-limit-value')).toHaveTextContent('100 req/s');
  });

  it('clamps a persisted value below the minimum', () => {
    renderSlider(1);
    expect(screen.getByTestId('rate-limit-value')).toHaveTextContent('5 req/s');
  });

  it('exposes the value to assistive technology', () => {
    renderSlider(30);
    expect(screen.getByTestId('rate-limit-slider')).toHaveAttribute(
      'aria-valuetext',
      '30 req/s'
    );
  });
});
