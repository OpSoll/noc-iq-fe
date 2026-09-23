import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutagesTable, toAriaSortValue } from "./OutagesTable";
import type { OutageRow } from "./OutagesTable";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ROWS: OutageRow[] = [
  {
    id: "1",
    title: "Bravo Outage",
    severity: "high",
    status: "open",
    createdAt: "2024-01-02T10:00:00Z",
  },
  {
    id: "2",
    title: "Alpha Outage",
    severity: "low",
    status: "resolved",
    createdAt: "2024-01-01T08:00:00Z",
  },
  {
    id: "3",
    title: "Charlie Outage",
    severity: "critical",
    status: "open",
    createdAt: "2024-01-03T12:00:00Z",
  },
];

// ─── toAriaSortValue unit tests ───────────────────────────────────────────────

describe("toAriaSortValue", () => {
  it("maps false to 'none'", () => {
    expect(toAriaSortValue(false)).toBe("none");
  });

  it("maps 'asc' to 'ascending'", () => {
    expect(toAriaSortValue("asc")).toBe("ascending");
  });

  it("maps 'desc' to 'descending'", () => {
    expect(toAriaSortValue("desc")).toBe("descending");
  });
});

// ─── OutagesTable rendering ───────────────────────────────────────────────────

describe("OutagesTable", () => {
  it("renders all column headers with aria-sort='none' by default on unsorted columns", () => {
    render(<OutagesTable data={ROWS} sorting={[]} />);

    // Title column — no initial sort when sorting=[]
    const titleTh = screen.getByRole("columnheader", { name: /sort by title/i });
    expect(titleTh.closest("th")).toHaveAttribute("aria-sort", "none");

    // Severity column
    const severityTh = screen.getByRole("columnheader", {
      name: /sort by severity/i,
    });
    expect(severityTh.closest("th")).toHaveAttribute("aria-sort", "none");
  });

  it("sets aria-sort='ascending' on the active sort column when sorted asc", () => {
    render(
      <OutagesTable
        data={ROWS}
        sorting={[{ id: "title", desc: false }]}
      />,
    );

    const titleTh = screen.getByRole("columnheader", { name: /sort by title/i });
    expect(titleTh.closest("th")).toHaveAttribute("aria-sort", "ascending");
  });

  it("sets aria-sort='descending' on the active sort column when sorted desc", () => {
    render(
      <OutagesTable
        data={ROWS}
        sorting={[{ id: "title", desc: true }]}
      />,
    );

    const titleTh = screen.getByRole("columnheader", { name: /sort by title/i });
    expect(titleTh.closest("th")).toHaveAttribute("aria-sort", "descending");
  });

  it("sets aria-sort='none' on columns that are not currently sorted", () => {
    render(
      <OutagesTable
        data={ROWS}
        sorting={[{ id: "title", desc: false }]}
      />,
    );

    // Severity is not the active sort column
    const severityTh = screen
      .getAllByRole("columnheader")
      .find((el) => el.getAttribute("aria-sort") !== null && el.textContent?.includes("Severity"))
      ?? screen.getAllByRole("columnheader")[1];

    // find the th wrapping the severity header
    const ths = document.querySelectorAll("th[aria-sort]");
    const severityThEl = Array.from(ths).find((th) =>
      th.textContent?.toLowerCase().includes("severity"),
    );
    expect(severityThEl).toHaveAttribute("aria-sort", "none");
  });

  it("updates aria-sort attribute dynamically when user clicks a column header", async () => {
    const user = userEvent.setup();
    render(<OutagesTable data={ROWS} />);

    // Default sort is createdAt desc — Title should start as none
    const titleTh = document.querySelector("th[aria-sort]");
    const titleButton = screen.getByRole("button", { name: /sort by title/i });

    // First click → ascending
    await user.click(titleButton);
    const titleThAfterAsc = titleButton.closest("th");
    expect(titleThAfterAsc).toHaveAttribute("aria-sort", "ascending");

    // Second click → descending
    await user.click(titleButton);
    expect(titleThAfterAsc).toHaveAttribute("aria-sort", "descending");
  });

  it("sorts data by title ascending when Title header is clicked once", async () => {
    const user = userEvent.setup();
    render(<OutagesTable data={ROWS} />);

    const titleButton = screen.getByRole("button", { name: /sort by title/i });
    await user.click(titleButton);

    const cells = screen.getAllByRole("cell");
    // First visible row title cell should be "Alpha Outage"
    expect(cells[0]).toHaveTextContent("Alpha Outage");
  });

  it("renders an empty state message when data is empty", () => {
    render(<OutagesTable data={[]} />);
    expect(screen.getByText("No outages to display.")).toBeInTheDocument();
  });

  it("renders all rows when data is provided", () => {
    render(<OutagesTable data={ROWS} />);
    expect(screen.getByText("Alpha Outage")).toBeInTheDocument();
    expect(screen.getByText("Bravo Outage")).toBeInTheDocument();
    expect(screen.getByText("Charlie Outage")).toBeInTheDocument();
  });

  it("calls onSortingChange when operating in controlled mode", async () => {
    const user = userEvent.setup();
    const handleSort = vi.fn();
    render(
      <OutagesTable
        data={ROWS}
        sorting={[]}
        onSortingChange={handleSort}
      />,
    );

    const titleButton = screen.getByRole("button", { name: /sort by title/i });
    await user.click(titleButton);

    expect(handleSort).toHaveBeenCalledOnce();
    const nextSorting = handleSort.mock.calls[0][0];
    expect(nextSorting[0]).toMatchObject({ id: "title", desc: false });
  });
});
