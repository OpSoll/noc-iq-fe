# Implementation: Bulk Import issues #628–#631

Overlay onto `noc-iq-fe/src/components/bulk-import/`.

| Issue | File | Notes |
|-------|------|-------|
| #631 | `DuplicateDetector.tsx` | Detects `site_id`/`service_id` + `start_time` dups; Exclude Duplicates checkbox; badge |
| #630 | `ImportProgress.tsx` | Modal with % + processed/total, Cancel Import, completion summary |
| #629 | `SampleDownload.tsx` | Download Sample CSV with headers, 3 rows, comments |
| #628 | `ValidationPreview.tsx` | Double-click invalid cell → edit → re-validate on blur/Enter |
| — | `bulk-import-view.tsx` | Wired all of the above |
| — | `__tests__/*` | Unit tests for each feature |

## Verify
```bash
npm test -- src/components/bulk-import/__tests__
```
