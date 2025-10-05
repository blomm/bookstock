# Product Roadmap

## Phase 1: Core Inventory Management

**Goal:** Establish foundational inventory tracking system for titles and warehouses
**Success Criteria:** Complete title catalog management with real-time stock levels across all warehouses

### Features

- [ ] Title Management System - Create, edit, and manage book catalog with ISBN, author, format, RRP, unit cost `M`
- [ ] Multi-Warehouse Setup - Configure UK, US, and online fulfillment warehouse entities `S`
- [ ] Stock Level Tracking - Real-time inventory levels per title per warehouse `L`
- [ ] Basic Stock Movements - Record printing, reprints, and inter-warehouse transfers `M`
- [ ] Series Management - Group titles by series (e.g., "Opinionated Guides") `S`
- [x] User Authentication - Secure login system with role-based access control `M`

### Dependencies

- PostgreSQL database setup
- Next.js application foundation
- Prisma ORM configuration

## Phase 2: Sales & Financial Tracking

**Goal:** Implement sales logging and automated profit calculations
**Success Criteria:** Monthly sales data import with accurate profit tracking per title

### Features

- [ ] Monthly Sales Import - Bulk import sales and damage data from warehouse partners `L`
- [ ] Profit Calculation Engine - Automated profit tracking using (RRP/2 - unit cost) × sales `M`
- [ ] Financial Dashboard - Real-time profitability overview across all titles `L`
- [ ] Historical Sales Analysis - Track monthly, 12-month, YTD, and lifetime sales `M`
- [ ] Cost Management - Track and update unit costs per title `S`
- [ ] Damage Tracking - Record and analyze damaged inventory losses `S`

### Dependencies

- Phase 1 completion
- Data import interfaces
- Financial calculation validation

## Phase 3: Advanced Analytics & Automation

**Goal:** Implement intelligent reprint triggers and comprehensive analytics
**Success Criteria:** Automated alerts for low stock with predictive reprint recommendations

### Features

- [ ] Sales Velocity Calculator - Determine average monthly sales per title `M`
- [ ] Months of Stock Analysis - Calculate remaining stock duration per warehouse `S`
- [ ] Reprint Alert System - Automated notifications when stock falls below 3 months `L`
- [ ] Royalty Calculation Engine - Automated royalty tracking with configurable thresholds `L`
- [ ] Advanced Reporting - Comprehensive analytics dashboard with export capabilities `XL`
- [ ] Stock Allocation Optimizer - Recommendations for optimal warehouse distribution `L`

### Dependencies

- Phase 2 completion
- Email notification system
- Background job processing

## Phase 4: Integration & Optimization

**Goal:** External integrations and performance optimization
**Success Criteria:** Seamless warehouse partner integrations with sub-second response times

### Features

- [ ] Warehouse API Integration - Direct connections to warehouse management systems `XL`
- [ ] Automated Data Sync - Real-time inventory updates from warehouse partners `L`
- [ ] Mobile Dashboard - Responsive mobile interface for on-the-go access `M`
- [ ] Advanced Search & Filtering - Complex queries across titles, series, and performance metrics `M`
- [ ] Bulk Operations - Mass updates for pricing, costs, and inventory adjustments `M`

### Dependencies

- Phase 3 completion
- Warehouse partner API documentation
- Mobile-first design system