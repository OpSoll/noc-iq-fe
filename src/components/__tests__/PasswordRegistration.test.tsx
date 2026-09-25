import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import RegisterPage from '@/app/register/page';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn().mockResolvedValue({}) } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
beforeEach(() => vi.clearAllMocks());

it('shows all requirements and only enables registration for a strong matching password', () => {
  render(<RegisterPage />);
  const submit = screen.getByRole('button', { name: 'Create account' });
  const password = screen.getByLabelText('Password', { exact: true });
  const confirm = screen.getByLabelText('Confirm password');
  expect(submit).toBeDisabled();
  expect(screen.getAllByRole('listitem')).toHaveLength(5);
  expect(screen.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    'Weak'
  );
  fireEvent.change(password, { target: { value: 'Abcdefghi1!' } });
  expect(screen.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    'Medium'
  );
  expect(submit).toBeDisabled();
  fireEvent.change(password, { target: { value: 'Abcdefghij1!' } });
  expect(screen.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    'Strong'
  );
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5');
  expect(submit).toBeDisabled();
  fireEvent.change(confirm, { target: { value: 'Abcdefghij1!' } });
  expect(submit).toBeEnabled();
  fireEvent.change(password, { target: { value: 'ABCDEFGHIJ1!' } });
  expect(submit).toBeDisabled();
});

it('rejects direct form submission with a weak password', () => {
  render(<RegisterPage />);
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
    target: { value: 'weak' },
  });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'weak' },
  });
  fireEvent.submit(
    screen.getByRole('button', { name: 'Create account' }).closest('form')!
  );
  expect(api.post).not.toHaveBeenCalled();
  expect(
    screen.getByText('Password must meet all five requirements.')
  ).toBeInTheDocument();
});
