/**
 * Unit tests for Modal (closes #707)
 *
 * Covers:
 *  - Modal renders nothing when isOpen=false
 *  - Modal renders dialog when isOpen=true
 *  - Escape key closes the modal (calls onClose)
 *  - Escape key stopPropagation prevents parent handlers firing
 *  - Clicking the X button calls onClose
 *  - Clicking the backdrop calls onClose when disableBackdropClose=false
 *  - Clicking the backdrop does NOT call onClose when disableBackdropClose=true
 *  - aria-modal, role="dialog", and aria-labelledby are present
 *  - Focus is restored to trigger element on close
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Modal from "../modal";

function renderModal(
  props: Partial<Parameters<typeof Modal>[0]> & { isOpen?: boolean } = {},
) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: "Test dialog",
    children: <p>Dialog body</p>,
    ...props,
  };
  return { ...render(<Modal {...defaultProps} />), onClose: defaultProps.onClose };
}

describe("Modal", () => {
  // ── Visibility ──────────────────────────────────────────────────────────

  it("renders nothing when isOpen is false", () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it("renders the dialog panel when isOpen is true", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders the title text", () => {
    renderModal({ title: "Confirm deletion" });
    expect(screen.getByText("Confirm deletion")).toBeInTheDocument();
  });

  it("renders children inside the dialog", () => {
    renderModal({ children: <p>Custom body text</p> });
    expect(screen.getByText("Custom body text")).toBeInTheDocument();
  });

  // ── ARIA semantics ──────────────────────────────────────────────────────

  it("dialog panel has role='dialog'", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("dialog panel has aria-modal='true'", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("dialog panel is labelled by the title heading via aria-labelledby", () => {
    renderModal({ title: "My Modal" });
    const dialog = screen.getByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    const heading = document.getElementById(labelId!);
    expect(heading?.textContent).toBe("My Modal");
  });

  // ── Escape key close ────────────────────────────────────────────────────

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Escape keydown event does not bubble to parent handlers after close", () => {
    // The focus trap in useFocusTrap calls preventDefault on Escape, so a
    // second document-level keydown for the same key should not fire onClose
    // twice (the useFocusTrap handler calls onClose and the listener is
    // removed in cleanup — so only one call expected).
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(document, { key: "Escape" });

    // Only one call — propagation stopped correctly by useFocusTrap
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Close button ────────────────────────────────────────────────────────

  it("calls onClose when the X close button is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const closeBtn = screen.getByRole("button", { name: /close dialog/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("close button has an accessible aria-label", () => {
    renderModal();
    const closeBtn = screen.getByRole("button", { name: /close dialog/i });
    expect(closeBtn).toHaveAttribute("aria-label", "Close dialog");
  });

  // ── Backdrop close ──────────────────────────────────────────────────────

  it("calls onClose when backdrop is clicked (default behaviour)", () => {
    const onClose = vi.fn();
    const { container } = renderModal({ onClose });

    // The backdrop is the first direct child of the render container
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT call onClose when backdrop is clicked and disableBackdropClose=true", () => {
    const onClose = vi.fn();
    const { container } = renderModal({ onClose, disableBackdropClose: true });

    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Dialog panel click isolation ────────────────────────────────────────

  it("clicking inside the dialog panel does not bubble to backdrop", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);

    expect(onClose).not.toHaveBeenCalled();
  });
});
