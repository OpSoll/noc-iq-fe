import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

let dark: boolean;
let media: EventTarget;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = 'font-inter a11y-high-contrast';
  dark = true;
  media = new EventTarget();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return dark;
      },
      addEventListener: media.addEventListener.bind(media),
      removeEventListener: media.removeEventListener.bind(media),
    }))
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('applies and persists each choice while preserving unrelated root classes', async () => {
  const user = userEvent.setup();
  render(<ThemeSwitcher />);
  const select = screen.getByRole('combobox', { name: 'Theme' });
  expect(
    screen.getAllByRole('option').map((option) => option.textContent)
  ).toEqual(['Light', 'Dark', 'System Default']);
  expect(select).toHaveValue('system');
  expect(document.documentElement).toHaveClass('dark');

  for (const theme of ['light', 'dark', 'system']) {
    await user.selectOptions(select, theme);
    expect(localStorage.getItem('noc_theme')).toBe(theme);
    expect(document.documentElement).toHaveClass(
      theme === 'light' ? 'light' : 'dark'
    );
    expect(document.documentElement).not.toHaveClass(
      theme === 'light' ? 'dark' : 'light'
    );
    expect(document.documentElement).toHaveClass(
      'font-inter',
      'a11y-high-contrast'
    );
  }
});

it('restores the saved preference and follows OS changes only in System mode', async () => {
  localStorage.setItem('noc_theme', 'light');
  const user = userEvent.setup();
  const { unmount } = render(<ThemeSwitcher />);
  const select = screen.getByRole('combobox', { name: 'Theme' });
  expect(select).toHaveValue('light');
  act(() => media.dispatchEvent(new Event('change')));
  expect(document.documentElement).toHaveClass('light');
  await user.selectOptions(select, 'system');
  expect(document.documentElement).toHaveClass('dark');
  act(() => {
    dark = false;
    media.dispatchEvent(new Event('change'));
  });
  expect(document.documentElement).toHaveClass('light');
  unmount();
  act(() => {
    dark = true;
    media.dispatchEvent(new Event('change'));
  });
  expect(document.documentElement).toHaveClass('light');
});

it('falls back to System for invalid stored values and handles unavailable storage', async () => {
  localStorage.setItem('noc_theme', 'invalid');
  const { unmount } = render(<ThemeSwitcher />);
  expect(screen.getByRole('combobox')).toHaveValue('system');
  unmount();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  render(<ThemeSwitcher />);
  await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'light');
  expect(document.documentElement).toHaveClass('light');
});
