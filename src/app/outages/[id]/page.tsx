'use client';

import { TextArea } from '@/components/ui/TextArea';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import { SLADisputesPanel } from '@/components/outages/SLADisputesPanel';
import { PostMortemUploader } from '@/components/outages/PostMortemUploader';
import { OutageDurationCounter } from '@/components/outages/OutageDurationCounter';
import { PrintButton } from '@/components/shared/PrintButton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RouteEmptyState,
  RouteErrorState,
  RouteLoadingState,
} from '@/components/ui/route-state';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { announce } from '@/hooks/useOutageRealtime';
import { useSession } from '@/hooks/useSession';
import { formatTimestampWithTimeZone } from '@/lib/time';
import {
  getSlaAmountTooltip,
  getSlaRatingTooltip,
  getSlaStatusBadgeTooltip,
} from '@/lib/slaStatusTooltip';
import {
  getOutage,
  escalateOutage,
  resolveOutage,
  updateOutage,
  deleteOutage,
} from '@/services/outages';
import type {
  Outage,
  OutageResolutionPayment,
  OutageUpdate,
  Severity,
  OutageStatus,
} from '@/types/outages';

const SEVERITY_ORDER: Severity[] = ['low', 'medium', 'high', 'critical'];

function getHigherSeverities(severity: Severity) {
  const index = SEVERITY_ORDER.indexOf(severity);
  return SEVERITY_ORDER.slice(index + 1);
}

// Loading skeleton for ResolveOutageModal
function ResolveModalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="space-y-3">
          <div className="h-8 w-3/4 animate-pulse rounded-md bg-slate-200"></div>
          <div className="h-4 w-full animate-pulse rounded-md bg-slate-200"></div>
        </div>
        <div className="mt-6 space-y-4">
          <div className="h-32 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-50"></div>
          <div className="h-24 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-50"></div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <div className="h-10 w-24 animate-pulse rounded-lg bg-slate-200"></div>
          <div className="h-10 w-32 animate-pulse rounded-lg bg-slate-200"></div>
        </div>
      </div>
    </div>
  );
}

// Dynamically import the heavy modal with SSR disabled
const ResolveOutageModal = dynamic(
  () =>
    import('@/features/outages/components/ResolveOutageModal').then((mod) => ({
      default: mod.ResolveOutageModal,
    })),
  {
    ssr: false,
    loading: () => <ResolveModalSkeleton />,
  }
);
function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Failed to load outage';
}

function buildTimeline(outage: Outage) {
  const events: { label: string; time: string; note?: string }[] = [
    { label: 'Outage detected', time: outage.detected_at },
  ];
  if (outage.sla_status) {
    events.push({
      label: 'SLA computed',
      time: outage.resolved_at ?? outage.detected_at,
      note: `${outage.sla_status.status} · ${outage.sla_status.rating}`,
    });
  }
  if (outage.resolved_at) {
    events.push({ label: 'Outage resolved', time: outage.resolved_at });
  }
  for (const escalation of outage.severity_escalations ?? []) {
    events.push({
      label: `Severity escalated: ${escalation.previous_severity} → ${escalation.new_severity}`,
      time: escalation.timestamp,
      note: `Reason: ${escalation.reason}${escalation.actor ? ` · By ${escalation.actor}` : ''}`,
    });
  }
  return events.sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
}

