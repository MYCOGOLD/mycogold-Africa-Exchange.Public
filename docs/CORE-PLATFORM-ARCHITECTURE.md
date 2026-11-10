# MycoGold Core Platform Architecture
Date: 2026-11-10
Status: implementation baseline; reward issuance, MFPI publication and payment settlement remain disabled pending tests and compliance review.

## Product boundary


The Virtual Asset Service Providers Act, 2025 commenced on 4 November 2025. Its implementing Virtual Asset Service Providers Regulations, 2026 were published as Legal Notice No. 134 of 2026 and are in force from 22 July 2026. Do not use older documentation that describes the 2026 Regulations as only a draft.

The Act has a specific closed-ecosystem exclusion and separately defines virtual service tokens. The exclusion is conditional, not a branding choice: the relevant digital value/rights must stay within the issuer's closed ecosystem, be non-transferable outside it, not be traded onward or sold on an outside secondary market, not be exchanged for fiat or virtual assets, and not function as payment or investment. The Act's wording also restricts exchange for real-world goods, services or discounts. Its virtual-service-token definition focuses on a non-transferable token whose sole function is access to or use of a service.

Product design constraint for the first release:
- Keep MycoGold Reward Points off-chain, account-based and non-transferable; never create public blockchain addresses, private keys, external transfers, bridges, exchange markets, cash-out or a public ticker.
- Do not allow points to pay for produce, replace KES consideration, reduce real-world produce prices, buy real-world goods, or be redeemed for external goods/services/discounts.
- Limit any eventual utility to platform-only functionality, and only after Kenyan counsel confirms that the exact design and operation fit the relevant statutory treatment.
- Do not represent the 67m cap or Bitcoin-inspired halving schedule as making the programme a cryptocurrency or as a regulatory exemption. Economic design and actual use determine classification.
- If the business needs transferable assets, token trading, external redemption, custody of virtual assets, crypto settlement or a token offering, stop the product launch path and obtain advice on the applicable CBK/CMA licensing and approvals first.

The Act's First Schedule assigns custodial virtual-asset wallet services and virtual-asset payment processing to CBK, and virtual-asset exchanges, trading/clearing/settlement platforms, offering providers and token issuance/tokenisation activities to CMA. A MycoGold database wallet reference is therefore deliberately not a crypto wallet. A fiat payment/escrow relationship must use an appropriately authorised payment/escrow partner under its approved arrangement; this architecture does not itself establish authority to safeguard customer funds.

Legal sources to review before launch: Kenya Law's Virtual Asset Service Providers Act, 2025 (especially sections 2, 4, 8, 34 and the First Schedule) and the final 2026 Regulations / Legal Notice 134 of 2026. This section is an engineering risk control, not a legal opinion or a regulator determination.


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


## MFPI agricultural performance watchlist

MFPI is intended to become a longitudinal agricultural market-performance watchlist for growers, buyers, banks, SACCOs, cooperatives, agribusinesses and public-interest researchers. It is a MycoGold platform benchmark, not an official Government of Kenya statistic, a credit rating, investment advice or a guaranteed forecast.

The watchlist should show separate, interpretable measures rather than collapse every agricultural signal into one unexplained number:

- Commodity and grade price index by market hub/county, calculated from verified settled trades.
- Settled volume index and number of eligible transactions.
- Month-on-month and year-on-year movement, where historical coverage permits.
- Price dispersion/volatility and seasonal patterns.
- Supply signals: active verified sellers, listed volume and listing age, clearly labelled as platform listings rather than completed sales.
- Fulfilment and delivery performance, based only on independently verified completed orders.
- Data freshness, sample size, geographic coverage, standard unit, grade, outlier treatment and methodology version.

