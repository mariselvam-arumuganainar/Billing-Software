# Product Requirements Document (PRD)

## Product title
Multi-Tenant Billing SaaS for Indian Retail Stores

## Launch client
PSS Store

## Document purpose
This PRD defines the phase 1 requirements for a multi-tenant billing SaaS product intended for Indian retail stores, with PSS Store as the first live client. The platform must provide a single Super Admin account for centralized client control and one fixed client login per tenant in version 1. Scope is intentionally frozen around the first release so the product can launch quickly and evolve based on client feedback, which aligns with good SaaS rollout practice for multi-tenant systems.[cite:2]

## Product overview
The product is a cloud-native SaaS billing platform for retail stores that need fast POS billing, GST-ready invoices, item management, customer rewards, customer credit tracking, expenses, and operational reporting. Version 1 will support both web app and mobile app scope, but the web experience and backend foundations are the primary focus for launch readiness.

The platform must be architected as a reusable multi-tenant system so additional stores can be onboarded later with tenant isolation, fixed credentials, and configurable rules per client. The first tenant, PSS Store, will define the initial feature set and workflow quality bar for future clients.[cite:2]

## Goals
- Launch a usable billing SaaS for PSS Store with strong tenant isolation.
- Enable Super Admin control of all clients, credentials, and feature access.
- Deliver fast retail POS billing with automatic stock deduction.
- Generate GST-compliant invoices and POS bills with PDF download.
- Support customer rewards, customer credit, expenses, and key reports.
- Prepare the platform for future multi-user clients, subscriptions, offline support, and broader mobile rollout.

## Non-goals for phase 1
- No customer self-signup.
- No client self-password reset.
- No integrated online payment gateway.
- No offline-first architecture in version 1.
- No advanced supplier or purchase management unless required later.
- No complete subscription monetization workflow yet.

## Users

### 1. Super Admin
The platform owner or central operations administrator. This user can create and manage clients, define client credentials, control module access, and maintain platform-wide visibility.

### 2. Client user
A store-level user for a single tenant. In phase 1, each client has one fixed mobile/password login only.

### 3. Future user types
Future versions may include cashier, manager, accountant, and branch owner roles under one tenant, but those roles are out of phase 1 scope.

## Platform scope
- Web application: required in phase 1.
- Mobile application: required in product scope and API/UI planning, with mobile-ready architecture and flows from day one.
- Online operation is acceptable for version 1.

## Architecture constraints
The preferred stack is cloud-native microservices using Go and Node.js for backend services, React and Next.js for frontend, PostgreSQL for data storage, Kafka and/or Redis for messaging and caching needs, REST and GraphQL APIs, Docker, Kubernetes, and CI/CD-ready deployment practices.

## Multi-tenant model
The system must use tenant isolation so each client can access only its own records, configurations, invoices, customers, expenses, and reports. Multi-tenant SaaS planning should explicitly define scope, ownership, traffic assumptions, and milestone boundaries early to reduce rework and support smaller measurable releases.[cite:2]

### Tenant rules
- One Super Admin controls all clients.
- Super Admin creates tenant accounts.
- Super Admin defines fixed client login credentials.
- One client login per tenant in phase 1.
- No self-registration.
- No self-password reset.
- Future support for multiple users per client must remain technically feasible.

## Authentication and access
- Login method: mobile number + password.
- Credentials are created and reset only by Super Admin.
- Client users are restricted to their own tenant context.
- Super Admin can manage tenant access and client status.
- Audit trail should exist for credential changes and major administrative actions.

## Functional requirements

## 1. Dashboard
The dashboard must provide a quick operational overview for each client.

### Requirements
- Show total sales summary.
- Show GST snapshot.
- Show expense summary.
- Show payment mode summary.
- Show top-selling items.
- Show credit due summary.
- Show reward points snapshot.
- Show daily and monthly KPI views.

## 2. Configuration
The configuration module must centralize store-level business settings.

