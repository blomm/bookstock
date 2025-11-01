# Spec Requirements Document

> Spec: Inventory Stock Tracking
> Created: 2025-11-01

## Overview

Implement real-time inventory tracking across multiple warehouses with automated stock level updates from movement transactions and manual adjustment capabilities. This feature provides publishing operations teams with accurate, up-to-date stock visibility per title per warehouse, enabling informed decisions about reprints, transfers, and sales fulfillment while maintaining comprehensive audit trails of all inventory changes.

## User Stories

### Real-Time Multi-Warehouse Stock Visibility

As a Publishing Operations Manager, I want to view current stock levels for each title across all warehouses in a single dashboard, so that I can quickly assess inventory availability and make informed decisions about transfers and reprints.

**Workflow:** The operations manager navigates to the Inventory Dashboard and sees a comprehensive table showing all titles with their stock levels broken down by warehouse (UK-LON, US-NYC, ONLINE). They can filter by warehouse to focus on specific locations, search for titles by ISBN or name, and see at-a-glance which titles are low in stock (highlighted with warning indicators based on configurable thresholds). Each row shows current stock, reserved stock, and last movement date. Clicking on a title opens a detailed view showing historical stock level changes over time with a timeline visualization.

### Stock Movement Recording and Auto-Update

As an Inventory Clerk, I want to record stock movements (print receipts, sales, transfers, damages) so that inventory levels automatically update across all affected warehouses while maintaining a complete audit trail.

**Workflow:** The clerk navigates to the Stock Movements page and clicks "Record Movement." They select the movement type (Print Received, Transfer, Sale, Damage, Adjustment), choose the title, warehouse, and quantity. For transfers, they also select the destination warehouse. Upon submission, the system validates the movement (ensuring sufficient stock for outbound movements), records the transaction with timestamp and user details, and automatically updates the inventory levels for all affected warehouses. The clerk receives immediate confirmation and can view the updated stock levels in the inventory dashboard.

### Manual Stock Adjustment with Audit Trail

As an Admin, I want to manually adjust stock levels when physical inventory counts reveal discrepancies, so that the system reflects actual warehouse stock while recording who made the adjustment and why.

**Workflow:** During a physical inventory audit, the admin discovers discrepancies between system records and actual counts. They navigate to the title's inventory page, click "Adjust Stock" for the affected warehouse, enter the actual stock count, and provide a reason for the adjustment (e.g., "Physical inventory count - found 10 extra units"). The system calculates the difference, creates a STOCK_ADJUSTMENT movement record with the admin's user ID and notes, updates the inventory level, and logs the change in the audit trail. All stakeholders with appropriate permissions can later view this audit history to understand when and why adjustments were made.

### Low Stock Threshold Alerts

As a Financial Controller, I want to receive notifications when titles fall below configurable stock thresholds, so that I can proactively plan reprints before running out of inventory.

**Workflow:** The financial controller configures low stock thresholds per title (e.g., 500 units for bestsellers, 100 for backlist titles). When a stock movement causes inventory to drop below the threshold, the system automatically creates an alert record and displays a warning badge on the inventory dashboard. The controller can view all low-stock titles in a dedicated filtered view, see the current stock level versus threshold, and take action by initiating a reprint or transfer.

## Spec Scope

1. **Inventory Dashboard UI** - Display real-time stock levels per title per warehouse with filtering, search, and low-stock indicators in a refine.dev-based admin interface
2. **Stock Movement Recording** - Create UI and API for recording all movement types (Print Received, Sales, Transfers, Damages, Adjustments) with validation and automatic inventory updates
3. **Automated Inventory Updates** - Implement service layer that automatically updates inventory levels when stock movements are recorded, handling both single-warehouse and multi-warehouse transactions (transfers)
4. **Manual Stock Adjustments** - Provide admin-only functionality to override stock levels with required justification and full audit trail
5. **Low Stock Threshold System** - Configure per-title thresholds and display warnings when stock falls below configured levels
6. **Stock History Tracking** - Display historical stock level changes over time with timeline visualization showing movements and their impact
7. **Audit Logging** - Comprehensive logging of all inventory changes including user, timestamp, movement type, and reason for adjustments
8. **Multi-Warehouse Transfer Support** - Record inter-warehouse transfers that deduct from source warehouse and add to destination warehouse atomically

## Out of Scope

- Automated reprint recommendations and notifications (Phase 3: Reprint Alert System)
- Predictive stock calculations based on sales velocity (Phase 3: Sales Velocity Calculator)
- Automated stock allocation optimization between warehouses (Phase 3: Stock Allocation Optimizer)
- Monthly sales data import (Phase 2: Monthly Sales Import - this spec focuses on manual movement recording)
- Integration with external warehouse management systems (Phase 4: Warehouse API Integration)
- Batch/bulk stock movements via CSV import (can be added later)

## Expected Deliverable

1. **Functional Inventory Dashboard** - Users can navigate to /inventory and view a table of all titles with stock levels per warehouse, filter by warehouse, search by title/ISBN, and see low-stock warnings
2. **Working Stock Movement Recording** - Users can navigate to /inventory/movements/new and successfully record a print receipt movement of 1000 units for a title into UK-LON warehouse, then verify the inventory level increased by 1000 in the inventory dashboard
3. **Transfer Validation** - Users can record an inter-warehouse transfer of 100 units from UK-LON to US-NYC, and verify that UK-LON decreased by 100 while US-NYC increased by 100, with a single transfer movement record created
4. **Manual Adjustment with Audit** - Admins can adjust stock for a title from 500 to 475 units with reason "Physical count correction," then view the audit log showing the adjustment with admin's name, timestamp, and reason
5. **Low Stock Alert Display** - Configure a title's low stock threshold to 200 units, record a sale movement that brings stock to 180 units, and verify a warning badge appears on the inventory dashboard for that title
