'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Upload, FileText, Download, Trash2, AlertCircle, FileCheck } from 'lucide-react';

export interface PostMortemDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  dataUrl: string;
}

interface PostMortemUploaderProps {
  outageId: string;
  isResolved: boolean;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PostMortemUploader({ outageId, isResolved }: PostMortemUploaderProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<PostMortemDocument[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const storageKey = `outage_post_mortems_${outageId}`;

  // Load persisted attachments
  useEffect(() => {
    if (!outageId) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setAttachments(JSON.parse(stored));
      }
    } catch {
      // Fallback silently if localStorage is restricted
    }
  }, [outageId, storageKey]);

  // Save attachments on change
  const saveAttachments = (updated: PostMortemDocument[]) => {
    setAttachments(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // localStorage quota or restriction
    }
  };

  const validateFile = (file: File): string | null => {
    // 1. Check size (< 10MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File "${file.name}" exceeds the 10MB limit (${formatFileSize(file.size)}).`;
    }

    // 2. Check extension
    const nameLower = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => nameLower.endsWith(ext));
    const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type) || file.type === '';

    if (!hasValidExt && !hasValidMime) {
      return `Invalid file format for "${file.name}". Only PDF, PNG, and DOCX are allowed.`;
    }

    return null;
  };

  const handleFileSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    const newDocs: PostMortemDocument[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const errorMsg = validateFile(file);

      if (errorMsg) {
        setUploadError(errorMsg);
        toast(errorMsg, 'error');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Read file as Data URL for preview and download
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      newDocs.push({
        id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        dataUrl,
      });
    }

    const updated = [...attachments, ...newDocs];
    saveAttachments(updated);
    toast(`${newDocs.length} attachment(s) added successfully.`, 'success');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = (doc: PostMortemDocument) => {
    const link = document.createElement('a');
    link.href = doc.dataUrl;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(`Downloading ${doc.name}`, 'info');
  };

  const handleDelete = (docId: string) => {
    const updated = attachments.filter((d) => d.id !== docId);
    saveAttachments(updated);
    toast('Attachment removed.', 'info');
  };

  if (!isResolved) {
    return null;
  }

  return (
    <Card className="md:col-span-2 border-slate-200">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Outage Post-Mortem & Incident Attachments
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Attach post-mortem analysis reports, root cause summaries, or incident logs (PDF, PNG, DOCX up to 10MB).
          </p>
        </div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          Resolved Outage Artifacts
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Field */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            id="post-mortem-upload"
            data-testid="post-mortem-file-input"
            accept=".pdf,.png,.docx,application/pdf,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelection}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50"
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-post-mortem-btn"
          >
            <Upload className="h-4 w-4 text-blue-600" />
            <span>Upload Document</span>
          </Button>
          <span className="text-xs text-slate-500">
            Supported formats: <strong>PDF, PNG, DOCX</strong> (Max 10MB)
          </span>
        </div>

        {uploadError && (
          <div
            data-testid="upload-error-banner"
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Attachment List */}
        <div className="space-y-2 pt-2">
          {attachments.length === 0 ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 text-center text-xs text-muted-foreground">
              No post-mortem documents attached yet. Click &quot;Upload Document&quot; above to attach incident files.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {attachments.map((doc) => (
                <div
                  key={doc.id}
                  data-testid={`attachment-row-${doc.id}`}
                  className="flex items-center justify-between p-3 text-sm hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="truncate">
                      <p className="font-medium text-slate-900 truncate" title={doc.name}>
                        {doc.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(doc.size)} · Uploaded {new Date(doc.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Download document"
                      data-testid={`download-btn-${doc.id}`}
                      onClick={() => handleDownload(doc)}
                      className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600"
                    >
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Download {doc.name}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Remove attachment"
                      data-testid={`delete-btn-${doc.id}`}
                      onClick={() => handleDelete(doc.id)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove {doc.name}</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
