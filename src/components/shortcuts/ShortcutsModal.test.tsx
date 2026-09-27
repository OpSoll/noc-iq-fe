import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import ShortcutsModal from '@/components/shortcuts/ShortcutsModal';
import { SHORTCUT_CATEGORIES, SHORTCUTS } from '@/lib/shortcuts';

describe('ShortcutsModal (uncontrolled)', () => {
  it('starts closed', () => {
    render(<ShortcutsModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on Shift + ?', async () => {
    const user = userEvent.setup();
    render(<ShortcutsModal />);

    await user.keyboard('{Shift>}?{/Shift}');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('toggles closed on a second Shift + ?', async () => {
    const user = userEvent.setup();
    render(<ShortcutsModal />);

    await user.keyboard('{Shift>}?{/Shift}');
    await screen.findByRole('dialog');
    await user.keyboard('{Shift>}?{/Shift}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('does not open on a bare slash, which is the outage filter shortcut', async () => {
    const user = userEvent.setup();
    render(<ShortcutsModal />);

    await user.keyboard('/');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not open on Shift + K, which belongs to the command palette', async () => {
    const user = userEvent.setup();
    render(<ShortcutsModal />);

    await user.keyboard('{Shift>}k{/Shift}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<ShortcutsModal />);
    await user.keyboard('{Shift>}?{/Shift}');
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('can be suppressed with enableGlobalShortcut', async () => {
    const user = userEvent.setup();
    render(<ShortcutsModal enableGlobalShortcut={false} />);

    await user.keyboard('{Shift>}?{/Shift}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ShortcutsModal (controlled)', () => {
  it('renders nothing when closed', () => {
    render(<ShortcutsModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onToggle when Shift + ? is pressed', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <ShortcutsModal isOpen={false} onClose={vi.fn()} onToggle={onToggle} />
    );

    await user.keyboard('{Shift>}?{/Shift}');

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsModal isOpen onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });
});

describe('ShortcutsModal contents', () => {
  async function open() {
    const user = userEvent.setup();
    render(<ShortcutsModal />);
    await user.keyboard('{Shift>}?{/Shift}');
    await screen.findByRole('dialog');
    return user;
  }

  it('categorises the shortcuts', async () => {
    await open();

    for (const category of SHORTCUT_CATEGORIES) {
      expect(
        screen.getByTestId(`shortcuts-category-${category}`)
      ).toBeInTheDocument();
    }
  });

  it('includes the categories the issue names', async () => {
    await open();

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Outage Table')).toBeInTheDocument();
    expect(screen.getByText('Command Palette')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('documents the command palette shortcut', async () => {
    await open();
    expect(
      screen.getByText('Open the command palette')
    ).toBeInTheDocument();
  });

  it('renders every registered shortcut', async () => {
    await open();

    for (const shortcut of SHORTCUTS) {
      expect(
        screen.getByTestId(`shortcut-${shortcut.id}`)
      ).toBeInTheDocument();
    }
  });

  it('reports the total count', async () => {
    await open();
    expect(
      screen.getByText(
        `${SHORTCUTS.length} shortcuts across ${SHORTCUT_CATEGORIES.length} categories.`
      )
    ).toBeInTheDocument();
  });

  it('tells the user how to open it', async () => {
    await open();
    expect(screen.getByText(/to toggle this dialog/i)).toBeInTheDocument();
  });
});
