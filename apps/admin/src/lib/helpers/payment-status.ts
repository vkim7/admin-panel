/**
 * Payment status helper (C#16) — single source of truth for payment status calculation.
 * Never update amountPaid or paymentStatus independently.
 */
export function calculatePaymentStatus(
  amountDue: number,
  discountAmount: number,
  amountPaid: number,
): "UNPAID" | "PARTIALLY_PAID" | "PAID" {
  const effectiveDue = amountDue - discountAmount;
  if (amountPaid >= effectiveDue) return "PAID";
  if (amountPaid > 0) return "PARTIALLY_PAID";
  return "UNPAID";
}
