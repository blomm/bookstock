# Spec Requirements Document

> Spec: Title & Inventory Management System
> Created: 2025-09-17
> Status: Planning

## Overview

The Title & Inventory Management System provides comprehensive catalog and inventory management capabilities for BookStock's publishing operations, enabling efficient tracking of book titles, real-time stock levels across multiple warehouses (Turnaround, ACC, Flostream), and automated stock movement processing with detailed sales channel analytics.

## User Stories

### Title Management
**As a Publishing Operations Manager**, I want to manage the complete book catalog with comprehensive publishing metadata so that I can maintain accurate records with RRP, unit costs, royalty rates, and printing specifications for profit calculations and reprint decisions.

**As a Staff Member**, I want to add new titles with all required publishing information including ISBN validation so that I can ensure data quality and establish the foundation for inventory tracking across our warehouses.

### Inventory & Stock Management
**As a Warehouse Coordinator**, I want to track real-time stock levels across Turnaround, ACC, and Flostream warehouses so that I can monitor inventory distribution and identify low stock situations requiring reprint orders.

**As an Operations Manager**, I want to import monthly warehouse data from spreadsheets so that I can automatically update stock movements for sales via different channels (Online, UK Trade, US Trade, ROW Trade, Direct) and track profit by sales channel.

### Analytics & Planning
**As a Publishing Analyst**, I want to view sales velocity and months of stock remaining calculations so that I can make data-driven decisions about reprints and inventory allocation across warehouses.

## Spec Scope

### Title Catalog Management
1. **Complete CRUD operations** for book titles with comprehensive publishing metadata including RRP, unit cost, page count, royalty rates, print run sizes, and physical specifications
2. **Series management** as separate entities with flexible title relationships, supporting both standalone titles and series collections
3. **Enhanced bulk import** for existing catalog data with validation and publishing-specific field support
4. **ISBN validation** ensuring uniqueness and proper format compliance with duplicate prevention

### Multi-Warehouse Inventory System
5. **Real-time inventory tracking** across three warehouses (Turnaround UK, ACC US, Flostream UK) with stock level monitoring
6. **Stock movement management** supporting all transaction types: printing, reprints, inter-warehouse transfers, sales by channel, damage, and disposal
7. **Monthly warehouse data import** from spreadsheets with automated movement categorization and validation
8. **Sales channel tracking** by warehouse: Online (Flostream), UK Trade (Turnaround), US Trade (ACC), ROW Trade (Turnaround), Direct Sales

### Analytics & Automation
9. **Sales velocity analysis** with automated months-of-stock-remaining calculations per warehouse
10. **Low stock alerts** and automated reprint recommendations based on configurable thresholds
11. **Profit calculations** by sales channel using RRP, unit costs, and trade discount structures
12. **Movement audit trail** with complete transaction history and reconciliation capabilities

## Out of Scope

- **Author management** as separate entities (authors stored as text fields within titles)
- **Customer management** and order processing workflows
- **Financial accounting** beyond profit calculations (no general ledger integration)
- **Third-party marketplace integrations** (Amazon, distributors, etc.)
- **Automated ordering systems** for printing and reprints
- **Advanced forecasting algorithms** beyond basic velocity calculations
- **Multi-currency support** (GBP/USD pricing management)
- **Detailed royalty payment processing** (calculation only, not payment workflows)

## Expected Deliverable

### Title & Catalog Management
- **Comprehensive title management interface** where authorized users can create, view, edit, and delete book titles with all publishing metadata including pricing, costs, royalty rates, and physical specifications
- **Series management system** allowing creation of series and flexible title assignment with clear relationship visibility
- **Enhanced bulk import system** supporting existing catalog migration with publishing-specific validation and error reporting

### Multi-Warehouse Inventory System
- **Real-time inventory dashboard** displaying current stock levels across all three warehouses (Turnaround, ACC, Flostream) with drill-down capabilities by title
- **Stock movement interface** for logging all transaction types including printing, transfers, sales by channel, damage, and disposal with proper warehouse channel validation
- **Monthly data import workflows** that process warehouse spreadsheets, automatically categorize movements, and update inventory levels with detailed reconciliation reports

### Analytics & Alerts
- **Stock analysis dashboard** showing sales velocity, months of stock remaining, and automated low-stock alerts with reprint recommendations
- **Profit analysis views** displaying earnings by sales channel (Online, UK Trade, US Trade, ROW Trade, Direct) with historical trending
- **Movement audit system** providing complete transaction history with filtering by warehouse, title, movement type, and date ranges for operational transparency

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-17-title-management-system/tasks.md
- Technical Specification: @.agent-os/specs/2025-09-17-title-management-system/sub-specs/technical-spec.md