### Requirements
- Billing settings.
- GST settings.
- Reward settings.
- Thermal print settings.
- Invoice numbering settings.
- Credit settings.
- Mobile app settings placeholders.
- Feature/module enablement flags where applicable.

## 3. Store information
Each tenant must have a store profile.

### Required fields
- Store name.
- Address.
- GST number.
- Store logo.
- Optional contact information.

## 4. Item master
The item master must support retail-ready product setup and tax defaults.

### Requirements
- Create, edit, archive, and view items.
- Maintain item name, item code/SKU, unit, price, stock quantity, GST rate, and HSN/SAC where applicable.
- Unit options must support gram, kg, litre, piece, and extensible custom units.
- Each item can have a default GST rate, reflecting typical Indian retail workflows where products commonly carry predefined GST classifications.[cite:page:2]
- Billing must auto-apply the default GST from item master while still allowing controlled edits by authorized users.
- Stock must reduce automatically after a successful bill is completed.

## 5. Billing / POS
The billing module is the core workflow and must feel fast, accurate, and retail-friendly.

### Requirements
- Fast item search and add to cart.
- Quantity update and cart editing.
- Customer selection or quick customer registration.
- Automatic price and tax calculation.
- Auto stock deduction on bill completion.
- Payment mode selection: cash, card, UPI, split payment, credit.
- No payment gateway integration in phase 1.
- Payment mode must be stored with each invoice and included in reports and invoice PDF.
- Thermal print support for POS operations.

### Billing logic
- Show subtotal, taxable value, tax breakup, and grand total.
- Show reward points earned.
- Show available reward points.
- Show redemption toggle/checkbox.
- Show final amount after redemption when applied.
- Show normal total when redemption is not applied.

## 6. Invoice details
The system must auto-generate invoice numbers and produce downloadable PDF invoices.

### Requirements
- Generate a unique serial invoice number.
- Support POS bill and tax invoice output.
- Support PDF download.
- Include payment mode in invoice.
- Preserve item lines, units, quantity, rate, taxable value, tax rates, and tax amounts.

### GST invoice compliance baseline
GST invoices in India must capture supplier name, address, GSTIN, consecutive invoice number, date, item description, quantity with unit, taxable value, applicable GST rates, and tax amount breakup, while inter-state invoices also require place of supply details.[page:2] POS bills used by GST-registered businesses are treated as tax invoices and should clearly show GSTIN, serial number, and CGST/SGST breakup, with IGST applicable in inter-state scenarios.[page:1]

## 7. GST management
GST handling is a phase 1 requirement.

### Requirements
- Support CGST, SGST, and IGST.
- Support automated GST defaulting from item master.
- Support editable GST with permission control.
- Support invoice-level and line-level tax storage.
- Support GST summaries in reports.
- Support place-of-supply-aware tax logic.

### GST logic notes
A GST invoice must clearly state the applicable GST rate and show the breakup of CGST, SGST, IGST, UTGST, and cess where relevant under invoice rules.[page:2] In POS billing, CGST and SGST are commonly used for intra-state billing, while IGST applies when the supply is inter-state.[page:1]

## 8. Customer registration
Customer registration is required for rewards and credit workflows.

### Requirements
- Mobile number as primary identifier.
- Customer profile screen.
- Purchase history.
- Reward points balance.
- Credit profile and outstanding amount.
- Optional address and notes.

## 9. Reward points
The reward module must support flexible rule management.

### Reward modes
1. Global rule: 1 point per X rupees, where X is defined by admin.
2. Manual override mode: the system auto-calculates points during billing, but the admin can edit points manually.
3. Client-specific configuration: Super Admin can define different point-per-amount values for each client.

### Redemption rules
- Points must be redeemable during billing.
- Redemption must be controlled by checkbox/toggle.
- UI must show total before and after redemption when applicable.
- Reward ledger must track earn, redeem, adjust, and manual override events.

