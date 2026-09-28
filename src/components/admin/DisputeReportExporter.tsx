// src/components/admin/DisputeReportExporter.tsx
import React, { useState } from 'react';

export interface DisputeEvidence {
  id: string;
  title: string;
  url: string;
  submittedAt: string;
  submittedBy: string;
}

export interface DisputeVote {
  id: string;
  voterName: string;
  vote: 'FOR' | 'AGAINST' | 'ABSTAIN';
  comment?: string;
  timestamp: string;
}

export interface DisputeNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface DisputeRecord {
  id: string;
  title: string;
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED';
  createdAt: string;
  updatedAt: string;
  description: string;
  evidence: DisputeEvidence[];
  votes: DisputeVote[];
  notes: DisputeNote[];
}

interface DisputeReportExporterProps {
  dispute: DisputeRecord;
  className?: string;
}

export const DisputeReportExporter: React.FC<DisputeReportExporterProps> = ({ dispute, className = '' }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dispute, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `dispute-${dispute.id}-report.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Create printable container for PDF generation / window print
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Popup blocked. Please allow popups to export PDF reports.');
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Dispute Report #${dispute.id}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; padding: 40px; line-height: 1.5; }
              h1 { font-size: 24px; border-bottom: 2px solid #eaeaea; padding-bottom: 10px; margin-bottom: 20px; }
              h2 { font-size: 18px; margin-top: 30px; border-bottom: 1px solid #eaeaea; padding-bottom: 5px; }
              .meta { background: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
              .meta p { margin: 5px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 14px; }
              th { background: #f1f1f1; }
              ul { padding-left: 20px; }
              li { margin-bottom: 8px; font-size: 14px; }
            </style>
          </head>
          <body>
            <h1>Dispute Summary Report: #${dispute.id}</h1>
            <div class="meta">
              <p><strong>Title:</strong> ${dispute.title}</p>
              <p><strong>Status:</strong> ${dispute.status}</p>
              <p><strong>Created At:</strong> ${new Date(dispute.createdAt).toLocaleString()}</p>
              <p><strong>Last Updated:</strong> ${new Date(dispute.updatedAt).toLocaleString()}</p>
            </div>

            <h2>Description</h2>
            <p>${dispute.description}</p>

            <h2>Evidence Records (${dispute.evidence.length})</h2>
            <ul>
              ${dispute.evidence.map(e => `<li><strong>${e.title}</strong> — <a href="${e.url}" target="_blank">${e.url}</a> (Submitted by ${e.submittedBy} on${new Date(e.submittedAt).toLocaleDateString()})</li>`).join('')}
            </ul>

            <h2>Vote History (${dispute.votes.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Voter</th>
                  <th>Vote</th>
                  <th>Comment</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                ${dispute.votes.map(v => `<tr><td>${v.voterName}</td><td><strong>${v.vote}</strong></td><td>${v.comment || 'N/A'}</td><td>${new Date(v.timestamp).toLocaleString()}</td></tr>`).join('')}
              </tbody>
            </table>

            <h2>Auditor Notes (${dispute.notes.length})</h2>
            ${dispute.notes.map(n => `<div style="margin-bottom: 15px; border-left: 3px solid #0070f3; padding-left: 10px;"><p style="margin:0; font-size:13px; color:#555;"><strong>${n.author}</strong> —${new Date(n.createdAt).toLocaleString()}</p><p style="margin:5px 0 0 0; font-size:14px;">${n.content}</p></div>`).join('')}
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Trigger print dialog after assets load
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    } catch (error) {
      console.error('Failed to generate dispute PDF report:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <button
        onClick={handleExportPDF}
        disabled={isExporting}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
      >
        {isExporting ? 'Generating PDF...' : 'Download PDF Report'}
      </button>
      <button
        onClick={handleExportJSON}
        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
      >
        Export JSON Bundle
      </button>
    </div>
  );
};