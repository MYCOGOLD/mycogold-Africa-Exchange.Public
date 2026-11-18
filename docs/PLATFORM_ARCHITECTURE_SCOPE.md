# MycoGold Africa — Intelligent Platform Scope and Build Blueprint

**Status:** product and engineering scope  
**Updated:** 18 November 2026  
**Purpose:** define the full product boundary for MycoGold Africa before expanding the current listings and order-request application into a connected agricultural operating platform.

## Product direction

MycoGold Africa is intended to become an intelligent operating platform for agricultural trade: it should help people discover supply, understand prices, coordinate handling and delivery, keep accurate financial records, and make better decisions from trustworthy evidence.

“Superintelligence” is a long-term aspiration, not a claim about the current application. The current TUSK experience is explainable analysis of marketplace listings. It has no external AI model connection, verified market feed, sensor network, payment settlement, or deployed production ledger. Build intelligence in proportion to evidence quality and operational readiness.

## Architecture principles

1. **One business truth per domain.** Listings, verified trades, sensor readings, inventory, delivery events, ledger entries, and payment-provider events have different meanings and must not be substituted for one another.
2. **Modular first.** Keep the initial product as a modular application over the existing Next.js and Supabase stack. Give each domain clear code, table, permission, and API boundaries. Add separate workers or services only when operational load justifies them.
3. **Transactional records stay authoritative.** Postgres transactions own order state and double-entry journal posting. AI output, browser state, webhooks, and sensor messages are inputs to controlled domain workflows, not authoritative financial balances.
4. **Every amount has an asset, unit, and source.** KES, MCG, produce quantities, grades, and sensor measurements stay distinct. Store units and conversion rules explicitly; never infer KES from MCG or kilograms from an unspecified quantity.
5. **Advice is explainable and reversible.** TUSK recommendations show their evidence, assumptions, freshness, and confidence. Automated actions remain low impact until they are measured and approved.
6. **Fail closed around money and identity.** Payments, escrow releases, payouts, staff actions, and ledger corrections require server-side authorization, idempotency, audit records, and tested recovery paths.
7. **Design for intermittent connectivity.** Hubs, devices, field operators, drivers, and traders need safe retries, local capture where appropriate, and server-side deduplication when they reconnect.

## Scope by domain

### CORE — central platform architecture and business rules

- Own identities as application principals, seller/buyer/staff roles, profiles, listings, order requests, and shared product/location references.
- Make the order-request lifecycle explicit: request, seller response, cancellation, fulfillment, completion, dispute, and closure. An accepted request is not a paid or completed sale.
- Keep product, grade, package, quantity, unit, price, currency, pickup/delivery terms, and lifecycle timestamps on a versioned order snapshot so later catalogue edits cannot rewrite agreed terms.
- Use shared contracts for domain IDs, time, actor, correlation ID, source event, and idempotency key. Keep domain-specific rules inside their owning modules.

### MFPI — market intelligence, pricing methodology, and index integrity

- Separate seller asking prices, hub quotes, verified completed trades, and official external market observations.
- Every observation records product/category, grade, market/location, unit, currency, quantity, timestamp, source, verifier, and evidence status.
- Define the index formula, base period, weighting, outlier treatment, minimum sample, category coverage, and publication schedule as versioned methodology. Do not label a weighted asking price as MFPI or a verified transaction price.
- Store Nairobi business dates explicitly for publication while retaining UTC timestamps. Display a clear unpublished/stale/unavailable state instead of filling gaps with synthetic values.
- Publish immutable daily snapshots with methodology version and source counts. A correction creates a superseding snapshot with an audit explanation.

### MCG / MYCG — internal ledger, accounting, issuance, and reward governance

- Confirm the product meaning and approved naming of MCG versus MYCG before exposing conversion, redemption, or monetary claims. Until then they remain an accounting/reward unit with no implied KES value.
- Maintain an append-only double-entry journal with immutable accounts, transactions, and entries; per-asset balancing; unique source-event idempotency; actor/provenance; and reversing entries instead of edits or deletes.
- Keep KES journals and MCG journals separate. A conversion, sale, fee, reward, or redemption is an explicit multi-leg business event with approved exchange and accounting rules—not a numeric conversion hidden in application code.
- Govern issuance through a versioned reward policy, eligible source events, per-user/global caps, approval authority, supply reconciliation, and independently auditable totals.
- Expose balances as derived ledger views, never browser-writable profile columns or client-calculated wallet totals.

### ESCROW — secure transaction lifecycle, payment verification, disputes, and settlement