Methodology:
1. Keep a separate price series for each commodity × grade × hub × standard unit. Never blend incompatible grades, units or markets.
2. Use only independently verified completed and externally settled trade observations for the published price index. Exclude asking prices, requested orders, cancelled orders, simulated data and reward-only events.
3. Publish a base-period index (for example, base = 100) and document the basket/weighting, rebasing, chain-linking, seasonal treatment and revision rules. Do not introduce a single national composite until commodity and regional coverage are statistically defensible.
4. Publish suppression flags when sample count, trade volume, freshness or market coverage falls below the published threshold. Do not infer national agriculture performance from a thin MycoGold-only sample.
5. Preserve revisions and corrections as versioned snapshots with source hashes and an explanation; never silently rewrite previously published observations.
6. Clearly distinguish a platform-market indicator from official statistics and from a forecast. Report price levels, traded quantity and volatility together: rising prices alone do not mean agriculture is performing better.

Institutional API products:

- `GET /v1/mfpi/watchlist` — list available commodity/hub watchlist series and latest valid snapshot metadata.
- `GET /v1/mfpi/series/{commodity}/{hub}` — time series with grade, standard unit, as-of time, index value, sample count, volume and methodology version.
- `GET /v1/mfpi/metadata` — definitions, coverage, thresholds, methodology and data-quality notes.
- Optional later endpoints for platform supply/fulfilment indicators must identify them as MycoGold platform observations, not a census of Kenyan agriculture.

Institution access controls:
- Give each institution its own registered client identity and approved contract, OAuth 2.0 client-credentials access, scopes, rate limits, key rotation, expiration and audit trail. Support mTLS/IP restrictions for higher-trust integrations where feasible.
- Keep aggregate MFPI scopes separate from personal credit-activity scopes. An institution with `mfpi:read` must not gain access to member data.
- Publish aggregate MFPI only when re-identification risk is acceptably low; suppress small cells and sensitive granular locations where necessary.
- Use versioned schemas, idempotent pagination, rate-limit headers, request IDs, status endpoints and explicit service-level/data-quality commitments.
- Never issue a generic shared API key to all banks or SACCOs. Suspend and rotate access when an institution's agreement or authorisation expires.

## Bank and SACCO credit-readiness data pathway

The future goal is to help a verified farmer or trader demonstrate real exchange performance to a bank, SACCO or other appropriately authorised lender. The lender—not TUSK, a reward algorithm or an MFPI number—makes the credit decision and advances the loan under its own mandate, affordability checks, policies and regulatory obligations.

Product model:
1. The member chooses a named participating bank/SACCO and starts a loan-readiness data request.
2. MycoGold presents a plain-language, purpose-specific disclosure showing the exact data categories, institution, purpose, duration, fields, retention, and withdrawal/contact route.
3. The member gives a recorded affirmative consent. The grant is institution-specific, purpose-specific, time-limited, revocable for future access and separately auditable.
4. The API shares only verified facts needed for the stated purpose, such as settled sales turnover, number of completed settled trades, delivery/fulfilment history, active trading months, dispute/reversal counts and the period covered. Each fact carries source, freshness and verification status.
5. The lender independently evaluates the application and communicates its own decision, terms, interest, fees, security and appeal/review process directly to the member.
6. MycoGold records the consent, disclosure, access, corrections and revocation. A lender must not continue accessing new personal data after revocation, subject to any lawful retention duties.

Do not create a black-box "TUSK credit score" or treat reward-point balances, MFPI movements, listing counts or self-reported activity as creditworthiness. Provide factual activity statements with coverage and limitations; do not recommend an amount, approve/decline a loan or promise eligibility. Lenders must consider income variability, seasonality, affordability, existing liabilities and context not held by MycoGold. Avoid discriminatory proxy variables and provide a human review path for adverse decisions.

