# Held migrations

`20261113120000_add_mpesa_stk_and_escrow.sql` is deliberately stored outside
`supabase/migrations` so routine migration pushes cannot activate payment or
escrow schema. It must remain held until the M-Pesa callback, payout execution,
ledger posting, idempotency, reconciliation and operational controls have been
implemented and independently tested, and the user explicitly approves
activation.
