# InventoryPro HQ

InventoryPro HQ is a Next.js/TypeScript inventory, stock-control, sales, proforma, reporting and role-based access-control system designed for local or single-server deployment. It uses a JSON file database with atomic writes and server-side session authentication.

## What the system provides

### Authentication and RBAC

- Secure cookie-based sessions with a configurable `SESSION_SECRET`.
- User accounts with Active/Inactive status.
- Password hashing and password changes.
- Role-based privileges enforced on the server, not only in the UI.
- Admin, Store Manager, Inventory Clerk and Auditor starter roles.
- Custom roles with granular privileges.
- Users can be assigned to a store.
- Roles cannot be deleted while assigned to users.
- The Admin role cannot be renamed or deleted.
- Every protected application API operation has a canonical privilege mapping in `lib/permissions.ts`.
- Movement privileges are independently resolved for IN, OUT, TRANSFER and ADJUSTMENT operations.

### Privilege model

The canonical privilege registry covers:

- Dashboard and inventory viewing.
- Item creation, editing and disabling/deletion.
- Stock movement viewing and individual movement types.
- Receipt generation and receipt history.
- Proforma creation, validation and history.
- Activities/expenses.
- System audit.
- Store management.
- User and role management.
- Reports and inventory export.
- System settings.
- User profile management.
- Posted notes.
- Full-system backup.
- Full operational-data reset.

The UI hides functions that the current user cannot use, while the API independently returns HTTP 403 when a caller lacks the required privilege. Changing a role's permissions therefore affects both navigation and direct API access.

### Inventory

- SKU/item creation and editing.
- SKU, barcode, category and item-type information.
- Measurement units.
- Separate buy and sell prices.
- Minimum stock thresholds.
- Per-store stock quantities.
- Search by SKU, name and barcode.
- Status filtering for in-stock, low-stock and out-of-stock items.
- Disabled stock lifecycle.
- Disabled stock is excluded from operational transactions and reporting views.
- Permanent deletion is blocked when an item has transaction history; disable it instead.
- Barcode printing.

### Stock movements

Supported movement types:

- `IN` — receive stock and optionally update future buy/sell prices.
- `OUT` — issue stock and generate a receipt.
- `TRANSFER` — move stock between stores.
- `ADJUSTMENT` — set the stock quantity to the supplied value.

The server validates the corresponding privilege for each movement type. Stock quantities cannot become negative through normal OUT operations, and disabled items cannot be used.

### Receipts and sales

- Multi-item receipt builder.
- Searchable and paginated item selection.
- Items on a receipt must belong to the same store.
- Customer name and optional phone/reference/note.
- Tax-inclusive and tax-exclusive calculation.
- Configurable tax rate; there is intentionally no hard-coded default tax rate.
- Server-side tax rate is authoritative for new transactions.
- Receipt history with transaction linkage, sales value, cost and gross profit.
- Receipt authorization signature support.
- Print / Save PDF workflow using an isolated print document.
- Printing waits for images/fonts before starting and handles popup-blocking errors.

### Proforma invoices

- Multi-item proforma creation.
- Searchable/paginated item selection.
- Proformas start as `DRAFT` and do not change stock.
- Proforma history is controlled by a dedicated `viewProformas` privilege.
- Creating a proforma requires `generateProforma`.
- Validation requires `validateProforma`.
- Validation re-checks stock and the current configured tax rate.
- Successful validation deducts stock, creates the receipt and records the validating authorizer.
- Printed proformas show the operator (`Done by`) and validation state without unnecessary pending-authorization text.

### Activities and expenses

Activities can record operating costs such as rent, taxes, sanitation, repairs, utilities, transport, salaries, bank charges, marketing and other costs.

Reports calculate:

- Sales.
- Cost of goods.
- Gross profit.
- Tax collected.
- Activities/operating costs.
- Net profit.

Activities do not alter inventory quantities.

### Reports and exports

- Current inventory valuation and unit counts.
- Low-stock and out-of-stock counts.
- Store and category summaries.
- Date-range movement reports.
- Stock IN/OUT/TRANSFER/ADJUSTMENT statistics.
- Sales, tax, cost and profit reporting.
- Activities and net-profit reporting.
- CSV inventory export.
- Dashboard charts are suppressed when there is no meaningful data.

### Stores

- Multiple stores/warehouses.
- Store code, location and manager information.
- Store-specific inventory.
- Inter-store stock transfer.
- Disabled stock can be reviewed from the Stores view and re-enabled by an authorised user.

### System audit

The audit trail records important operational and administrative changes, including:

- Login/logout.
- Item creation, editing, disable/enable and deletion.
- Stock movements.
- Receipts and proforma validation.
- User changes.
- Role changes.
- Settings changes.
- Store creation.
- Activities.
- Posted notes.
- Other significant system actions.

Where appropriate, changes include before/after values.

### Settings and synchronization

Settings include:

- System name.
- Company logo.
- Currency.
- Tax rate.
- User profile and receipt authorization signature.
- Password change.
- Full-system backup.
- Full operational-data reset.

