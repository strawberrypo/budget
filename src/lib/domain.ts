export type CurrencyCode = "USD" | "KRW" | "EUR" | "JPY";

export type AccountType =
  | "checking"
  | "savings"
  | "cash"
  | "credit"
  | "other";

export type TransactionType =
  | "income"
  | "expense"
  | "adjustment"
  | "transfer_component";

export type TransferKind = "same_currency" | "cross_currency";

export type MembershipRole = "owner" | "member";

export type UserSummary = {
  id: string;
  displayName: string;
};

export type BudgetSummary = {
  id: string;
  name: string;
  reportingCurrencyCode: CurrencyCode | null;
};

export type DashboardSnapshot = {
  user: UserSummary;
  budget: BudgetSummary;
  readyToAssignByCurrency: Array<{
    currencyCode: CurrencyCode;
    amount: string;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    type: AccountType;
    currencyCode: CurrencyCode;
    balance: string;
  }>;
};