- Model payment intent, provider collection, confirmed funds, escrow custody, release eligibility, payout, refund, reversal, timeout, and dispute as separate states.
- Verify Daraja callback authenticity and match merchant/request references, amount, currency, payer, order, and provider receipt before recording a confirmed collection. Store raw callback evidence under restricted access and make processing idempotent.
- Release only after the agreed delivery/acceptance conditions and dispute window. Refunds and reversals create new auditable financial events.
- Require actual B2C execution and verified result callbacks for payouts; reconcile provider statements, escrow liabilities, and ledger control accounts.
- Keep STK, escrow release, and B2C payouts disabled until test credentials, callback validation, settlement execution, replay/duplicate tests, dispute handling, daily reconciliation, alerts, access separation, support procedures, and a controlled pilot are approved.

### TUSK — intelligence engine and decision support

- Provide grounded answers and recommendations over approved listings, verified trades, hub inventory, logistics status, and sensor evidence; each source must be labeled and freshness checked.
- Return structured recommendations with evidence references, assumptions, confidence, unknowns, and an explanation. When evidence is insufficient, say so and request more information.
- Keep an advisory mode separate from an action mode. Any future action tool must have explicit authorization, policy checks, idempotency, limits, audit logging, and human approval for payments, credit, disputes, moderation, and ledger changes.
- Defend retrieval and tool use against prompt injection in listings, messages, documents, and sensor metadata. Remove private fields before model context and never expose secrets or cross-user data.
- Record model/version, prompt and policy version, retrieved evidence IDs, recommendation, user decision, and outcome for evaluation without storing unnecessary personal content.

### IoT — sensor infrastructure, cold-chain monitoring, environmental data, and traceability

- Register devices, owners, firmware, calibration status, location, sensor type, units, and validity interval. Authenticate devices and sign or otherwise integrity-protect telemetry.
- Ingest timestamped temperature, humidity, location, storage, and environmental observations with device identity, sequence number, quality flags, and deduplication key.
- Detect missing, delayed, implausible, out-of-range, and tampered readings. Keep raw measurements immutable; derived summaries and alerts point back to raw evidence and rule versions.
- Link sensor observations to a produce lot, hub, storage interval, or shipment only through an auditable custody association. A sensor alert can trigger inspection; it cannot by itself release payment or reject a supplier.
- Pilot a small number of calibrated devices and cold-chain routes before building broad hardware support.

### HUBS — collection points, warehouses, aggregation, and distribution

- Represent hubs, operating hours, capacity, equipment, services, storage zones, staff, and permission boundaries.
- Track produce lots from intake through weighing, grading, acceptance/rejection, storage, aggregation, dispatch, shrinkage, and reconciliation. Keep inventory movements append-only with actor, reason, time, unit, and lot.
- Preserve supplier and lot provenance when aggregating orders. Record split/merge operations so downstream delivery and quality events can be traced back to sources.
- Measure throughput, utilization, losses, handling time, quality outcomes, and cost per unit before expanding facilities.

### LOGISTICS — transport, fulfillment, delivery verification, and supply-chain coordination

- Model shipments, stops, routes, vehicle/driver assignment, dispatch, custody handoffs, proof of pickup, proof of delivery, exceptions, returns, and loss/damage claims.
- Use a delivery proof that is appropriate to the risk (for example, recipient confirmation plus order/lot reference); protect location and contact data and expire access when no longer needed.
- Support retry-safe mobile workflows and offline capture with server validation, event ordering, idempotency, and conflict handling on sync.
- Track on-time rate, fulfillment rate, cost per drop, failed delivery, spoilage, return rate, and dispute rate per route and product.

### SECURITY — identity, permissions, cybersecurity, auditability, and fraud prevention

- Enforce least privilege with Supabase RLS on exposed tables; keep privileged schemas and storage objects inaccessible to browser roles. Public listings use approved columns only.
- Authorize staff from trusted server-managed identities/claims. Never trust user-editable metadata, submitted roles, client-side checks, or broad staff tables without enforced policy.
- Keep service keys server-only, rotate credentials, scope access by environment, and redact secrets and personal data from logs and support exports.
- Audit privileged reads and writes, policy changes, financial actions, staff approvals, model tool calls, and device enrollment. Logs must be tamper resistant and access limited.
- Add abuse controls, rate limits, device/session protections, dependency and workflow pinning, alerting, incident response, backup/restore drills, and periodic access reviews.

### DATA & AI — evidence-based analytics, quality, model governance, and automation

- Publish versioned data contracts and source lineage for each analytical dataset. Define valid units, required fields, null behavior, retention, access, and quality checks.
- Separate raw, validated, derived, and published datasets. Record transformations, model versions, feature definitions, and evaluation results.
- Monitor freshness, completeness, duplication, outliers, drift, coverage, and performance by region, product, language, and participant group.
- Evaluate models against grounded tasks and adverse cases. Require human review for consequential outputs and provide a safe fallback when data or model services are unavailable.
- Minimize personal data, document retention and consent, and provide deletion or correction flows where legally and operationally appropriate without mutating immutable accounting evidence.