## 10. Customer credit
Customer credit is in phase 1 scope.

### Requirements
- Credit sale entry.
- Due tracking.
- Repayment history.
- Overdue alerts.
- Credit limit per customer.
- Credit visibility in dashboard and reports.

## 11. Expense management
Expense tracking must be store-ready and reporting-friendly.

### Requirements
- Expense entry.
- Expense categories.
- Bill or attachment upload.
- Approval-friendly structure for future workflow support.
- Daily expense summary.
- Expense reporting.

POS systems are commonly used to capture operating expenses and categorize them for reporting, which helps budgeting and financial visibility.[web:7]

## 12. Reports
Daily and monthly reports are required.

### Required reports
- Sales summary.
- GST summary.
- Item-wise sales.
- Payment mode summary.
- Expense summary.
- Profit estimate.

Accurate POS bill records are important for return filing and audit support, including monthly or quarterly GST filing workflows such as GSTR-1 and GSTR-3B.[page:1]

## 13. Notes
The tenant app must include a simple notepad-like notes option.

## 14. Mobile app
The system must be designed so a mobile app can use the same backend and business rules.

### Mobile scope expectations
- Dashboard snapshots.
- Customer access.
- Report summaries.
- Expense capture.
- Notes.
- Future billing support views depending on UX feasibility.

## Sidebar navigation

### Client sidebar
- Dashboard
- Configuration
- Store Information
- Item Master
- Billing
- Invoice Details
- Customer Registration
- Customer Credit
- Expense Management
- Reports
- GST Management
- Notes

### Super Admin sidebar
- Dashboard
- Client Management
- Client Credentials
- Feature Access Control
- Tenant Configuration
- Activity Logs
- Future Billing Plans

## UX requirements
- Modern SaaS dashboard visual style.
- Desktop-software-like fast billing interface.
- Minimal clicks for billing.
- Clear sidebar navigation.
- Responsive web experience.
- Mobile-aware flows from phase 1.

## Data requirements

### Core entities
- SuperAdmin
- Tenant
- TenantCredential
- StoreProfile
- UserFutureRolePlaceholder
- Item
- InventoryTransaction
- Invoice
- InvoiceLine
- Payment
- Customer
- RewardLedger
- CreditAccount
- CreditTransaction
- Expense
- ExpenseCategory
- Note
- AuditLog
- GSTConfiguration
- RewardConfiguration
- InvoiceSequence

## Reporting metrics
- Gross sales
- Net sales
- Taxable value
- CGST total
- SGST total
- IGST total
- Payment-wise totals
- Expense totals
- Credit outstanding
- Profit estimate
- Item quantity sold

## Assumptions
- PSS Store is the first active tenant and defines version 1 scope.
- Online operation is sufficient for launch.
- One login per client is acceptable in phase 1.
- Payment methods are tracked operationally but not integrated with payment processors.
- Billing must support thermal print from phase 1.

## Risks
- GST rule changes may require configurable tax logic and invoice field updates.
- Reward redemption rules can become complex if conversion rates and redemption caps are not defined clearly.
- Split payment and credit combinations may introduce edge cases in invoice settlement and reporting.
- Future multi-user support must not be blocked by phase 1 schema shortcuts.

## Success criteria
- Super Admin can create and manage tenants and credentials.
- PSS Store can log in and complete billing end to end.
- Item-level GST defaults work correctly.
- Stock reduces automatically after billing.
- Invoice PDFs are generated successfully.
- Reward earning and redemption work in billing.
- Customer credit and repayments are tracked.
- Expenses are captured with categories and attachments.
- Daily and monthly reports are usable for store operations.

## Phase 1 release boundary
Phase 1 should ship only the agreed billing, GST, customer, rewards, credit, expenses, reports, configuration, and admin modules needed for PSS Store. Scope should remain frozen around must-have workflows first, then expand based on actual tenant usage and feedback, which is a safer rollout pattern for early SaaS products.[cite:2]