Data protection and credit-information boundary:
- Establish the lawful basis, data-controller/processor roles, data-sharing agreement, retention/deletion rules, security safeguards and privacy impact assessment before any personal-data API goes live.
- Get explicit, informed, granular consent for personal information sharing where consent is the chosen lawful basis. Support access, correction, objection and withdrawal flows; show the member who accessed their data and when.
- Separate anonymised/aggregated MFPI APIs from identifiable member-level credit evidence.
- The credit-activity endpoint is a private lender-to-member-authorised information service, not a credit bureau report. Do not submit information to a licensed Credit Reference Bureau or market MycoGold as a CRB/third-party credit information provider unless the required CBK/bureau approval, due diligence, agreements, consent, accuracy controls and dispute processes have been obtained.
- Never publish negative or disputed information as a settled adverse fact. Preserve a correction/dispute workflow and mark incomplete, estimated or contested records clearly.
- Do not share member-level records with all API clients, other SACCOS or banks merely because they are registered.

Illustrative later scopes:
- `mfpi:read` — aggregate watchlist and historical index.
- `platform:aggregate-read` — non-identifying marketplace aggregates.
- `member:activity-read` — one member's narrowly scoped exchange-activity statement, only with active consent naming the institution and purpose.
- `member:consent-status` — verify the status and expiry of a particular member grant; never a directory of members or consent grants.

MycoGold must not itself originate, fund, underwrite or service loans as part of this feature unless the company separately obtains all required licences/approvals and implements the corresponding consumer-protection, capital, AML/CFT, complaints and credit-information controls. The initial release is a data and referral/consent layer for authorised lenders, not a lender. Do not submit data to a CRB unless MycoGold has the relevant approval as a third-party credit information provider and meets the Bureau Regulations.


## Verified Activity Ledger and cryptography

Use a server-authoritative, append-only event ledger. Every event must identify its source record, activity type, actor, verifier, verification time, rule version and a SHA-256 digest of the evidence bundle. Store only the digest and minimum metadata needed for audit; keep personal or sensitive evidence in access-controlled storage.

For tamper evidence, chain ledger batches in sequence: each batch stores the previous batch hash and a SHA-256 hash of a canonical, versioned payload. PostgreSQL pgcrypto is installed in the current Supabase project. Serialize chain-head updates inside a database transaction and make event keys idempotent.

A hash chain is tamper-evident, not a decentralized blockchain and not proof that the underlying evidence is true. Restrict inserts to trusted server functions, deny browser update/delete, use compensating reversal events rather than editing history, and periodically export signed checkpoints to a separately controlled audit location. Keep signing keys outside the database.