### FINANCIAL GOVERNANCE — commissions, fees, reconciliation, accounting, and financial controls

- Approve a chart of accounts, ownership of customer/provider funds, revenue recognition, liabilities, fee timing, tax treatment, and month-end close with a qualified finance owner.
- Version commission and fee schedules. Snapshot the applied policy on each order and journal posting; a later fee update cannot change an existing transaction.
- Reconcile order obligations, payment provider collections, escrow/payout statements, refunds, hub cash/stock controls, and ledger balances on a defined schedule. Route exceptions to named owners and prevent silent write-offs.
- Separate duties for policy creation, approval, execution, reconciliation, and correction. Require limits, dual approval, evidence, and reversals for material adjustments.
- Report revenue, payable amounts, fees, refunds, escrow liabilities, unsettled funds, inventory value, and MCG issuance as separate measures with explicit currency/asset labels.

## Target technical shape

```text
Web / mobile field clients
        │ authenticated, versioned APIs
        ▼
Next.js application modules ─── TUSK orchestration and approved tools
        │                              │
        ├── Supabase Auth + RLS        └── governed retrieval/analytics
        ├── Postgres domain tables
        ├── append-only event/outbox records → idempotent workers
        ├── Storage for validated media/evidence
        └── audit and operational telemetry
                  │
     Daraja / IoT devices / hub and logistics operators
```

Start with domain modules and schemas inside the existing Supabase project, with strict grants and RLS. Use an outbox plus retry-safe workers for integrations that cannot run inside a short database transaction. External callbacks and sensor messages enter through narrow authenticated endpoints, are validated, recorded once, and then advance a state machine. Do not introduce a broker, vector database, microservice fleet, or blockchain until a specific measured requirement justifies its operational cost.

## Recommended implementation sequence

### Phase 0 — production foundation

Resolve the canonical Vercel project/domain, restore GitHub runner capacity, require successful CI, verify backups with an isolated restore, address Storage/public-column/function/staff-policy findings, and document release/incident ownership.

### Phase 1 — CORE and trustworthy marketplace evidence

Finalize order and product/unit rules, public listing projection, verification and moderation, lot/grade fields, and lifecycle audit events. Measure request-to-fulfillment outcomes without moving funds.

### Phase 2 — MFPI and TUSK decision support

Align the live index calculator and UI with an approved formula and data contract. Keep asking-price comparisons distinct. Add explanation, confidence, freshness, and evaluation feedback to TUSK; do not forecast from absent or synthetic data.

### Phase 3 — HUBS and LOGISTICS pilot

Pilot one or two collection/storage/transport flows with lot custody, quality checks, delivery proof, exception handling, and unit economics. Expand only after service and contribution targets are met.

### Phase 4 — MCG/MYCG ledger and financial governance

Validate the ledger in an isolated database, approve account ownership and reward issuance rules, run balanced/idempotency/reversal/reconciliation tests, and execute a controlled parallel close before production posting. Keep KES and MCG completely separate.

### Phase 5 — IoT evidence pilot

Enroll calibrated devices on selected storage/transport paths. Validate device identity, readings, outage behavior, chain-of-custody association, alert thresholds, and data retention before using sensor output in quality decisions.

### Phase 6 — ESCROW and payment settlement

Only after backup/restore, ledger, business/legal terms, callback and payout execution, dispute/refund processes, reconciliations, fraud controls, monitoring, and human operations are tested and approved. Start with a low-value limited pilot and explicit stop conditions.

### Phase 7 — governed automation

Increase TUSK tool access gradually from read-only analysis to reversible low-impact workflow assistance. Keep financial, legal, safety, identity, and rights-impacting decisions under named human approval unless a separately approved policy and monitoring framework permits a narrow automation.

## Release gates and unresolved decisions

- Confirm the legal/business meaning and governance of MCG versus MYCG, including whether either can ever be redeemed or exchanged.
- Approve the MFPI formula, categories, global versus per-category publication, sample threshold, base period, and correction process.
- Decide who owns customer funds and escrow liabilities, which provider/payout paths are authorized, and who resolves disputes.
- Define product grades, package and unit standards, quality acceptance, returns, delivery responsibility, and hub inventory ownership.
- Select privacy, data retention, sensor consent, location collection, and AI data-use policies.
- Set financial approval limits, dual-control roles, reconciliation frequency, backup RPO/RTO, and an incident commander.
- Verify live schema and restore capability before any production migration. This scope document does not authorize data-destructive changes, payment activation, escrow release, MCG redemption, or payout execution.

## Definition of “production-ready” by domain

A domain is ready only when its source-of-truth records, authorization model, idempotency/retry semantics, failure states, audit trail, monitoring, support owner, recovery procedure, user-facing status, and tested acceptance cases are documented and exercised in an isolated environment. A successful frontend build alone does not make a financial, logistics, IoT, or AI workflow production-ready.

