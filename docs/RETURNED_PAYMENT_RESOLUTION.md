# Returned payments and agent corrections

- Generic bunq card reversals (including currency settlements for subscriptions) do not create unpaid invoices. A recurring-cost classification is not direct-debit evidence.
- Generic bank refunds require review; a credit alone does not prove an outstanding bill. Invoice references can disambiguate originals and repayments.
- `moneylith.personal.paymentResolutions` stores explicit user-confirmed paid/open decisions separately from recurring prices and bank transactions. Open entries can specify a payment month; month-end is an explicit date assumption, and overdue entries remain planned.
- Resolved/deferred reversals are removed from the current-period remainder before an arrear is scheduled separately. Ordinary later monthly costs remain unchanged.
- The agent reads the derived `returnedPayments` index and writes validated resolutions, with existing encrypted compare-and-set persistence and undo receipts. Foreign/business or fabricated targets are rejected.
- A paid confirmation must never zero a recurring price; a one-time arrear must never double the recurring base price. The prompt and server guard enforce this distinction.
- Questions explaining spending room use the shared dashboard calculation, without waiting for the language model. Known line items, reserves and missing-information limitations are stated explicitly.

Validation includes card settlements, reference disambiguation, month deferral, paid confirmation, unconfirmed refunds, undo, isolation, protected price changes and read-only deterministic explanations. Historical refunds still requiring review are not silently treated as debts or as paid.

Automatic return discovery is limited to credits booked in the active salary period (23rd–22nd). Previously user-confirmed resolutions stay available across periods, including open arrears. Matching still uses the full bank history; no transactions are deleted or silently marked paid. Internal action validation can explicitly inspect historical evidence so existing resolutions remain editable. The dashboard, planning, projection, monitoring and agent index use the same default scope.
