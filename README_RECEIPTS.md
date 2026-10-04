# Receipt generation workflow

InventoryPro HQ now includes a dedicated **Generate Receipt** module.

Workflow:
1. Open **Generate Receipt** from the sidebar.
2. Select an inventory item.
3. Enter the quantity.
4. Enter the amount per item.
5. Click **Add to receipt**.
6. Repeat for every item required on the issue.
7. Edit quantities or amounts directly in the receipt list, or remove lines.
8. Enter **Issued to**, an optional reference, and an optional note.
9. Click **Generate receipt**.
10. The system validates all lines and available stock, deducts stock, creates an OUT transaction for every line, creates a shared receipt number, and opens the printable receipt.

The receipt displays all selected items, quantities, unit amounts, line totals, grand total, store, recipient, authorizing user, reference, and notes.

Use the browser's **Print / Save PDF** button to create a PDF copy.


### Proforma history and validation

Proforma invoices are saved as drafts and listed in **Proforma History** with status, total, creator (Done by), and validator. Printing includes the preparer's name/signature and, after validation, the authorizer's name, signature and timestamp. Configure an authorization signature in Settings before validating. Draft proformas do not change stock. Validation rechecks stock availability, records the authorizer and signature, deducts the listed quantities, creates OUT transactions and a linked sales receipt. A proforma can only be validated once; the receipt is accessible from the proforma history and Receipt History.
