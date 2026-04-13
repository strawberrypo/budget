import type { TransferKind, TransactionType } from "@/lib/domain";

export function toSignedTransactionAmount(
  transactionType: Exclude<TransactionType, "transfer_component">,
  amount: number,
) {
  return transactionType === "expense" ? -Math.abs(amount) : Math.abs(amount);
}

export function deriveTransferKind(
  sourceCurrencyId: string,
  destinationCurrencyId: string,
): TransferKind {
  return sourceCurrencyId === destinationCurrencyId
    ? "same_currency"
    : "cross_currency";
}

export function computeReconciliationDifference(
  statementBalance: number,
  computedBalance: number,
) {
  return statementBalance - computedBalance;
}

export function determineReconciliationStatus(
  differenceAmount: number,
  applyAdjustment: boolean,
) {
  if (differenceAmount === 0) {
    return "matched" as const;
  }

  return applyAdjustment ? ("adjusted" as const) : ("mismatch_reviewed" as const);
}
