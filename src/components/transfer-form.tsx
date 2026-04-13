"use client";

import { useEffect, useMemo, useState } from "react";
import { createTransfer } from "@/app/actions";

type TransferAccount = {
  id: string;
  name: string;
  currencyCode: string;
};

type TransferFormProps = {
  accounts: TransferAccount[];
  defaultDate: string;
};

export function TransferForm({ accounts, defaultDate }: TransferFormProps) {
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    accounts[1]?.id ?? accounts[0]?.id ?? "",
  );
  const [sourceAmount, setSourceAmount] = useState("");
  const [destinationAmount, setDestinationAmount] = useState("");

  const sourceAccount = useMemo(
    () => accounts.find((account) => account.id === sourceAccountId) ?? null,
    [accounts, sourceAccountId],
  );
  const destinationAccount = useMemo(
    () => accounts.find((account) => account.id === destinationAccountId) ?? null,
    [accounts, destinationAccountId],
  );

  const isSameAccount = sourceAccountId !== "" && sourceAccountId === destinationAccountId;
  const isSameCurrency =
    !!sourceAccount &&
    !!destinationAccount &&
    sourceAccount.currencyCode === destinationAccount.currencyCode;

  useEffect(() => {
    if (isSameCurrency) {
      setDestinationAmount(sourceAmount);
    }
  }, [isSameCurrency, sourceAmount]);

  const mismatchMessage =
    isSameAccount
      ? "Source and destination accounts must differ."
      : isSameCurrency && sourceAmount !== destinationAmount
        ? "Same-currency transfers must keep source and destination amounts equal."
        : null;

  return (
    <form action={createTransfer} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">Source account</span>
        <select
          name="sourceAccountId"
          value={sourceAccountId}
          onChange={(event) => setSourceAccountId(event.target.value)}
          className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currencyCode})
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">Destination account</span>
        <select
          name="destinationAccountId"
          value={destinationAccountId}
          onChange={(event) => setDestinationAccountId(event.target.value)}
          className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currencyCode})
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">Transfer date</span>
        <input
          required
          type="date"
          name="transferDate"
          defaultValue={defaultDate}
          className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Source amount</span>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            name="sourceAmount"
            value={sourceAmount}
            onChange={(event) => setSourceAmount(event.target.value)}
            className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Destination amount</span>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            name="destinationAmount"
            value={destinationAmount}
            onChange={(event) => setDestinationAmount(event.target.value)}
            readOnly={isSameCurrency}
            className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss read-only:bg-stone-100"
          />
        </label>
      </div>
      {sourceAccount && destinationAccount ? (
        <div className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm text-ink/70">
          {isSameCurrency ? (
            <span>
              Same-currency transfer: destination amount is locked to the source amount in{" "}
              {sourceAccount.currencyCode}.
            </span>
          ) : (
            <span>
              Cross-currency transfer: enter the actual amount received in{" "}
              {destinationAccount.currencyCode}.
            </span>
          )}
        </div>
      ) : null}
      {mismatchMessage ? (
        <div className="rounded-2xl border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-clay">
          {mismatchMessage}
        </div>
      ) : null}
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">Memo</span>
        <input
          name="memo"
          className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
        />
      </label>
      <button
        type="submit"
        disabled={!!mismatchMessage}
        className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-moss disabled:cursor-not-allowed disabled:bg-ink/40"
      >
        Save transfer
      </button>
    </form>
  );
}
