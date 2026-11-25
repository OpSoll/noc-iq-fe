import { describe, expect, it, vi } from "vitest";
import {
  formatOutageDuration,
  formatOutagesToCsv,
  downloadOutagesCsv,
} from "./outagesDurationAndExport";

describe("Outages Duration Counter & CSV Export Helpers (#471, #476)", () => {
  describe("formatOutageDuration (#471)", () => {
    it("formats minutes only when duration is under 1 hour", () => {
      const now = new Date("2026-11-25T10:45:00.000Z");
      const detected = new Date("2026-11-25T10:00:00.000Z"); // 45 min

      const res = formatOutageDuration(detected, now);
      expect(res.text).toBe("45m ongoing");
      expect(res.hours).toBe(0);
      expect(res.minutes).toBe(45);
      expect(res.totalMinutes).toBe(45);
      expect(res.isOverFourHours).toBe(false);
    });

    it("formats hours and minutes (e.g. '2h 15m ongoing')", () => {
      const now = new Date("2026-11-25T12:15:00.000Z");
      const detected = new Date("2026-11-25T10:00:00.000Z"); // 2h 15m

      const res = formatOutageDuration(detected, now);
      expect(res.text).toBe("2h 15m ongoing");
      expect(res.hours).toBe(2);
      expect(res.minutes).toBe(15);
      expect(res.totalMinutes).toBe(135);
      expect(res.isOverFourHours).toBe(false);
    });

    it("detects when duration exceeds 4 hours (> 240 minutes)", () => {
      const now = new Date("2026-11-25T14:30:00.000Z");
      const detected = new Date("2026-11-25T10:00:00.000Z"); // 4h 30m

      const res = formatOutageDuration(detected, now);
      expect(res.text).toBe("4h 30m ongoing");
      expect(res.hours).toBe(4);
      expect(res.minutes).toBe(30);
      expect(res.totalMinutes).toBe(270);
      expect(res.isOverFourHours).toBe(true);
    });

    it("flags exactly 4 hours (240 minutes) as over four hours threshold", () => {
      const now = new Date("2026-11-25T14:00:00.000Z");
      const detected = new Date("2026-11-25T10:00:00.000Z"); // 4h 0m = 240 min

      const res = formatOutageDuration(detected, now);
      expect(res.text).toBe("4h 0m ongoing");
      expect(res.isOverFourHours).toBe(true);
    });

    it("handles null or undefined safely", () => {
      const res = formatOutageDuration(null);
      expect(res.text).toBe("0m ongoing");
      expect(res.isOverFourHours).toBe(false);
    });
  });

  describe("formatOutagesToCsv (#476)", () => {
    const mockOutages = [
      {
        id: "outage-101",
        site_name: "Lagos Core POP",
        severity: "critical",
        status: "open",
        detected_at: "2026-11-25T08:00:00.000Z",
        resolved_at: undefined,
        sla_status: undefined,
      },
      {
        id: "outage-102",
        site_name: "Nairobi Edge DC",
        severity: "high",
        status: "resolved",
        detected_at: "2026-11-25T06:00:00.000Z",
        resolved_at: "2026-11-25T06:45:00.000Z",
        sla_status: {
          mttr_minutes: 45,
          status: "met" as const,
          threshold_minutes: 60,
          amount: 100,
          payment_type: "reward" as const,
          rating: "excellent" as const,
        },
      },
    ];

    it("includes exact required headers: Outage ID, Site, Severity, Status, Detected, Resolved, MTTR", () => {
      const csv = formatOutagesToCsv(mockOutages);
      const lines = csv.split("\n");

      expect(lines[0]).toBe("Outage ID,Site,Severity,Status,Detected,Resolved,MTTR");
    });

    it("formats rows with correct field mappings and quotes", () => {
      const csv = formatOutagesToCsv(mockOutages);
      const lines = csv.split("\n");

      expect(lines.length).toBe(3);
      // Row 1 (active outage, resolved_at and mttr are N/A)
      expect(lines[1]).toBe(
        '"outage-101","Lagos Core POP","critical","open","2026-11-25T08:00:00.000Z","N/A","N/A"',
      );
      // Row 2 (resolved outage with MTTR = 45)
      expect(lines[2]).toBe(
        '"outage-102","Nairobi Edge DC","high","resolved","2026-11-25T06:00:00.000Z","2026-11-25T06:45:00.000Z","45"',
      );
    });

    it("escapes quotes inside values properly", () => {
      const outageWithQuote = [
        {
          id: 'outage-"special"',
          site_name: 'Site "Alpha"',
          severity: "medium",
          status: "open",
          detected_at: "2026-11-25T09:00:00.000Z",
        },
      ];
      const csv = formatOutagesToCsv(outageWithQuote);
      expect(csv).toContain('"outage-""special"""');
      expect(csv).toContain('"Site ""Alpha"""');
    });
  });

  describe("downloadOutagesCsv (#476)", () => {
    it("creates an anchor tag and triggers download with date format outages-export-<date>.csv", () => {
      const clickSpy = vi.fn();
      const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      const removeSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

      let createdAnchor: HTMLAnchorElement | null = null;
      const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
        if (tag === "a") {
          const a = {
            click: clickSpy,
            set href(_val: string) {},
            set download(val: string) {
              this._download = val;
            },
            get download() {
              return this._download;
            },
            style: {},
          } as unknown as HTMLAnchorElement;
          createdAnchor = a;
          return a;
        }
        return document.createElement(tag);
      });

      downloadOutagesCsv([]);

      const todayStr = new Date().toISOString().split("T")[0];
      const expectedFilename = `outages-export-${todayStr}.csv`;

      expect(clickSpy).toHaveBeenCalled();
      expect(createdAnchor).not.toBeNull();
      expect((createdAnchor as unknown as { _download: string })._download).toBe(expectedFilename);
      createElementSpy.mockRestore();
      appendSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });
});
