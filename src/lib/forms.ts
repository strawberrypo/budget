import { z } from "zod";

export const setupSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  budgetName: z.string().trim().min(1).max(100),
  reportingCurrencyId: z.string().uuid(),
});

export const accountSchema = z.object({
  name: z.string().trim().min(1).max(100),
  accountType: z.enum(["checking", "savings", "cash", "credit", "other"]),
  currencyId: z.string().uuid(),
  openingBalanceAmount: z.coerce.number().finite(),
  openingBalanceDate: z.string().date(),
});

export const accountUpdateSchema = accountSchema.extend({
  accountId: z.string().uuid(),
});

export const accountCloseSchema = z.object({
  accountId: z.string().uuid(),
});

export const categoryGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const categoryGroupUpdateSchema = categoryGroupSchema.extend({
  groupId: z.string().uuid(),
});

export const categoryGroupHideSchema = z.object({
  groupId: z.string().uuid(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  categoryGroupId: z.string().uuid().optional().or(z.literal("")),
  newGroupName: z.string().trim().max(100).optional().or(z.literal("")),
  currencyIds: z.array(z.string().uuid()).min(1),
});

export const categoryUpdateSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  categoryGroupId: z.string().uuid().optional().or(z.literal("")),
});

export const categoryHideSchema = z.object({
  categoryId: z.string().uuid(),
});

export const assignmentSchema = z.object({
  categoryCurrencyBucketId: z.string().uuid(),
  amountDelta: z.coerce.number().finite().refine((value) => value !== 0),
  memo: z.string().trim().max(200).optional().or(z.literal("")),
});

export const assignmentReverseSchema = z.object({
  assignmentEventId: z.string().uuid(),
});

export const transactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryCurrencyBucketId: z.string().uuid().optional().or(z.literal("")),
  transactionDate: z.string().date(),
  amount: z.coerce.number().positive(),
  transactionType: z.enum(["income", "expense", "adjustment"]),
  payeeNameRaw: z.string().trim().max(120).optional().or(z.literal("")),
  memo: z.string().trim().max(200).optional().or(z.literal("")),
});

export const transactionUpdateSchema = transactionSchema.extend({
  transactionId: z.string().uuid(),
});

export const transactionVoidSchema = z.object({
  transactionId: z.string().uuid(),
});

export const transferSchema = z.object({
  sourceAccountId: z.string().uuid(),
  destinationAccountId: z.string().uuid(),
  transferDate: z.string().date(),
  sourceAmount: z.coerce.number().positive(),
  destinationAmount: z.coerce.number().positive(),
  memo: z.string().trim().max(200).optional().or(z.literal("")),
});

export const reconciliationSchema = z.object({
  accountId: z.string().uuid(),
  statementDate: z.string().date(),
  statementBalance: z.coerce.number().finite(),
  applyAdjustment: z.enum(["yes", "no"]).default("no"),
  memo: z.string().trim().max(200).optional().or(z.literal("")),
});
