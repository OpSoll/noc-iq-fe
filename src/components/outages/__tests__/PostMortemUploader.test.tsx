import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostMortemUploader, formatFileSize } from '../PostMortemUploader';

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockToast,
}));

describe('PostMortemUploader', () => {
  const outageId = 'outage-test-123';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders nothing when outage is open (not resolved)', () => {
    const { container } = render(
      <PostMortemUploader outageId={outageId} isResolved={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders uploader card and empty state when outage is resolved', () => {
    render(<PostMortemUploader outageId={outageId} isResolved={true} />);
    expect(screen.getByText(/Outage Post-Mortem & Incident Attachments/i)).toBeInTheDocument();
    expect(screen.getByTestId('upload-post-mortem-btn')).toBeInTheDocument();
    expect(screen.getByText(/No post-mortem documents attached yet/i)).toBeInTheDocument();
  });

  it('formats file sizes accurately', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('rejects files larger than 10MB and shows error', async () => {
    render(<PostMortemUploader outageId={outageId} isResolved={true} />);
    const input = screen.getByTestId('post-mortem-file-input');

    // Create a 12MB oversized file
    const oversizedFile = new File(['a'.repeat(1024)], 'incident-report.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(oversizedFile, 'size', { value: 12 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('upload-error-banner')).toBeInTheDocument();
      expect(screen.getByText(/exceeds the 10MB limit/i)).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining('exceeds the 10MB limit'),
        'error'
      );
    });
  });

  it('rejects files with unsupported extensions', async () => {
    render(<PostMortemUploader outageId={outageId} isResolved={true} />);
    const input = screen.getByTestId('post-mortem-file-input');

    const invalidFile = new File(['binary content'], 'script.sh', {
      type: 'application/x-sh',
    });

    fireEvent.change(input, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('upload-error-banner')).toBeInTheDocument();
      expect(screen.getByText(/Only PDF, PNG, and DOCX are allowed/i)).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining('Only PDF, PNG, and DOCX are allowed'),
        'error'
      );
    });
  });

  it('accepts and renders valid PDF, PNG, and DOCX files', async () => {
    render(<PostMortemUploader outageId={outageId} isResolved={true} />);
    const input = screen.getByTestId('post-mortem-file-input');

    const pdfFile = new File(['test pdf content'], 'post-mortem.pdf', {
      type: 'application/pdf',
    });
    const pngFile = new File(['test png content'], 'diagram.png', {
      type: 'image/png',
    });

    fireEvent.change(input, { target: { files: [pdfFile, pngFile] } });

    await waitFor(() => {
      expect(screen.getByText('post-mortem.pdf')).toBeInTheDocument();
      expect(screen.getByText('diagram.png')).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining('attachment(s) added successfully'),
        'success'
      );
    });
  });

  it('allows removing an attachment', async () => {
    render(<PostMortemUploader outageId={outageId} isResolved={true} />);
    const input = screen.getByTestId('post-mortem-file-input');

    const file = new File(['data'], 'report.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('report.docx')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle('Remove attachment');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.queryByText('report.docx')).not.toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith('Attachment removed.', 'info');
    });
  });
});
