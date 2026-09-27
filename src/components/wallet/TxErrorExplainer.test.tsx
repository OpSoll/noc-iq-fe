import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';

import TxErrorExplainer from '@/components/wallet/TxErrorExplainer';

describe('TxErrorExplainer', () => {
  it('translates a reserve shortfall into plain language', () => {
    render(<TxErrorExplainer error="tx_insufficient_balance" />);

    expect(
      screen.getByText(/Balance does not cover the minimum reserve/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/What to do/i)).toBeInTheDocument();
    expect(screen.getByText(/Fund the account/i)).toBeInTheDocument();
  });

  it('translates a Soroban host error', () => {
    render(<TxErrorExplainer error="HostError: Error(Host, #1)" />);

    expect(
      screen.getByText(/Soroban host rejected the invocation/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/instruction budget/i)).toBeInTheDocument();
  });

  it('translates a contract-defined error', () => {
    render(<TxErrorExplainer error="Error(Contract, #42)" />);

    expect(
      screen.getByText(/The contract returned an error/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/error enum/i)).toBeInTheDocument();
  });

  it('exposes the resolved code for assertions and styling', () => {
    render(<TxErrorExplainer error="tx_too_early" />);
    expect(screen.getByTestId('tx-error-explainer')).toHaveAttribute(
      'data-code',
      'tx_too_early'
    );
  });

  it('links to the relevant Stellar documentation', () => {
    render(<TxErrorExplainer error="tx_bad_auth" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('stellar.org'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('uses the Soroban docs for contract-level failures', () => {
    render(<TxErrorExplainer error="contracterror! #3" />);
    expect(screen.getByRole('link').getAttribute('href')).toMatch(
      /smart-contracts\/errors/
    );
  });

  it('keeps the raw error available for lookup', async () => {
    const user = userEvent.setup();
    render(<TxErrorExplainer error="HostError: Error(Contract, #99)" />);

    await user.click(screen.getByText('Raw error'));
    expect(screen.getByTestId('tx-error-raw')).toHaveTextContent(
      'HostError: Error(Contract, #99)'
    );
  });

  it('degrades gracefully for an unrecognised error', () => {
    render(<TxErrorExplainer error="something odd happened" />);

    expect(screen.getByTestId('tx-error-explainer')).toHaveAttribute(
      'data-code',
      'unknown'
    );
    expect(screen.getByText('Unrecognised error')).toBeInTheDocument();
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('handles a null error without crashing', () => {
    render(<TxErrorExplainer error={null} />);
    expect(screen.getByTestId('tx-error-explainer')).toBeInTheDocument();
    expect(screen.queryByTestId('tx-error-raw')).not.toBeInTheDocument();
  });

  it('hides the description in compact mode but keeps the remedy', () => {
    render(<TxErrorExplainer error="tx_too_late" compact />);

    expect(
      screen.getByText(/Transaction expired before it was included/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('tx-error-raw')).not.toBeInTheDocument();
  });

  it('is announced as an alert', () => {
    render(<TxErrorExplainer error="tx_failed" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
