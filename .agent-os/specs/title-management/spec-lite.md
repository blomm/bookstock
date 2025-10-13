# Title Management System - Spec Lite

> **Created:** 2025-01-13
> **Status:** Draft
> **Complexity:** Medium
> **Priority:** High (Phase 1 Foundation)

## Summary

The Title Management System is the foundational feature of BookStock, enabling publishing companies to create, edit, and manage their complete book catalog. This system handles all book metadata including ISBNs, pricing, physical specifications, and commercial terms that drive inventory tracking, financial calculations, and sales analysis throughout the application.

## Problem

Publishing companies currently manage 200+ book titles across spreadsheets, leading to:
- Inconsistent book metadata across systems
- Manual entry errors in ISBNs, pricing, and costs
- No centralized catalog for inventory and sales tracking
- Difficulty tracking price changes and commercial terms over time
- No validation of critical fields like ISBNs and pricing

## Solution

Build a comprehensive Title Management System that provides:
- **Centralized Catalog**: Single source of truth for all book metadata
- **Smart Validation**: Automated ISBN validation, duplicate detection, and required field enforcement
- **Price History**: Track all pricing changes with effective dates and reasons
- **Rich Metadata**: Capture publishing-specific fields (format, binding, dimensions, royalty terms)
- **Search & Filter**: Find titles quickly by ISBN, author, series, format, or category
- **Bulk Operations**: Import titles via CSV and perform bulk updates
- **Integration Ready**: API-first design for inventory, sales, and financial calculations

## Key Features

### 1. Title CRUD Operations
- Create new titles with comprehensive metadata
- Edit existing title information
- Soft delete / archive titles
- View detailed title information with relationships

### 2. ISBN Management
- ISBN-13 validation and formatting
- Duplicate ISBN detection
- ISBN-10 to ISBN-13 conversion support
- Barcode generation for printing

### 3. Pricing & Cost Management
- RRP (Recommended Retail Price) tracking
- Unit cost management
- Trade discount percentages
- Price history with effective dating
- Bulk price updates

### 4. Publishing Metadata
- Format (Hardcover, Paperback, Digital, Audiobook)
- Physical specifications (dimensions, weight, page count)
- Binding type and cover finish
- Publication dates and territories
- Category and subcategory classification

### 5. Commercial Terms
- Royalty rates and thresholds
- Print run sizes
- Reprint trigger thresholds
- Territory rights

### 6. Series Integration
- Link titles to series
- View all titles in a series
- Series-level operations

### 7. Search & Filtering
- Full-text search across title, author, ISBN
- Filter by format, series, category, publisher
- Sort by various fields
- Pagination for large catalogs

### 8. Bulk Operations
- CSV import for initial catalog setup
- CSV export for external analysis
- Bulk price updates
- Bulk field updates

### 9. Audit Trail
- Track all title changes
- Price change history
- User attribution for changes

## Success Metrics

- ✅ All 200+ titles imported and validated
- ✅ < 2 seconds page load time for title list
- ✅ < 500ms API response for title details
- ✅ Zero duplicate ISBNs in system
- ✅ 100% ISBN validation accuracy
- ✅ Price history tracking for all changes
- ✅ < 5% error rate on bulk imports

## User Roles & Permissions

### Admin
- Full CRUD access to all titles
- Bulk operations
- Delete/archive titles

### Operations Manager
- Full CRUD access to all titles
- Bulk operations
- Cannot delete/archive

### Financial Controller
- Read-only access to all titles
- Export capabilities
- Price history viewing

### Inventory Clerk
- Read-only access to titles
- Basic search and filter

### Read-Only User
- Read-only access to titles
- Basic search

## Dependencies

### Technical
- ✅ PostgreSQL database (existing)
- ✅ Prisma ORM with Title model (existing)
- ✅ Next.js App Router (existing)
- ✅ Authentication system (completed)

### Data
- Series table (exists, needs management UI)
- Price history table (exists in schema)
- Format enum (exists in schema)

### External
- ISBN validation library
- CSV parsing library
- Barcode generation library (optional, Phase 2)

## Out of Scope (Future Phases)

- Image upload for book covers
- Inventory levels (Phase 1 - separate feature)
- Sales data integration (Phase 2)
- Automated reprint triggers (Phase 3)
- External API integrations (Phase 4)
- Multi-language support
- E-book file management

## Technical Approach

### Architecture
- **Service Layer**: `titleService.ts` for business logic
- **API Routes**: RESTful endpoints at `/api/titles`
- **Validation**: Zod schemas for type safety
- **Database**: Prisma ORM with PostgreSQL
- **UI Components**: React Server Components + Client Components
- **State Management**: React hooks + SWR for data fetching

### Data Flow
```
UI Component → API Route → Service Layer → Prisma → PostgreSQL
     ↓              ↓            ↓
  Validation   Middleware   Business Logic
```

### Key Design Decisions
1. **Service Layer Pattern**: Centralize business logic in services, not API routes
2. **Price History**: Automatic price history creation on price changes
3. **Soft Deletes**: Archive titles rather than hard delete (preserves history)
4. **ISBN Validation**: Client and server-side validation
5. **Audit Logging**: Leverage existing audit middleware for all changes
6. **Pagination**: Cursor-based pagination for performance
7. **Search**: Database-level search (Phase 1), consider Elasticsearch (Phase 4)

## Risk & Mitigations

### Risk: ISBN Data Quality
**Mitigation**: Strict validation, duplicate detection, manual review for edge cases

### Risk: Large Catalog Performance
**Mitigation**: Pagination, indexes, query optimization, caching strategy

### Risk: Price History Complexity
**Mitigation**: Clear effective date logic, automated tests, user-friendly UI

### Risk: Bulk Import Errors
**Mitigation**: Dry-run mode, detailed error reporting, rollback capability

## Timeline Estimate

- **Backend Services & API**: 2-3 days
- **UI Components**: 2-3 days
- **Bulk Operations**: 1-2 days
- **Testing & Documentation**: 1-2 days
- **Total**: 6-10 days

## Next Steps

1. Create detailed technical specification
2. Break down into tasks
3. Implement backend service layer
4. Build API endpoints
5. Create UI components
6. Implement bulk operations
7. Write comprehensive tests
8. Create user documentation