Settings changes are synchronized across open browser tabs through a browser event and `BroadcastChannel`, with a three-second server polling fallback. Server-side transaction endpoints always read the current saved settings directly, so the server remains authoritative.

Historical receipts retain their recorded tax values. Changing the system tax rate does not rewrite historical transactions.

### Full-system backup

Settings → **System data management → Create full backup** downloads a JSON backup containing the complete application database, including:

- Users.
- Roles and privileges.
- Stores.
- Categories.
- Inventory items.
- Transactions.
- Receipts.
- Proformas.
- Activities.
- Posted notes.
- Audit records.
- Sessions.
- System settings.

The backup endpoint is protected by the `backupSystem` privilege.

The backup is a data backup, not a source-code backup. Keep source code and environment secrets separately.

### Clean start / reset

Settings → **System data management → Reset system data** performs a destructive reset protected by the `resetSystemData` privilege.

The reset clears:

- Stores.
- Categories.
- Items.
- Transactions.
- Receipts.
- Proformas.
- Activities.
- Posted notes.
- Audit history.
- Sessions.
- Custom system settings, including the configured tax rate and logo.

To prevent the system from becoming inaccessible, the currently authenticated administrator account is preserved and normalized to the Admin role. The four standard roles are recreated with their canonical privileges.

Create a backup before using reset.

The delivered `data/db.json` is already initialized as a clean system with one administrator account and no operational records.

## Project structure

```text
app/
  api/                 Server API routes
  dashboard/           Authenticated application page
  login/               Login page
components/
  DashboardClient.tsx  Main application UI
  swal.ts              SweetAlert2 helpers
lib/
  auth.ts              Session/authentication helpers
  db.ts                JSON database, migrations, tax and audit helpers
  permissions.ts       Canonical privileges and API privilege registry
  password.ts          Password hashing helpers
data/
  db.json              Application database
public/
  company-logo.svg     Default logo
scripts/
  package-desktop.cjs  Windows/Electron packaging
  ...
desktop/
  main.cjs             Electron desktop shell
```

## Validation and system health

All server-side write endpoints validate required fields, email addresses, passwords, dates, quantities, prices, phone numbers, image payloads, role names, store identifiers and configured tax rates. Invalid JSON requests return HTTP 400 instead of an opaque server error. The server never trusts the client-supplied tax rate for financial calculations; it reads the saved system tax rate.

The local health endpoint is available at `/api/health`. It verifies that the JSON database can be read and that the configured data directory is writable, and reports the application process status.

The Windows desktop shell automatically selects an available loopback port in the 3210–3259 range and uses a non-Secure session cookie for its local HTTP transport. Normal web production deployments continue to require a strong `SESSION_SECRET` and HTTPS.

## Requirements

- Node.js 20+ recommended.
- npm.
- Windows users can run the web application normally or use the supplied Electron packaging scripts for the standalone desktop build.

## Get started — development

1. Install dependencies:

```bash
npm install
```

2. Create the local environment file:

```bash
cp .env.example .env.local
```

On Windows PowerShell, copy the file with:

```powershell
Copy-Item .env.example .env.local
```

3. Set a strong `SESSION_SECRET` in `.env.local`.

Example:

```env
SESSION_SECRET=replace-this-with-a-long-random-secret
```

4. Start the application:

```bash
npm run dev
```

5. Open:

```text
http://localhost:3000
```

### Initial administrator

The clean starter database contains:

```text
Email:    alex.admin@inventory.io
Password: password
Role:     Admin
```

Change this password immediately in Settings before using the system operationally.

## Production build

```bash
npm install
npm run typecheck
npm run build
npm start
```

Set a strong production `SESSION_SECRET`. Do not expose the JSON data directory to the public web server.

## Windows desktop build

The project contains an Electron shell and Windows packaging scripts.

For the web/desktop source workflow:

```text
BUILD-WINDOWS.bat
```

For running the desktop application from an already-built standalone bundle:

```text
RUN-DESKTOP-APP.bat
```

For the detailed Windows notes, see `README-WINDOWS-DESKTOP.md`.

The desktop packaging workflow bundles a standalone Next.js server and a local Node runtime. The runtime is designed for an isolated local desktop deployment.

## Data storage

The default database is:

```text
data/db.json
```

The location can be changed with:

```env
INVENTORY_DATA_DIR=/path/to/data
```

Writes use a temporary file followed by an atomic rename. This is appropriate for a single local/server process. It is not a replacement for a multi-node transactional database.

For horizontally scaled production deployments, replace `lib/db.ts` with PostgreSQL or another transactional database while preserving the server-side permission model.

## API privilege contract

The canonical endpoint mapping is maintained in `lib/permissions.ts` under `ROUTE_PRIVILEGES`.

