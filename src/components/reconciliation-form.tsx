"use client";

import { useMemo, useState } from "react";
import { reconcileAccount } from "@/app/actions";

type ReconciliationAccount = {
  id: string;
  name: string;
  currencyCode: string;
  computedBalance: string;
};

type ReconciliationFormProps = {
  accounts: ReconciliationAccount[];
  defaultDate: string;
};

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ReconciliationForm({
  accounts,
  defaultDate,
}: ReconciliationFormProps) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [statementBalance, setStatementBalance] = useState("");
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accountId, accounts],
  );

  const computedBalance = Number(selectedAccount?.computedBalance ?? 0);
  const statementBalanceNumber =
    statementBalance.trim() === "" ? null : Number(statementBalance);
  const difference =
    statementBalanceNumber === null ? null : statementBalanceNumber - computedBalance;

  return (
    <form action={reconcileAccount} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">Account</span>
        <select
          name="accountId"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currencyCode})
            </option>
          ))}
        </select>
      </label>
      {selectedAccount ? (
        <div className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm text-ink/70">
          Current computed balance:{" "}
          {formatMoney(computedBalance, selectedAccount.currencyCode)}
        </div>
      ) : null}
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">Statement date</span>
        <input
          required
          type="date"
          name="statementDate"
          defaultValue={defaultDate}
          className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">Statement balance</span>
        <input
          required
          type="number"
          step="0.01"
          name="statementBalance"
          value={statementBalance}
          onChange={(event) => setStatementBalance(event.target.value)}
          className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
        />
      </label>
      {selectedAccount && difference !== null ? (
        <div className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm text-ink/70">
          Difference preview: {formatMoney(difference, selectedAccount.currencyCode)}
        </div>
      ) : null}
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">If mismatched</span>
        <select
          name="applyAdjustment"
          defaultValue="no"
          className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
        >
          <option value="no">Record review only</option>
          <option value="yes">Create explicit adjustment</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">Notes</span>
        <input
          name="memo"
          className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-moss"
      >
        Save reconciliation
      </button>
    </form>
  );
}
