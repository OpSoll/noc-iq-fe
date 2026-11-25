# Wave 5 Closure Dashboard

> Last updated: 2026-11-25

## Issue Completion

| Metric | Value |
|--------|-------|
| Total Wave 5 issues | 108 |
| Closed | 100 |
| Open | 8 |
| Completion | 93% |

## Open Issues

- [ ] #469 Outages: Add affected services multi-select tag input component
- [ ] #468 Outages: Add duplicate outage detection warning when logging incident for same site
- [ ] #466 Outages: Add outage timeline audit trail event history log
- [ ] #465 Outages: Add root cause taxonomy tags (Hardware, Fiber Cut, Power, Third-Party)
- [ ] #464 Outages: Add affected subscribers impact calculation helper in OutageDetailsModal
- [ ] #460 Dashboard: Add SLA availability uptime SLA 9s display (99.9% vs 99.99%)
- [ ] #459 Dashboard: Add SLA violation notification sound alert toggle for NOC control rooms
- [ ] #456 Dashboard: Add SLA breach risk prediction score badge on open incidents

## Closed Issues

- [x] #1044 Telemetry privacy: apply redaction before buffering offline events
- [x] #1043 Live delivery stream: resume from the last acknowledged event after reconnect
- [x] #1042 Contract compatibility: report removed required fields separately from additions
- [x] #1041 Destination safety: reject URL credentials and encoded loopback hosts
- [x] #1040 Chain of custody: canonicalize evidence manifest ordering
- [x] #1039 Timezone conversion: disambiguate repeated local times at DST fall-back
- [x] #1038 CSV worker: cancel stale parse work when a new file replaces the current file
- [x] #1037 Query recovery: cap repeated recovery attempts for persistent 401 responses
- [x] #1036 Fetch client: distinguish aborts from network failures
- [x] #1035 Network status: prevent duplicate reconnect banners during rapid flaps
- [x] #1034 Session expiry modal: restore focus to the invoking control
- [x] #1033 Webhook delivery filter: preserve the selected filter on browser back
- [x] #1032 Webhook replay: handle a stale delivery after subscription deletion
- [x] #1031 Webhook replay: guard duplicate submits while a replay is pending
- [x] #1017 Dashboard: Add tooltips describing each KPI metric definition
- [x] #1016 Responsive: Add a min-width guard for chart containers
- [x] #1015 Docs: Add a component inventory doc for shared UI primitives
- [x] #1014 Testing: Add tests for the config diff generator
- [x] #1013 Testing: Add tests for the persisted page-size preference
- [x] #1012 State: Add a global error boundary reset on route change
- [x] #1011 State: Sync dashboard date range with the URL
- [x] #1010 Performance: Add request dedupe for duplicate dashboard queries
- [x] #1009 Bulk Import: Add a download-errors action for failed validation rows
- [x] #1008 Settings: Add an avatar initials fallback for the profile card
- [x] #1007 Config: Add a diff preview before saving config changes
- [x] #1006 Webhooks: Add a filter for delivery status in the history panel
- [x] #1005 Payments: Add a sticky totals row to the payments table
- [x] #1004 Outages: Show a subtle row highlight for recently updated outages
- [x] #1003 Outages: Add an SLA status column toggle to the outages table
- [x] #1002 Accessibility: Add visible labels to the dashboard date range inputs
- [x] #1001 Accessibility: Add keyboard support to severity legend tooltips
- [x] #1000 UX: Show a 'No results' message when command palette finds nothing
- [x] #999 UX: Add a keyboard shortcut to open the create outage form
- [x] #998 UX: Add page-level scroll restoration on back navigation
- [x] #997 Docs: Add a troubleshooting section for common local dev errors
- [x] #996 DX: Add a script to check for unused exports
- [x] #995 DX: Add a lint rule forbidding direct console.log in components
- [x] #994 Testing: Add tests for the CopyButton component
- [x] #993 Testing: Add tests for the relative time formatter
- [x] #992 Shared: Add a reusable relative-time component
- [x] #991 Shared: Add a reusable copy-to-clipboard button component
- [x] #990 Settings: Add a session-state message when the session list fails to load
- [x] #989 Config: Add numeric step and bounds hints to SLA threshold inputs
- [x] #988 Bulk Import: Preserve validation table scroll position on refresh
- [x] #987 Webhooks: Add relative 'last delivery' time in the webhook list
- [x] #986 Payments: Add relative timestamps for payment created_at
- [x] #985 Outages: Show an SLA status tooltip on the detail page badges
- [x] #984 Outages: Add a quick 'Assigned to me' filter chip
- [x] #983 UX: Guard against losing unsaved edits when leaving the config page
- [x] #982 UX: Auto-focus the first field of the create outage form
- [x] #981 UX: Add page title updates per route
- [x] #980 Theming: Add theme-aware focus ring color tokens
- [x] #979 Theming: Apply the persisted theme before first paint
- [x] #978 Security: Warn before navigating to external explorer links
- [x] #977 Security: Redact auth tokens from client error telemetry
- [x] #976 Notifications: Add a success toast after deleting an outage
- [x] #975 Type Safety: Add strict types for webhook payload objects
- [x] #974 Refactor: Extract a shared currency/amount formatter
- [x] #973 Refactor: Centralize relative and absolute time formatting
- [x] #972 Refactor: Extract a shared severity badge component
- [x] #971 DX: Add npm script to run a single test file
- [x] #970 Docs: Document required frontend environment variables
- [x] #969 Docs: Document how to run and scope frontend tests
- [x] #968 Testing: Add accessibility test for the outage detail page
- [x] #967 Testing: Add tests for SLA config form save/validation
- [x] #966 Testing: Add tests for the create outage form validation
- [x] #965 Testing: Add tests for payments service response mapping
- [x] #964 Testing: Add unit tests for normalizeApiError status mapping
- [x] #963 Testing: Add unit tests for outages filter URL synchronization
- [x] #962 State: Persist the outages page-size preference across sessions
- [x] #961 Filtering: Validate date-range filters so start is not after end
- [x] #960 Filtering: Add active filter chips with individual remove actions
- [x] #959 Search: Add a clear (x) button to the outages search input
- [x] #958 Search: Debounce the outages search input
- [x] #957 Performance: Add stable keys to outage list items
- [x] #956 Performance: Lazy-load the chart library on the dashboard route
- [x] #955 Performance: Debounce dashboard filter changes
- [x] #954 Performance: Memoize the outage table row component
- [x] #953 Responsive: Collapse outages filters into a mobile drawer
- [x] #952 Responsive: Stack KPI cards vertically on small screens
- [x] #951 Responsive: Make the outages table header sticky on scroll
- [x] #950 Responsive: Wrap wide tables in a horizontal scroll container
- [x] #949 Empty states: Add a 'log an outage' CTA to the outages empty state
- [x] #948 Error states: Add copy correlation ID action to error cards
- [x] #947 Error states: Add a friendly message for HTTP 413 responses
- [x] #946 Loading: Add a skeleton list for the webhooks page
- [x] #945 Loading: Add a route-level skeleton for the outage detail page
- [x] #944 Forms: Disable submit while a create/edit request is pending
- [x] #943 Forms: Trim leading and trailing whitespace on text input blur
- [x] #942 Forms: Add max-length hint beneath the site name input
- [x] #941 Accessibility: Add aria-live to asynchronous inline validation errors
- [x] #940 Accessibility: Add a caption to the payments table
- [x] #939 Accessibility: Add aria-current to the active pagination page
- [x] #938 Accessibility: Add an accessible name to the outages search input
- [x] #937 Accessibility: Announce toast confirmations via the live region
- [x] #936 Accessibility: Add aria-busy to loading containers
- [x] #935 Navigation: Add explicit focus-visible styling to nav links
- [x] #934 Navigation: Add tooltips to collapsed sidebar icon links
- [x] #933 Bulk Import: Show the detected row count before processing
- [x] #932 Bulk Import: Add per-row jump-to-error navigation in the validation table

---
_Auto-generated by `scripts/update-wave5-dashboard.mjs`. Do not edit manually._
