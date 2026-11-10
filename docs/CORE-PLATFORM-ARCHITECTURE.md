# MycoGold Core Platform Architecture
Date: 2026-11-10
Status: implementation baseline; reward issuance, MFPI publication and payment settlement remain disabled pending tests and compliance review.

## Product boundary

MycoGold is a produce marketplace with an agricultural information assistant and an internal, closed-loop loyalty programme. The following systems must remain separate:

1. TUSK AI — read-only agricultural guidance and retrieval from approved MycoGold data.
2. MFPI — a market statistic calculated only from verified, completed and settled trade observations.
3. Verified Activity Ledger — append-only evidence that a defined activity passed human or trusted-system checks.
4. Rewards Wallet — an internal account for non-transferable platform reward points.
5. Escrow/Settlement — a payment-provider workflow. MycoGold must not hold customer money in a database balance or call an order request an escrow payment.

The current order workflow is deliberately non-payment: a buyer can request a quantity, and a seller can accept or reject. It does not collect payment, settle a sale or provide escrow. Preserve that boundary until a regulated payment partner and the full callback/reconciliation lifecycle are ready.

## TUSK AI

- Use the OpenAI Responses API from a server route only.
- Keep OPENAI_API_KEY and the Supabase service/secret key in server-only deployment variables. Never use a NEXT_PUBLIC_ prefix.
- Authenticate the user with Supabase Auth before a model call; limit message size, output tokens and per-user request rate.
- Retrieve only the minimum approved marketplace facts needed for the question. Do not send seller phone numbers, private profile data, auth metadata, payment data or private moderation notes to the model.
- Treat database content as untrusted input. TUSK is advisory and read-only; it must never approve listings, verify activity, mint/reverse rewards, transfer points, change wallet balances, initiate payment or release escrow.
- Show data provenance and freshness. Clearly distinguish a seller asking price from a completed-sale observation and an unpublished index from a live MFPI.
- Start with retrieval-grounded answers, not model fine-tuning. Training/fine-tuning should be considered only after MycoGold has a curated, permissioned, quality-labelled dataset and a privacy/data-retention review. Model output is not evidence that an activity happened.

## MFPI methodology

MFPI must remain unpublished until there are enough real, independently verified and settled trade records. The current database has no completed trades or active listings; an asking-price average is not an MFPI.

Proposed publication rules:

1. Include only completed, settled transactions with auditable provider/order references and verified product, market, quantity, grade and unit.
2. Normalize quantities and prices to a documented standard unit for each commodity. Never combine different grades or incompatible units.
3. Calculate a robust market statistic per commodity and hub (a volume-weighted median or a documented trimmed weighted mean). Cap any one transaction's influence so a single large trade cannot dominate the index.
4. Apply a published recency window and outlier rules. Preserve raw observations and methodology version; never silently overwrite historical values.
5. Publish each value with as-of time, sample count, aggregate eligible quantity, hub coverage, grade/unit, dispersion/confidence indicator and methodology version.
6. Suppress publication when sample count, recency or coverage thresholds are not met. TUSK may explain the methodology but cannot fabricate a value or fill missing observations.

## Verified Activity Ledger and cryptography

Use a server-authoritative, append-only event ledger. Every event must identify its source record, activity type, actor, verifier, verification time, rule version and a SHA-256 digest of the evidence bundle. Store only the digest and minimum metadata needed for audit; keep personal or sensitive evidence in access-controlled storage.

For tamper evidence, chain ledger batches in sequence: each batch stores the previous batch hash and a SHA-256 hash of a canonical, versioned payload. PostgreSQL pgcrypto is installed in the current Supabase project. Serialize chain-head updates inside a database transaction and make event keys idempotent.

A hash chain is tamper-evident, not a decentralized blockchain and not proof that the underlying evidence is true. Restrict inserts to trusted server functions, deny browser update/delete, use compensating reversal events rather than editing history, and periodically export signed checkpoints to a separately controlled audit location. Keep signing keys outside the database.