| Endpoint | Method | Privilege / rule |
|---|---|---|
| `/api/bootstrap` | GET | `viewDashboard` |
| `/api/audit` | GET | `viewAudit` |
| `/api/users` | POST/PATCH | `manageUsers` |
| `/api/roles` | POST/PATCH/DELETE | `manageRoles` |
| `/api/items` | POST | `createItem` |
| `/api/items` | PATCH | `editItem`; status enable/disable additionally uses `deleteItem` |
| `/api/items` | DELETE | `deleteItem` |
| `/api/movements` | POST | Movement type resolves to `stockIn`, `stockOut`, `transferStock` or `adjustStock` |
| `/api/receipts` | POST | `generateReceipt` |
| `/api/receipts/[id]/signature` | PATCH | `generateReceipt` |
| `/api/proformas` | POST | `generateProforma` |
| `/api/proformas` | PATCH | `validateProforma` |
| `/api/activities` | GET | `viewActivities` |
| `/api/activities` | POST/DELETE | `manageExpenses` |
| `/api/stores` | POST | `manageStores` |
| `/api/reports` | GET | `viewReports` |
| `/api/settings` | GET | authenticated dashboard access |
| `/api/settings` | PATCH | `manageSettings` |
| `/api/export` | GET | `exportInventory` |
| `/api/posted-notes` | GET | `viewPostedNotes` |
| `/api/posted-notes` | POST | `postPostedNotes` |
| `/api/profile` | PATCH/POST | `manageProfile` for the current user |
| `/api/backup` | GET | `backupSystem` |
| `/api/system/reset` | POST | `resetSystemData` |
| Authentication routes | — | Authentication/session rules; no application privilege required |
| `/api/branding` | GET | Public branding information used before authentication |

## Tax behavior

There is no hard-coded tax-rate default.

Before creating a new tax-dependent receipt, OUT movement or proforma, configure the rate in Settings. A rate of `0` is valid and explicitly means zero tax.

Tax-inclusive mode treats entered prices as tax-inclusive and extracts the tax component. Tax-exclusive mode calculates tax on the entered subtotal and adds it to the total.

## Printing

Receipts, proformas and barcodes have dedicated print documents. Printing is designed to print the document content rather than the surrounding dashboard page.

If a browser blocks a print popup, the application reports the issue through SweetAlert2 instead of using native browser alerts.

## Error handling

The application uses SweetAlert2 for user-facing confirmations, validation errors, warnings and success notifications. Native `alert`, `confirm` and `prompt` calls are not used for application workflows.

API failures are handled as failures: a non-2xx response is not treated as a successful operation.

## Backup and reset operational guidance

Recommended maintenance sequence:

1. Stop active data-entry work.
2. Open Settings.
3. Create a full backup.
4. Verify that the downloaded JSON file exists and is non-empty.
5. Only then perform a reset if a clean installation is required.
6. Reconfigure the system name, logo, currency and tax rate.
7. Create stores and categories/items.
8. Create operational users and assign roles.
9. Change the starter administrator password.

## Important security notes

- Change the demo administrator password immediately.
- Use a long random `SESSION_SECRET` in production.
- Do not commit `.env.local` or production secrets.
- Protect the `data/` directory from direct public access.
- Restrict the backup function to trusted administrators.
- Treat downloaded backups as sensitive because they contain the entire application database.
- The reset endpoint is intentionally destructive and must remain restricted to trusted administrators.

## Current implementation boundary

The application is optimized for local/single-server use with a JSON database. It provides strong application-level authorization and atomic file writes, but it does not provide distributed locking or multi-node transaction guarantees. For a horizontally scaled deployment, move persistence and sessions to a transactional shared database and preserve the same privilege checks.

## Security and privileges

InventoryPro HQ enforces privileges on the server/API boundary as well as in the user interface. Hidden navigation is only a usability control; it is not the security boundary. Direct API calls and direct receipt URLs are checked against the authenticated user role.

The bootstrap payload is privilege-scoped: inventory, movements, stores, receipts, proformas, activities, users, roles, audit logs and posted notes are only returned when the corresponding privilege permits them. Users who can manage users cannot assign the Admin role or delegate privileges they do not themselves hold. Only an Admin can modify the Admin role or an Admin account, and the system preserves at least one active Admin account.

The Windows desktop application runs its mutable database, session secret and logs from the current Windows user's application-data directory, avoiding write failures when the application is installed under Program Files. The embedded server binds only to 127.0.0.1.


## Settings privileges
Settings access is split into independent privileges. `manageProfile` controls My Profile and password/signature settings; `manageSettings` controls system name, logo, currency and tax; `backupSystem` controls system backup; and `resetSystemData` controls system reset. The Settings navigation item appears only when the user has at least one of these privileges, and unauthorized sections are omitted from the UI rather than rendered as disabled controls. Server-side APIs enforce the same permissions.

## API ↔ UI permission synchronization

The application uses `lib/permissions.ts` as the canonical privilege registry. Protected API operations and their corresponding UI modules/actions are synchronized through the same privilege names.

Run:

```bash
npm run permission-check
```

The check validates that protected API operations have matching UI permission mappings and that module navigation is privilege-aware. Unauthorized actions are removed from the UI rather than rendered as permission-disabled controls.

The authenticated `/api/bootstrap` endpoint is a filtered data aggregator and does not require `viewDashboard`; each returned dataset is controlled by the user's actual privileges. Settings configuration is independently protected by its Settings privileges.
