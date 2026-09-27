import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import TopicChecklist from '@/components/webhooks/TopicChecklist';
import { WEBHOOK_EVENTS } from '@/lib/webhookEvents';

function renderChecklist(value: string[] = []) {
  const onChange = vi.fn();
  render(<TopicChecklist value={value} onChange={onChange} />);
  return { onChange };
}

describe('TopicChecklist', () => {
  it('lists every supported event topic with a checkbox', () => {
    renderChecklist();

    for (const event of WEBHOOK_EVENTS) {
      expect(
        screen.getByTestId(`topic-checkbox-${event.topic}`)
      ).toBeInTheDocument();
      expect(screen.getByText(event.label)).toBeInTheDocument();
    }
  });

  it('exposes a description tooltip for each topic', () => {
    renderChecklist();

    for (const event of WEBHOOK_EVENTS) {
      const description = screen.getByTestId(`topic-description-${event.topic}`);
      expect(description).toHaveAttribute('title', event.description);
    }
  });

  it('reflects the selected topics', () => {
    renderChecklist(['outage.created', 'sla.breached']);

    expect(
      screen.getByTestId('topic-checkbox-outage.created')
    ).toBeChecked();
    expect(screen.getByTestId('topic-checkbox-sla.breached')).toBeChecked();
    expect(
      screen.getByTestId('topic-checkbox-outage.resolved')
    ).not.toBeChecked();
  });

  it('reports the selected count', () => {
    renderChecklist(['outage.created']);
    expect(
      screen.getByText(`1 of ${WEBHOOK_EVENTS.length} selected`)
    ).toBeInTheDocument();
  });

  it('adds a topic when its checkbox is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderChecklist([]);

    await user.click(screen.getByTestId('topic-checkbox-outage.created'));

    expect(onChange).toHaveBeenCalledWith(['outage.created']);
  });

  it('removes a topic when its checkbox is clicked again', async () => {
    const user = userEvent.setup();
    const { onChange } = renderChecklist(['outage.created', 'sla.breached']);

    await user.click(screen.getByTestId('topic-checkbox-outage.created'));

    expect(onChange).toHaveBeenCalledWith(['sla.breached']);
  });

  it('emits topics in canonical catalog order', async () => {
    const user = userEvent.setup();
    const { onChange } = renderChecklist(['outage.created']);

    await user.click(screen.getByTestId('topic-checkbox-sla.breached'));

    // sla.breached comes before outage.created in the catalog.
    expect(onChange).toHaveBeenCalledWith(['sla.breached', 'outage.created']);
  });

  it('selects every topic', async () => {
    const user = userEvent.setup();
    const { onChange } = renderChecklist([]);

    await user.click(screen.getByTestId('topic-select-all'));

    expect(onChange).toHaveBeenCalledWith(WEBHOOK_EVENTS.map((e) => e.topic));
  });

  it('deselects every topic', async () => {
    const user = userEvent.setup();
    const { onChange } = renderChecklist(WEBHOOK_EVENTS.map((e) => e.topic));

    await user.click(screen.getByTestId('topic-deselect-all'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('disables Select All when everything is already selected', () => {
    renderChecklist(WEBHOOK_EVENTS.map((e) => e.topic));
    expect(screen.getByTestId('topic-select-all')).toBeDisabled();
    expect(screen.getByTestId('topic-deselect-all')).toBeEnabled();
  });

  it('disables Deselect All when nothing is selected', () => {
    renderChecklist([]);
    expect(screen.getByTestId('topic-deselect-all')).toBeDisabled();
  });

  it('never counts an unrecognised topic towards the selection', () => {
    renderChecklist(['outage.created', 'made.up']);
    expect(
      screen.getByText(`1 of ${WEBHOOK_EVENTS.length} selected`)
    ).toBeInTheDocument();
  });

  it('warns about unrecognised topics rather than dropping them silently', () => {
    renderChecklist(['made.up']);

    const warning = screen.getByTestId('topic-unknown-warning');
    expect(warning).toHaveTextContent('made.up');
    expect(warning).toHaveTextContent('Ignoring unrecognised topic');
  });

  it('does not warn for a clean selection', () => {
    renderChecklist(['outage.created']);
    expect(screen.queryByTestId('topic-unknown-warning')).not.toBeInTheDocument();
  });

  it('disables every control when disabled', () => {
    render(
      <TopicChecklist
        value={['outage.created']}
        onChange={vi.fn()}
        disabled
      />
    );

    expect(screen.getByTestId('topic-select-all')).toBeDisabled();
    expect(screen.getByTestId('topic-deselect-all')).toBeDisabled();
    expect(screen.getByTestId('topic-checkbox-outage.created')).toBeDisabled();
  });
});