export default function OutageDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const id = params?.id;

  const [outage, setOutage] = useState<Outage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionPayment, setResolutionPayment] =
    useState<OutageResolutionPayment | null>(null);
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [escalationSeverity, setEscalationSeverity] =
    useState<Severity>('critical');
  const [escalationReason, setEscalationReason] = useState('');
  const [escalating, setEscalating] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<OutageUpdate>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!id) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    getOutage(id, { signal: controller.signal })
      .then((data) => {
        setOutage(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === 'CanceledError') return;
        setError(getErrorMessage(err));
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [id]);

  // Poll for updates while outage is open
  useEffect(() => {
    if (!id || !outage || outage.status === 'resolved') return;

    const controller = new AbortController();
    const intervalId = setInterval(() => {
      getOutage(id, { signal: controller.signal })
        .then((data) => setOutage(data))
        .catch((err: unknown) => {
          if ((err as { name?: string }).name !== 'CanceledError') {
            console.error('Poll error:', err);
          }
        });
    }, 15_000);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [id, outage?.status]);

  function startEdit() {
    if (!outage) return;
    setEditForm({
      site_name: outage.site_name,
      severity: outage.severity,
      status: outage.status,
      description: outage.description,
      affected_services: outage.affected_services,
      affected_subscribers: outage.affected_subscribers,
      assigned_to: outage.assigned_to,
    });
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!id || !outage) return;
    setSaving(true);
    setError(null);
    try {
      const statusChanged =
        editForm.status !== undefined && editForm.status !== outage.status;
      const updated = await updateOutage(id, editForm);
      setOutage({ ...outage, ...updated });
      setEditing(false);
      toast('Outage updated.', 'success');
      if (statusChanged) {
        announce(`Outage #${id} status changed to ${editForm.status}`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleResolve(mttrMinutes: number) {
    if (!id) return;
    setResolving(true);
    setError(null);
    try {
      const updated = await resolveOutage(id, { mttr_minutes: mttrMinutes });
      setOutage({ ...updated.outage, sla_status: updated.sla });
      setResolutionPayment(updated.payment);
      setIsResolveModalOpen(false);
      toast('Outage resolved successfully.', 'success');
      announce(`Outage #${id} marked as Resolved`);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast(msg, 'error');
    } finally {
      setResolving(false);
    }
  }

  async function handleEscalate() {
    if (!id || !outage) return;
    const reason = escalationReason.trim();
    if (!reason) {
      setError('An escalation reason is required.');
      return;
    }

    setEscalating(true);
    setError(null);
    try {
      const response = await escalateOutage(id, {
        severity: escalationSeverity,
        reason,
      });
      const event = response.event ?? {
        id: `${id}-${Date.now()}`,
        previous_severity: outage.severity,
        new_severity: escalationSeverity,
        reason,
        timestamp: new Date().toISOString(),
        actor: user?.full_name ?? user?.email ?? user?.id ?? null,
      };
      setOutage({
        ...response.outage,
        severity: escalationSeverity,
        severity_escalations: response.outage.severity_escalations ?? [
          ...(outage.severity_escalations ?? []),
          event,
        ],
      });
      setShowEscalationModal(false);
      setEscalationReason('');
      toast('Outage severity escalated.', 'success');
      announce(
        `Outage #${id} severity escalated from ${outage.severity} to ${escalationSeverity}`
      );
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast(message, 'error');
    } finally {
      setEscalating(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOutage(id);
      router.push('/outages');
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Deletion failed. Please try again.'
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <RouteLoadingState
        title="Loading outage details"
        description="Pulling the incident timeline, SLA state, and resolution metadata."
      />
    );
  }

  if (error && !outage) {
    return (
      <RouteErrorState
        title="Error loading outage"
        description={error}
        primaryAction={{
          label: 'Reload page',
          onClick: () => window.location.reload(),
        }}
      />
    );
  }

  if (!outage) {
    return (
      <RouteEmptyState
        title="Outage not found"
        description="The outage may have been removed or the link may be outdated."
      />
    );
  }

  const isResolved = outage.status === 'resolved';
  const timeline = buildTimeline(outage);

  return (
    <TooltipProvider>
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Outage {outage.id}
          </h1>
          <Badge
            variant={outage.status === 'open' ? 'destructive' : 'default'}
            className="uppercase"
          >
            {outage.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 no-print">
          <PrintButton />
            <button
              type="button"
              onClick={() => {
                const nextSeverity = getHigherSeverities(outage.severity)[0];
                if (!nextSeverity) return;
                setEscalationSeverity(nextSeverity);
                setEscalationReason('');
                setError(null);
                setShowEscalationModal(true);
              }}
              disabled={
                isResolved ||
                getHigherSeverities(outage.severity).length === 0 ||
                escalating
              }
              className="rounded-md border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Escalate Severity
            </button>
          {!editing && (
            <button
              onClick={startEdit}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => setIsResolveModalOpen(true)}
            disabled={isResolved || resolving}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              isResolved
                ? 'cursor-not-allowed bg-gray-100 text-gray-500'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isResolved
              ? 'Outage Resolved'
              : resolving
                ? 'Resolving…'
                : 'Resolve Outage'}
          </button>
          <button
            onClick={() => {
              setShowDeleteConfirm(true);
              setDeleteError(null);
            }}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {editing && (
        <Card className="no-print">
          <CardHeader className="pb-3">
            <CardTitle>Edit Outage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  Site Name
                </label>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={editForm.site_name ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, site_name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  Severity
                </label>
                <select
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={editForm.severity ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      severity: e.target.value as Severity,
                    }))
                  }
                >
                  {(['critical', 'high', 'medium', 'low'] as Severity[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  Status
                </label>
                <select
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={editForm.status ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      status: e.target.value as OutageStatus,
                    }))
                  }
                >
                  <option value="open">open</option>
                  <option value="resolved">resolved</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  Assigned To
                </label>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={editForm.assigned_to ?? ''}
                  onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        assigned_to: e.target.value,
                      }))
                  }
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="outage-description"
                className="mb-1 block font-medium text-slate-700"
              >
                Description
              </label>
              <TextArea
                id="outage-description"
                maxLength={500}
                className="w-full rounded-md border border-slate-200 px-3 py-2"
                rows={3}
                value={editForm.description ?? ''}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">
                Affected Services (comma-separated)
              </label>
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2"
                value={(editForm.affected_services ?? []).join(', ')}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    affected_services: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditing(false)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveEdit()}
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Site Name</span>
              <span className="font-medium">{outage.site_name}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Severity</span>
              <Badge
                variant={
                  outage.severity === 'high' ? 'destructive' : 'secondary'
                }
              >
                {outage.severity}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Started At</span>
              <span className="font-medium">
                {formatTimestampWithTimeZone(outage.detected_at)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Resolved At</span>
              <span className="font-medium">
                {outage.resolved_at
                  ? formatTimestampWithTimeZone(outage.resolved_at)
                  : 'Ongoing'}
              </span>
            </div>
            {!outage.resolved_at && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <OutageDurationCounter
                    detectedAt={outage.detected_at}
                    status={outage.status}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>SLA Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {outage.sla_status ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {/* #985: focusable badge so keyboard users get the SLA explanation too. */}
                  <span
                    tabIndex={0}
                    role="img"
                    data-testid="sla-status-badge"
                    title={getSlaStatusBadgeTooltip(
                      outage.sla_status,
                      outage.sla_status.reason_code
                    )}
                    aria-label={`SLA status ${outage.sla_status.status}. ${getSlaStatusBadgeTooltip(
                      outage.sla_status,
                      outage.sla_status.reason_code
                    )}`}
                    className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {outage.sla_status.status}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rating</span>
                  <span
                    tabIndex={0}
                    role="img"
                    data-testid="sla-rating-badge"
                    title={getSlaRatingTooltip(outage.sla_status)}
                    aria-label={`SLA rating ${outage.sla_status.rating}. ${getSlaRatingTooltip(
                      outage.sla_status
                    )}`}
                    className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {outage.sla_status.rating}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span
                    tabIndex={0}
                    role="img"
                    data-testid="sla-amount-badge"
                    title={getSlaAmountTooltip(outage.sla_status)}
                    aria-label={`SLA amount ${outage.sla_status.amount}. ${getSlaAmountTooltip(
                      outage.sla_status
                    )}`}
                    className={`font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${outage.sla_status.amount > 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {outage.sla_status.amount > 0 ? '+' : ''}
                    {outage.sla_status.amount}
                  </span>
                </div>
              </>
            ) : (
              <span className="italic text-muted-foreground">
                No SLA computed yet.
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Resolution Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {resolutionPayment ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline">{resolutionPayment.status}</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium text-slate-900">
                    {resolutionPayment.amount} {resolutionPayment.asset_code}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Transaction</span>
                  <span className="break-all text-right font-mono text-xs text-slate-900">
                    {resolutionPayment.transaction_hash}
                  </span>
                </div>
              </>
            ) : (
              <span className="italic text-muted-foreground">
                Resolve the outage to view the generated payment record.
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Impact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Affected Services</span>
              <span className="font-medium">
                {outage.affected_services.length > 0
                  ? outage.affected_services.join(', ')
                  : 'Not provided'}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subscribers</span>
              <span className="font-medium">
                {outage.affected_subscribers ?? 'Unknown'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Outage History</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                No history events available yet.
              </p>
            ) : (
              <ol className="relative border-l border-slate-200 pl-6 space-y-4">
                {timeline.map((event, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full border-2 border-blue-500 bg-white" />
                    <p className="text-sm font-medium text-slate-900">
                      {event.label}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatTimestampWithTimeZone(event.time)}
                    </p>
                    {event.note && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {event.note}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {outage.location ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-6">
                  <div>
                    <span className="text-muted-foreground">Latitude</span>
                    <p className="font-medium font-mono">
                      {outage.location.latitude.toFixed(6)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Longitude</span>
                    <p className="font-medium font-mono">
                      {outage.location.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
                <div
                  className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                  style={{ paddingBottom: '40%' }}
                >
                  <iframe
                    title="Outage location map"
                    className="absolute inset-0 h-full w-full"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${outage.location.longitude - 0.05},${outage.location.latitude - 0.05},${outage.location.longitude + 0.05},${outage.location.latitude + 0.05}&layer=mapnik&marker=${outage.location.latitude},${outage.location.longitude}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Map data ©{' '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    OpenStreetMap
                  </a>{' '}
                  contributors
                </p>
              </div>
            ) : (
              <span className="italic text-muted-foreground">
                No location data available for this outage.
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Post-Incident Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-slate-700 mb-1">Root Cause</p>
              {outage.root_cause ? (
                <p className="text-slate-900 whitespace-pre-wrap">
                  {outage.root_cause}
                </p>
              ) : (
                <p className="italic text-muted-foreground">
                  No root cause recorded.
                </p>
              )}
            </div>
            <Separator />
            <div>
              <p className="font-medium text-slate-700 mb-1">
                Resolution Notes
              </p>
              {outage.resolution_notes ? (
                <p className="text-slate-900 whitespace-pre-wrap">
                  {outage.resolution_notes}
                </p>
              ) : (
                <p className="italic text-muted-foreground">
                  No resolution notes recorded.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <PostMortemUploader outageId={outage.id} isResolved={isResolved} />

        <SLADisputesPanel
          outageId={outage.id}
          canResolve={isResolved}
          outageSeverity={outage.severity}
          originalSlaResult={
            outage.sla_status
              ? { ...outage.sla_status, outage_id: outage.id }
              : null
          }
        />
      </div>

      <ResolveOutageModal
        outageId={outage.id}
        siteName={outage.site_name}
        severity={outage.severity}
        initialMttrMinutes={outage.sla_status?.mttr_minutes}
        isOpen={isResolveModalOpen}
        isResolving={resolving}
        error={error}
        onClose={() => {
          if (!resolving) setIsResolveModalOpen(false);
        }}
        onConfirmResolve={(mttr) => handleResolve(mttr)}
      />

        {showEscalationModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="escalate-severity-title"
          >
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
              <div>
                <h2
                  id="escalate-severity-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Escalate outage severity
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Choose a higher severity and record why this outage needs
                  escalation.
                </p>
              </div>
              <div>
                <label
                  htmlFor="escalation-severity"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  New severity
                </label>
                <select
                  id="escalation-severity"
                  value={escalationSeverity}
                  onChange={(event) =>
                    setEscalationSeverity(event.target.value as Severity)
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {getHigherSeverities(outage.severity).map((severity) => (
                    <option key={severity} value={severity}>
                      {severity[0].toUpperCase() + severity.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="escalation-reason"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Escalation reason
                </label>
                <TextArea
                  id="escalation-reason"
                  value={escalationReason}
                  onChange={(event) => setEscalationReason(event.target.value)}
                  maxLength={500}
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Describe what has worsened or why priority must increase."
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEscalationModal(false)}
                  disabled={escalating}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleEscalate()}
                  disabled={escalating || !escalationReason.trim()}
                  className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {escalating ? 'Escalating…' : 'Confirm Escalation'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h2
              id="delete-dialog-title"
              className="text-lg font-semibold text-slate-900"
            >
              Delete outage?
            </h2>
            <p className="text-sm text-slate-600">
              This will permanently delete outage{' '}
              <span className="font-medium">{outage.id}</span> (
              {outage.site_name}). This action cannot be undone.
            </p>
            {deleteError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {deleteError}{' '}
                <button
                  className="underline font-medium"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                >
                  Retry
                </button>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
