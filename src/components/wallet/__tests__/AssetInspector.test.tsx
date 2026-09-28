import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetInspector } from '../AssetInspector';

describe('AssetInspector', () => {
  it('renders native XLM balance by default', () => {
    render(<AssetInspector />);
    
    expect(screen.getByText('XLM')).toBeInTheDocument();
    expect(screen.getByText('1,450.25')).toBeInTheDocument();
    expect(screen.getByText('Native')).toBeInTheDocument();
  });

  it('opens add custom token modal when Add Custom Token button is clicked', () => {
    render(<AssetInspector />);
    
    fireEvent.click(screen.getByRole('button', { name: /add custom token/i }));
    
    expect(screen.getByText(/add custom sac token/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. USDC/i)).toBeInTheDocument();
  });
});