TUSK must never be the verifier. Verification must come from explicit staff review or independently authenticated workflow evidence (for example, both sides' fulfilment confirmation plus a valid payment-provider settlement reference).

## 67,000,000 reward-point protocol

Working product name: MycoGold Reward Points. Do not create a public ticker or describe these points as a cryptocurrency.

- Hard maximum: 67,000,000 whole reward points.
- Earn-only during the initial release; non-transferable between users and not purchasable.
- No cash-out, external wallet withdrawal, exchange listing, interest, staking, investment return, deposit, collateral use or promise of monetary value.
- No proof-of-work mining. New points are issued only as rewards for eligible, verified platform activities recorded in the Verified Activity Ledger.
- Bitcoin-inspired mechanics: a transparent hard cap and a 50% reduction in the maximum reward rate every four-year reward era, measured from a published genesis date. The exact per-activity reward schedule and genesis date must be approved and published before issuance is enabled.
- No presale, premine, private allocation or speculative distribution. Unissued points remain unissued; the protocol must never exceed the cap.
- Use append-only credit and compensating debit entries. Do not store a user-editable wallet balance. Calculate balances from the ledger or maintain a transactionally updated cache that can be rebuilt from it.
- Each reward must have a unique idempotency key tied to one verified source event and rule version. Apply per-event and per-user limits, anti-self-dealing checks, related-account review, dispute holds and a transparent reversal process.
- The wallet is an internal account with a random opaque wallet reference. It is not a blockchain address and has no user-held private key. Cryptographic integrity is provided by the server-side ledger, not by exposing key material to customers.
- If points later become transferable, redeemable for cash, purchasable, exchangeable or usable outside MycoGold, stop and obtain a new Kenyan regulatory assessment before enabling that change.

## Escrow and payment settlement

Do not create a MycoGold crypto wallet or reward wallet to hold customer funds. Rewards points and Kenyan-shilling settlement are separate ledgers.

Before real payments:
- Select a CBK-authorized payment service provider or properly licensed escrow/trust partner and obtain written confirmation of the permitted marketplace flow.
- The provider, not a MycoGold user-facing points wallet, should receive and safeguard buyer funds under its approved arrangement.
- Implement server-side payment intents, unique provider references, authenticated callback validation, idempotency, payout-result verification, reconciliation, refunds, chargeback/dispute states and staff audit.
- A browser redirect, STK request ID, screenshot or client-side message is not payment proof.
- Release must depend on verified provider settlement and the agreed fulfilment/quality/dispute policy. Require a controlled human review for exceptions.
- Until all gates pass, keep the app clearly labelled: order requests only; no payment or escrow is active.

Suggested future order/payment state flow:
request → seller accepted → payment pending → provider payment confirmed → fulfilment confirmed → payout pending → provider payout confirmed.
Side paths: rejected, buyer cancelled, expired, disputed, refund pending, refunded, payout failed.
Never infer a money state from the existing order status alone.

## Data access and operational security

- Keep exposed tables protected by RLS and least-privilege grants. Browser roles must not write reward events, ledger entries, payment states, protocol settings or MFPI source observations.
- Use server-side secrets only. Service-role and secret keys bypass RLS and must never reach the browser.
- Prefer private schemas for internal functions and state. Any SECURITY DEFINER function must use an empty/locked search_path, fully qualified object names, explicit authorization and revoked default execution grants.
- Maintain immutable audit history, rate limits, request IDs, alerting, tested backups and a documented incident/recovery process.
- Do not store M-Pesa PINs, payment passwords, private keys or raw card credentials.

## Release sequence

1. TUSK read-only API, authentication, per-user rate limiting and server-only OpenAI key.
2. Verified Activity Ledger schema, append-only controls, cryptographic hash chaining, idempotency and test fixtures — initially with issuance disabled.
3. Define and test MFPI observation schema and methodology; publish only after qualifying settlement data exists.
4. Configure the 67m reward protocol, approved genesis date, reward rates and anti-fraud rules; test reversals and cap enforcement. Keep issuance disabled until independently reviewed.
5. Select payment/escrow partner and obtain legal/compliance approval; implement provider callbacks and reconciliation in a sandbox before any live funds.
6. Run independent security review, RLS tests, fraud tests, load tests, backup/restore tests and a staged pilot before production release.

## Decisions intentionally left unset

- Reward genesis date and launch date.
- Reward points awarded per eligible activity and the four-year era start.
- Whether and how points may be redeemed for non-cash MycoGold benefits.
- Final MFPI thresholds, commodities, grades, standard units and market coverage.
- Payment/escrow provider and the legal structure for safeguarding customer funds.

Do not guess these values or enable issuance/settlement until the decisions are approved.
