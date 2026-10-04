# InventoryPro HQ — Windows Desktop

InventoryPro HQ can run as a Windows desktop application through Electron. The desktop shell launches the bundled standalone Next.js server locally and opens the application in an Electron window.

## Before building

Install Node.js/npm on the development/build machine, then from the project directory run:

```bat
npm install
```

Set a strong `SESSION_SECRET` in `.env.local` for normal web/server use.

## Build the Windows application

Use:

```text
BUILD-WINDOWS.bat
```

The project also exposes:

```bash
npm run desktop:build
```

The packaging workflow creates a Windows x64 desktop distribution under `release-build` when the required standalone server/runtime resources are available.

## Run the desktop application

After a successful build, use:

```text
RUN-DESKTOP-APP.bat
```

The Electron shell runs the local application server and opens it in the desktop window.

## Desktop data

InventoryPro HQ stores its application database in `data/db.json` unless `INVENTORY_DATA_DIR` is configured. The Settings backup function creates a complete JSON data backup from the running application.

## Clean start

The distributed source database is initialized with one Admin account and no operational records. For an already-used installation, use Settings → System data management → Reset system data after creating a backup.

Reset preserves the currently authenticated administrator account and recreates the standard roles while clearing operational data, sessions, audit history and custom settings.

## Initial login

```text
Email:    alex.admin@inventory.io
Password: password
```

Change the password immediately.

## Desktop printing

Receipt, proforma and barcode printing uses dedicated print documents. The Electron shell permits the isolated print workflow used by the application so the printed output contains the intended document rather than the dashboard shell.

## Backup

Settings → System data management → Create full backup downloads the complete application database as JSON. Keep backups outside the application directory and treat them as sensitive.

## Troubleshooting

### Application does not start

Check the local server log when running the desktop bundle. Rebuild the standalone application if the bundled server/runtime resources are missing.

### Print window does not appear

Allow the application window to open popups/print windows and try again. InventoryPro HQ reports blocked print preparation through the application UI.

### Data is missing after reset

Reset is destructive by design. Restore the data from the backup using an appropriate controlled recovery procedure; the current application exposes backup creation, not an end-user restore workflow.
