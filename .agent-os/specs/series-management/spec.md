# Spec Requirements Document

> Spec: Series Management
> Created: 2025-11-02

## Overview

Implement a series grouping system that allows publishers to organize related book titles into named series (e.g., "Opinionated Guides", "History Series") with automated aggregation of series-level inventory, sales, and profitability metrics across all titles within each series.

## User Stories

### Series Organization and Title Grouping

As a Publishing Operations Manager, I want to group related titles into named series, so that I can manage and analyze collections of books as unified product lines rather than tracking each title individually.

**Workflow:** The operations manager navigates to the Series page and clicks "Create New Series." They enter the series name (e.g., "Opinionated Guides"), optional description, and select whether the series is active or archived. After creating the series, they can add existing titles to the series either from the Series detail page or directly from the Title edit form. The system displays a list of all series with title counts, total inventory, and aggregate sales metrics. Clicking on a series shows all titles within that series with their individual and combined performance data.

### Series-Level Inventory and Sales Analytics

As a Financial Controller, I want to view aggregated inventory levels and sales performance for entire series, so that I can make strategic decisions about which product lines to invest in or discontinue.

**Workflow:** The financial controller opens the Series Dashboard and sees all active series with key metrics: total titles in series, combined stock across all warehouses, 12-month sales volume, year-to-date revenue, and lifetime profitability. They can sort series by performance metrics, filter by active/archived status, and click into any series to see a breakdown showing each title's contribution to the series totals. This view helps identify high-performing series that warrant additional investment and underperforming series that may need marketing support or retirement.

### Multi-Title Series Operations

As an Inventory Clerk, I want to perform bulk operations on all titles within a series, so that I can efficiently manage series-wide pricing updates, reprint decisions, or promotional campaigns.

**Workflow:** When planning a promotional campaign for the "Opinionated Guides" series, the clerk navigates to the series detail page and uses the bulk operations toolbar. They can update RRP for all titles in the series simultaneously, set consistent low-stock thresholds, or generate a comprehensive series inventory report. The system validates all changes, shows a preview of affected titles, and applies updates atomically with full audit logging of who made series-level changes and when.

## Spec Scope

1. **Series Model and Database Schema** - Create Series entity with name, description, status (active/archived), and relationship to titles allowing one-to-many association
2. **Series CRUD Interface** - Build refine.dev admin pages for creating, editing, listing, and archiving series with search and filtering capabilities
3. **Title-Series Association** - Add series dropdown to Title form allowing assignment/removal of titles to/from series with validation
4. **Series Dashboard with Aggregated Metrics** - Display all series with computed totals: title count, combined inventory, total sales, aggregated profitability
5. **Series Detail View** - Show individual series with all member titles, their metrics, and series-level analytics including stock distribution across warehouses
6. **Bulk Series Operations** - Enable series-wide updates for common fields like RRP, low stock thresholds, and other title properties
7. **Series Filtering and Search** - Implement filtering by series on title list pages and search functionality to find series by name

## Out of Scope

- Series-specific pricing rules or promotional discounts (can be added in future)
- Hierarchical series (series within series or parent/child relationships)
- Series-level sales velocity calculations and automated reprint recommendations (Phase 3 feature)
- Series publishing schedule and planned release dates for future titles
- Series cover art or branding assets management
- Integration with external marketing platforms

## Expected Deliverable

1. **Functional Series Management** - Users can navigate to /series and successfully create a new series "Test Series", view it in the series list, edit its details, and archive it
2. **Title Assignment to Series** - Users can edit an existing title, select "Test Series" from the series dropdown, save the title, and verify the title now appears in the series detail page
3. **Series Aggregated Metrics** - Users can view the series dashboard showing "Test Series" with accurate counts: total titles (matching number assigned), total current stock (sum of all member title inventory), and total sales (aggregate of all member title sales)
4. **Series Filtering on Titles Page** - Users can navigate to /titles, filter by "Test Series", and see only titles assigned to that series displayed
5. **Bulk Operations** - Users can navigate to series detail page, select "Update RRP for all titles", enter a new price, preview changes for all 3 titles in the series, confirm, and verify all title RRPs were updated with audit log entries
