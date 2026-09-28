// src/components/admin/__tests__/DisputeReportExporter.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DisputeReportExporter, DisputeRecord } from '../DisputeReportExporter';

const mockDispute: DisputeRecord = {
  id: 'disp-101',
  title: 'Gateway Timeout Compensation Dispute',
  status: 'RESOLVED',
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-03T14:30:00Z',
  description: 'Dispute regarding SLA breach compensation during regional outage.',
  evidence: [
    {
      id: 'ev-1',
      title: 'Server Logs Snippet',
      url: 'https://storage.example.com/logs-101.txt',
      submittedAt: '2026-09-01T11:00:00Z',
      submittedBy: 'NodeOperator_X',
    },
  ],
  votes: [
    {
      id: 'vote-1',
      voterName: 'Auditor_Alpha',
      vote: 'FOR',
      comment: 'Logs clearly verify outage duration.',
      timestamp: '2026-09-02T09:00:00Z',
    },
  ],
  notes: [
    {
      id: 'note-1',
      author: 'Lead Auditor',
      content: 'Verified evidence against cloud provider incident timeline.',
      createdAt: '2026-09-02T10:30:00Z',
    },
  ],
};

describe('DisputeReportExporter', () => {
  it('renders export buttons correctly', () => {
    render(<DisputeReportExporter dispute={mockDispute} />);
    
    expect(screen.getByRole('button', { name: /download pdf report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export json bundle/i })).toBeInTheDocument();
  });

  it('triggers JSON export download when JSON button is clicked', () => {
    const createObjectURLSpy = jest.fn();
    // Mock anchor click
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<DisputeReportExporter dispute={mockDispute} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export json bundle/i }));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});