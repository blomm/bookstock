# Spec Requirements Document

> Spec: Multi-Warehouse Setup
> Created: 2025-11-01
> Status: ✅ COMPLETED 2025-11-01
> Implementation verified with 40 passing tests

## Overview

Implement warehouse entity management to support multi-location inventory tracking across UK, US, and online fulfillment centers. This foundational feature enables real-time stock level tracking per warehouse and provides the infrastructure for future inter-warehouse transfer and allocation features.

## User Stories

### Warehouse Configuration Management

As a Publishing Operations Manager, I want to configure and manage multiple warehouse locations in the system, so that I can accurately track inventory across our UK warehouse, US warehouse, and online fulfillment centers.

**Workflow:** The operations manager logs into BookStock, navigates to the warehouse management page, and sees a list of all configured warehouses with their status (active/inactive), location, and basic details. They can add a new warehouse by clicking "Add Warehouse," entering details like name, location code, address, contact information, and status. The system validates the input and saves the warehouse, making it immediately available for inventory tracking. They can also edit existing warehouses to update details or deactivate warehouses that are no longer in use.

### Multi-Warehouse Inventory Visibility

As a Financial Controller, I want to view which warehouses are configured in the system, so that I can understand our distribution network and prepare for warehouse-specific financial reporting.

**Workflow:** The financial controller accesses the warehouse list view to see all configured warehouses including their location, type, status, and when they were added to the system. This visibility helps them plan for upcoming features like warehouse-specific profit analysis and understand the scope of the inventory tracking system.

### Warehouse Status Management

As an Admin, I want to activate or deactivate warehouses, so that I can prevent stock movements to warehouses that are temporarily closed, under maintenance, or no longer operational.

**Workflow:** When a warehouse needs to be taken offline (e.g., for inventory audit, maintenance, or closure), the admin can change the warehouse status to "Inactive." This prevents new inventory allocations to that warehouse while preserving historical data. When the warehouse is ready to resume operations, the admin can reactivate it.

## Spec Scope

1. **Warehouse Entity Model** - Create database schema for warehouses with properties: name, code, type, location, address, contact details, status, timestamps
2. **Warehouse Management Service** - Implement business logic for creating, updating, listing, and managing warehouse entities
3. **Warehouse API Endpoints** - RESTful endpoints for warehouse CRUD operations with proper authentication and authorization
4. **Warehouse Management UI** - Admin interface to list, create, edit, and manage warehouse status with role-based access control
5. **Seed Data** - Initialize system with three default warehouses: UK Warehouse (London), US Warehouse (New York), Online Fulfillment Center

## Out of Scope

- Stock level tracking per warehouse (next feature: Stock Level Tracking)
- Inter-warehouse transfers (Phase 1 feature: Basic Stock Movements)
- Warehouse capacity planning and limits
- Integration with warehouse management systems (WMS)
- Warehouse performance analytics
- Warehouse-specific user assignments
- Geographic optimization or warehouse selection algorithms
- Multi-currency support per warehouse (assumes GBP/USD handled at title level)

## Expected Deliverable

1. **Warehouse Management Page** - Authenticated users can view a list of all warehouses with their details and status; admins can create, edit, and activate/deactivate warehouses
2. **API Functionality** - RESTful API endpoints for warehouse operations return proper responses and enforce role-based permissions (admins can mutate, all authenticated users can read)
3. **Database Schema** - Warehouse table exists with proper constraints, indexes, and relationships ready for future inventory tracking features
4. **Seed Data Initialization** - System initializes with three pre-configured warehouses (UK, US, Online) on first setup or via migration
