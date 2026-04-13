import test from "node:test";
import assert from "node:assert/strict";
import {
  computeReconciliationDifference,
  deriveTransferKind,
  determineReconciliationStatus,
  toSignedTransactionAmount,
} from "../src/lib/ledger";

test("expense amounts are stored as negative", () => {
  assert.equal(toSignedTransactionAmount("expense", 42.5), -42.5);
});

test("income and adjustments remain positive", () => {
  assert.equal(toSignedTransactionAmount("income", 42.5), 42.5);
  assert.equal(toSignedTransactionAmount("adjustment", 3), 3);
});

test("transfer kind depends on account currencies", () => {
  assert.equal(deriveTransferKind("usd", "usd"), "same_currency");
  assert.equal(deriveTransferKind("usd", "krw"), "cross_currency");
});

test("reconciliation difference is statement minus computed balance", () => {
  assert.equal(computeReconciliationDifference(120, 100), 20);
  assert.equal(computeReconciliationDifference(95, 100), -5);
});

test("reconciliation status follows mismatch and adjustment rules", () => {
  assert.equal(determineReconciliationStatus(0, false), "matched");
  assert.equal(determineReconciliationStatus(10, false), "mismatch_reviewed");
  assert.equal(determineReconciliationStatus(-10, true), "adjusted");
});