TUSK must never be the verifier. Verification must come from explicit staff review or independently authenticated workflow evidence (for example, both sides' fulfilment confirmation plus a valid payment-provider settlement reference).

## 67,000,000 reward-point protocol

Working product name: MycoGold Reward Points. Do not create a public ticker or describe these points as a cryptocurrency.

- Hard maximum: 67,000,000 whole reward points.
- Earn-only during the initial release; non-transferable between users and not purchasable.
- No cash-out, external wallet withdrawal, exchange listing, payment for produce, purchase of real-world goods, real-world discounts, external redemption, interest, staking, investment return, deposit, collateral use or promise of monetary value.
- Any future rewards utility must be limited to platform-only functionality and independently reviewed against the current Kenyan Act; do not use points as a substitute for KES or a means to buy the produce listed on the exchange.
- Use Proof of Verified Exchange Work (PoVEW): a platform-defined, evidence-backed work/reliability mechanism in which reward eligibility comes from independently verified exchange work—not CPU/GPU hash puzzles. It borrows the scarcity/cap/halving schedule idea from Bitcoin but is not Bitcoin mining, not a consensus protocol and not a security mechanism for a decentralised blockchain.
- Eligible work can include a fully fulfilled and settled produce order, independently confirmed delivery/quality checks, validated logistics milestones, or an accepted market observation that passes quality and duplicate checks. Merely signing up, clicking, listing, generating an AI chat, self-trading, paying a fee or submitting an unverified claim earns nothing.
- A work event becomes eligible only after the required counterparties/provider evidence and independent verifier checks pass. Bind each event to its source order/settlement, user role, verifier, time, evidence digest and rule version. TUSK output is never proof.
- Calculate points from a published activity-weight schedule, quality/reliability multipliers and the current four-year era multiplier. Keep exact weights configurable and unpublished until approved; enforce per-event/user caps, anti-collusion and wash-trade detection, and review holds. The system must be deterministic and independently reproducible.
- Keep a separate Proof-of-Verified-Work record and a separate reward ledger. Work evidence establishes eligibility; the reward ledger records the resulting points. A reversal corrects points through a compensating entry and never erases the original work or reward history.
- Bitcoin-inspired scarcity mechanics only: a transparent hard cap and a 50% reduction in the maximum reward rate per eligible verified activity every four-year reward era, measured from a published genesis date. This is not Bitcoin, proof-of-work mining, a decentralised consensus network or a public cryptocurrency. The exact per-activity reward schedule and genesis date must be approved and published before issuance is enabled.
- No presale, premine, private allocation or speculative distribution. Unissued points remain unissued; the protocol must never exceed the cap.
- Use append-only credit and compensating debit entries. Do not store a user-editable wallet balance. Calculate balances from the ledger or maintain a transactionally updated cache that can be rebuilt from it.
- Each reward must have a unique idempotency key tied to one verified source event and rule version. Apply per-event and per-user limits, anti-self-dealing checks, related-account review, dispute holds and a transparent reversal process. Rewards must not be used as the lender's sole or primary proxy for creditworthiness.
- The wallet is an internal account with a random opaque wallet reference. It is not a blockchain address and has no user-held private key. Cryptographic integrity is provided by the server-side ledger, not by exposing key material to customers.
- If points later become transferable, redeemable for cash, exchangeable for produce/real-world goods or discounts, purchasable, exchangeable for virtual assets, or usable outside the closed platform, stop and obtain a new Kenyan regulatory assessment before enabling that change.

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
2. Verified Activity Ledger and PoVEW: append-only controls, independent verification, cryptographic hash chaining, idempotency, anti-collusion controls and test fixtures — initially with issuance disabled.
3. Define and test MFPI observations, base period, weighting, quality thresholds and watchlist. Publish only after qualifying settled trade data exists.
4. Add institution API client registration, aggregate MFPI scopes, consent and access audit. Pilot the anonymous/aggregate MFPI API before any member-level data sharing.
5. Add member-authorised credit-activity statements for partner banks/SACCOs; complete privacy impact review, agreements, consent, dispute/correction workflow and lender validation. Keep MycoGold outside loan underwriting and CRB reporting unless separately approved.
6. Configure the 67m reward protocol, genesis, verified-work weights and anti-fraud rules; test halving, reversals and cap enforcement. Keep issuance disabled until legal and independent technical review.
7. Select payment/escrow partner and obtain legal/compliance approval; implement provider callbacks and reconciliation in a sandbox before any live funds.
8. Run independent security review, RLS/API-scope tests, fraud tests, load tests, backup/restore tests and a staged pilot before production release.

## Decisions intentionally left unset

- Reward genesis date and launch date.
- Reward points awarded per eligible activity and the four-year era start.
- Whether any platform-only utility for points is legally permissible under the closed-ecosystem / virtual-service-token rules; no real-world goods, produce or discounts are in scope for the initial design.
- Final MFPI base period, thresholds, commodities, grades, standard units, composite weighting and market coverage.
- Institution API partner approval, data-sharing contract templates, scopes, client credential lifecycle and member-consent wording.
- Activity metrics lenders may request, retention periods, and whether a separate CRB third-party information-provider approval is sought.
- PoVEW activity classes, work verification criteria, activity weights, reliability multipliers, reward era genesis date and maximum reward rate.
- Payment/escrow provider and the legal structure for safeguarding customer funds.

Do not guess these values or enable issuance/settlement until the decisions are approved.
