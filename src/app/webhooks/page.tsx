"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FixedSizeList } from "react-window";
import {
  fetchWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  fetchWebhookDeliveries,
  retryDelivery,
} from "@/services/webhookService";
import { saveDraft, loadDraft, clearDraft } from "@/lib/drafts";
import type { Webhook, WebhookDelivery } from "@/types/webhook";
import { WebhookDeliveryChart } from "@/components/webhooks/WebhookDeliveryChart";

const AVAILABLE_EVENTS = [
  "outage.created",
  "outage.resolved",
  "payment.processed",
  "sla.breached",
];
const DRAFT_KEY = "webhook-new";

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hasDraft] = useState(() => !!loadDraft(DRAFT_KEY));
  const [draftRestoreShown, setDraftRestoreShown] = useState(hasDraft);
  const [draftRestored, setDraftRestored] = useState(hasDraft);

  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all",
  );
  const [eventFilter, setEventFilter] = useState(
    searchParams.get("event") || "all",
  );

  useEffect(() => {
    if (!showForm || editingId || !draftRestored) return;
    const timer = setInterval(() => {
      saveDraft(DRAFT_KEY, {
        url: formUrl,
        events: JSON.stringify(formEvents),
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [showForm, editingId, draftRestored, formUrl, formEvents]);

  function restoreWebhookDraft() {
    const draft = loadDraft(DRAFT_KEY);
    if (draft) {
      setFormUrl(draft.values.url || "");
      try {
        setFormEvents(JSON.parse(draft.values.events || "[]"));
      } catch {
        setFormEvents([]);
      }
    }
    setDraftRestoreShown(false);
  }

  function dismissWebhookDraft() {
    clearDraft(DRAFT_KEY);
    setDraftRestoreShown(false);
  }

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: fetchWebhooks,
  });

  const { data: deliveries = [], isLoading: deliveriesLoading } = useQuery({
    queryKey: ["webhook-deliveries", selectedWebhook?.id],
    queryFn: () => fetchWebhookDeliveries(selectedWebhook!.id),
    enabled: !!selectedWebhook,
  });

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const code = d.response_code ?? -1;
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "success" && code >= 200 && code < 300) ||
        (statusFilter === "client_error" && code >= 400 && code < 500) ||
        (statusFilter === "server_error" && code >= 500);
      const eventMatch = eventFilter === "all" || d.event === eventFilter;
      return statusMatch && eventMatch;
    });
  }, [deliveries, statusFilter, eventFilter]);

  const [maxRetries, setMaxRetries] = useState(3);
  const [backoffSeconds, setBackoffSeconds] = useState(5);
  const [payloadSearchQuery, setPayloadSearchQuery] = useState("");

  const verifySnippetNode = `const crypto = require('crypto');
const signature = req.headers['x-signature'];
const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));`;

  const verifySnippetPython = `import hmac, hashlib
signature = request.headers.get('X-Signature')
hash = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
is_valid = hmac.compare_digest(signature, hash)`;

  const createMutation = useMutation({
    mutationFn: createWebhook,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      clearDraft(DRAFT_KEY);
      resetForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof updateWebhook>[1];
    }) => updateWebhook(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      resetForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      if (selectedWebhook) setSelectedWebhook(null);
    },
  });

  const retryMutation = useMutation({
    mutationFn: ({
      webhookId,
      deliveryId,
    }: {
      webhookId: string;
      deliveryId: string;
    }) => retryDelivery(webhookId, deliveryId),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["webhook-deliveries", selectedWebhook?.id],
      }),
  });

  function resetForm() {
    setShowForm(false);
    setFormUrl("");
    setFormEvents([]);
    setFormError(null);
    setEditingId(null);
    clearDraft(DRAFT_KEY);
  }

  function openCreate() {
    setEditingId(null);
    setFormUrl("");
    setFormEvents([]);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(wh: Webhook) {
    setEditingId(wh.id);
    setFormUrl(wh.url);
    setFormEvents(wh.events);
    setFormError(null);
    setShowForm(true);
  }

  function handleFilterChange(type: "status" | "event", value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set(type, value);
    window.history.pushState({}, "", url);
    if (type === "status") setStatusFilter(value);
    if (type === "event") setEventFilter(value);
  }

  function toggleEvent(event: string) {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!formUrl) {
      setFormError("URL is required.");
      return;
    }
    if (formEvents.length === 0) {
      setFormError("Select at least one event.");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        payload: { url: formUrl, events: formEvents },
      });
    } else {
      createMutation.mutate({ url: formUrl, events: formEvents });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Webhooks</h1>
          <p className="text-sm text-gray-500">
            Manage webhook endpoints and delivery history.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New webhook
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold text-gray-700">
            {editingId ? "Edit webhook" : "New webhook"}
          </h2>

          {draftRestoreShown && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <span>You have an unsaved draft. </span>
              <button
                onClick={restoreWebhookDraft}
                className="font-medium underline hover:text-amber-900"
              >
                Restore
              </button>
              <span> | </span>
              <button
                onClick={dismissWebhookDraft}
                className="font-medium underline hover:text-amber-900"
              >
                Discard
              </button>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Payload URL
            </label>
            <input
              type="url"
              required
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Events</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map((ev) => (
                <label
                  key={ev}
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={formEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="rounded"
                  />
                  {ev}
                </label>
              ))}
            </div>
          </div>

          {formError && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {formError}
            </p>
          )}

                      <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">Max Retries ({maxRetries})</label>
              <input type="range" min={1} max={10} value={maxRetries} onChange={e => setMaxRetries(Number(e.target.value))} className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">Backoff Interval ({backoffSeconds}s)</label>
              <input type="range" min={1} max={60} value={backoffSeconds} onChange={e => setBackoffSeconds(Number(e.target.value))} className="w-full" />
            </div>
            <div className="space-y-2 border-t pt-2">
              <label className="text-sm font-medium block text-gray-700">Signature Verification Snippets (HMAC SHA-256)</label>
              <pre className="bg-slate-900 text-white rounded p-3 text-[10px] overflow-auto max-h-32 mb-2">{verifySnippetNode}</pre>
              <pre className="bg-slate-900 text-white rounded p-3 text-[10px] overflow-auto max-h-32">{verifySnippetPython}</pre>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">Event Subscriptions</label>
              {["sla.violation", "sla.warning", "sla.resolved", "outage.created"].map(evt => (
                <label key={evt} className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={formEvents.includes(evt)}
                    onChange={e => {
                      if (e.target.checked) setFormEvents([...formEvents, evt]);
                      else setFormEvents(formEvents.filter(x => x !== evt));
                    }}
                  />
                  {evt}
                </label>
              ))}
            </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading webhooks…</p>
      ) : webhooks.length === 0 ? (
        <p className="text-sm text-gray-400">No webhooks configured yet.</p>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {wh.url}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {wh.events.join(", ")} &middot;{" "}
                    <span
                      className={wh.active ? "text-green-600" : "text-gray-400"}
                    >
                      {wh.active ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() =>
                      setSelectedWebhook(
                        selectedWebhook?.id === wh.id ? null : wh,
                      )
                    }
                    className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    {selectedWebhook?.id === wh.id
                      ? "Hide deliveries"
                      : "Deliveries"}
                  </button>
                  <button
                    onClick={() => openEdit(wh)}
                    className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(wh.id)}
                    disabled={deleteMutation.isPending}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {selectedWebhook?.id === wh.id && (
                <div className="mt-4 border-t pt-4">
                  <div className="mb-3">
                    <WebhookDeliveryChart deliveries={filteredDeliveries} />
                  </div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center justify-between w-full pr-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Delivery history
                      </h3>
                      <input
                        type="text"
                        placeholder="Search JSON payloads..."
                        value={payloadSearchQuery}
                        onChange={e => setPayloadSearchQuery(e.target.value)}
                        className="rounded border p-1 text-xs text-gray-800 max-w-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={statusFilter}
                        onChange={(e) =>
                          handleFilterChange("status", e.target.value)
                        }
                        className="rounded-md border-gray-300 py-1 text-xs focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="all">All Statuses</option>
                        <option value="success">Success (2xx)</option>
                        <option value="client_error">Client Error (4xx)</option>
                        <option value="server_error">Server Error (5xx)</option>
                      </select>
                      <select
                        value={eventFilter}
                        onChange={(e) =>
                          handleFilterChange("event", e.target.value)
                        }
                        className="rounded-md border-gray-300 py-1 text-xs focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="all">All Events</option>
                        {AVAILABLE_EVENTS.map((ev) => (
                          <option key={ev} value={ev}>
                            {ev}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {deliveriesLoading ? (
                    <p className="text-xs text-gray-400">Loading…</p>
                  ) : filteredDeliveries.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      No deliveries match the current filters.
                    </p>
                  ) : (
                    <div
                      className="rounded-lg"
                      style={{ height: Math.min(filteredDeliveries.length, 15) * 44 }}
                    >
                      <FixedSizeList
                        height={Math.min(filteredDeliveries.length, 15) * 44}
                        width="100%"
                        itemCount={filteredDeliveries.length}
                        itemSize={44}
                        itemData={filteredDeliveries}
                      >
                        {({ index, style, data }) => {
                          const d: WebhookDelivery = data[index];
                          return (
                            <div
                              style={style}
                              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={
                                    d.status === "success"
                                      ? "text-green-600"
                                      : d.status === "failed"
                                        ? "text-red-600"
                                        : "text-yellow-600"
                                  }
                                >
                                  {d.status}
                                </span>
                                <span className="text-gray-500">{d.event}</span>
                                {d.response_code && (
                                  <span className="text-gray-400">
                                    HTTP {d.response_code}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">
                                  {new Date(d.created_at).toLocaleString()}
                                </span>
                                {d.status === "failed" && (
                                  <button
                                    onClick={() =>
                                      retryMutation.mutate({
                                        webhookId: String(wh.id),
                                        deliveryId: d.id,
                                      })
                                    }
                                    disabled={retryMutation.isPending}
                                    className="rounded border border-blue-200 px-2 py-0.5 text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                                  >
                                    Retry
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }}
                      </FixedSizeList>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
