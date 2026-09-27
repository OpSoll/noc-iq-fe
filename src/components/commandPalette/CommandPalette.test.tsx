import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, it, expect, vi } from 'vitest';

import CommandPalette from '@/components/commandPalette/CommandPalette';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const OUTFAGES = [
  { id: '123', siteId: 'LHR-04', severity: 'major' },
  { id: '456', siteId: 'JFK-02', severity: 'minor' },
];
const SITES = [{ id: 'LHR-04', name: 'Heathrow' }];

function open() {
  render(
    <CommandPalette
      outages={OUTFAGES}
      sites={SITES}
      extraCommands={[
        { id: 'custom', label: 'Run reconciliation', group: 'Actions' },
      ]}
    />
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    push.mockReset();
  });

  it('is closed by default', () => {
    open();
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
  });

  it('opens on Ctrl+K', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('{Control>}k{/Control}');

    expect(await screen.findByTestId('command-palette')).toBeInTheDocument();
  });

  it('opens on Meta+K for macOS', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('{Meta>}k{/Meta}');

    expect(await screen.findByTestId('command-palette')).toBeInTheDocument();
  });

  it('toggles closed on a second Ctrl+K', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('{Control>}k{/Control}');
    await screen.findByTestId('command-palette');
    await user.keyboard('{Control>}k{/Control}');

    await waitFor(() =>
      expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
    );
  });

  it('is an accessible modal dialog with a search input', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Command palette');

    const input = screen.getByTestId('command-palette-input');
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveFocus();
  });

  it('searches across routes, actions, outages, and sites', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByTestId('command-palette-input');

    await user.type(input, 'bulk');
    expect(screen.getByText('Bulk import')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'Heathrow');
    expect(screen.getByText('Heathrow (LHR-04)')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '123');
    expect(screen.getByText('Outage 123')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'reconciliation');
    expect(screen.getByText('Run reconciliation')).toBeInTheDocument();
  });

  it('reports when nothing matches', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(
      await screen.findByTestId('command-palette-input'),
      'zzzzz'
    );

    expect(screen.getByText(/No matches for/)).toBeInTheDocument();
  });

  it('navigates to a route when a command is chosen with Enter', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(
      await screen.findByTestId('command-palette-input'),
      'Dashboard'
    );
    await user.keyboard('{Enter}');

    expect(push).toHaveBeenCalledWith('/');
  });

  it('navigates to an outage by its id', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(await screen.findByTestId('command-palette-input'), '456');
    await user.keyboard('{Enter}');

    expect(push).toHaveBeenCalledWith('/outages/456');
  });

  it('closes after running a command', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(
      await screen.findByTestId('command-palette-input'),
      'Settings'
    );
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
    );
  });

  it('runs a command on click', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(await screen.findByTestId('command-palette-input'), 'Payments');
    await user.click(screen.getByText('Payments'));

    expect(push).toHaveBeenCalledWith('/payments');
  });

  it('moves the highlight with the arrow keys', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(await screen.findByTestId('command-palette-input'), 'import');
    const options = screen.getAllByTestId('command-palette-option');

    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByTestId('command-palette-option')[1]).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await user.keyboard('{ArrowUp}');
    expect(screen.getAllByTestId('command-palette-option')[0]).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('executes the highlighted command after arrowing down', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(await screen.findByTestId('command-palette-input'), 'import');
    await user.keyboard('{ArrowDown}{Enter}');

    // The second "import" match is Start bulk import.
    expect(push).toHaveBeenCalledWith('/bulk-import');
  });

  it('wraps the highlight at the ends of the list', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(await screen.findByTestId('command-palette-input'), 'import');
    await user.keyboard('{ArrowUp}');

    const options = screen.getAllByTestId('command-palette-option');
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');
  });

  it('jumps to the first and last result with Home and End', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(await screen.findByTestId('command-palette-input'), 'import');
    await user.keyboard('{End}');
    let options = screen.getAllByTestId('command-palette-option');
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    options = screen.getAllByTestId('command-palette-option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');
    await screen.findByTestId('command-palette');

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
    );
  });

  it('closes on a backdrop click', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');
    await screen.findByTestId('command-palette');

    const backdrop = document.querySelector('[data-backdrop]');
    await user.click(backdrop as Element);

    await waitFor(() =>
      expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
    );
  });

  it('resets the query when reopened', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByTestId('command-palette-input');
    await user.type(input, 'Dashboard');
    expect(input).toHaveValue('Dashboard');

    await user.keyboard('{Escape}');
    await user.keyboard('{Control>}k{/Control}');

    expect(await screen.findByTestId('command-palette-input')).toHaveValue('');
  });

  it('resets the highlight when the query changes', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByTestId('command-palette-input');

    await user.type(input, 'import');
    await user.keyboard('{ArrowDown}');
    await user.clear(input);
    await user.type(input, 'dash');

    expect(screen.getAllByTestId('command-palette-option')[0]).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('groups results by category', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(
      await screen.findByTestId('command-palette-input'),
      '123'
    );

    const listbox = screen.getByRole('listbox', { name: 'Commands' });
    expect(within(listbox).getByText('Outages')).toBeInTheDocument();
  });

  it('shows the keyboard hints in the footer', async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard('{Control>}k{/Control}');
    await screen.findByTestId('command-palette');

    expect(screen.getByText('↑↓ navigate')).toBeInTheDocument();
    expect(screen.getByText('↵ select')).toBeInTheDocument();
    expect(screen.getByText('esc close')).toBeInTheDocument();
  });
});
