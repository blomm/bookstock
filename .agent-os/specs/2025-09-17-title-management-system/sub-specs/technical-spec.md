# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-17-title-management-system/spec.md

> Created: 2025-09-17
> Version: 1.0.0

## Technical Requirements

### UI Components

#### Title Management
- Form components for title creation and editing with extended publishing metadata
- Data tables with sorting, filtering, and pagination for title listings
- Modal dialogs for CRUD operations on titles and series
- Search interface with advanced filtering capabilities

#### Warehouse & Inventory Management
- Real-time inventory dashboard showing stock levels across Turnaround, ACC, Flostream
- Stock movement entry forms for different transaction types
- Monthly data import interface for warehouse spreadsheet uploads
- Inventory allocation views showing distribution across warehouses
- Low stock alerts and reprint recommendation panels

#### Analytics & Reporting
- Sales velocity charts by warehouse and sales channel
- Profit analysis dashboards per sales channel (Online, UK Trade, US Trade, ROW, Direct)
- Months of stock remaining calculations and visualizations
- Movement history timelines with filtering capabilities

#### Responsive Design
- All components built using shadcn/ui for consistency
- Mobile-responsive design for warehouse staff access
- Progressive web app capabilities for offline data entry

### Validation Rules

#### Title Validation
- ISBN format validation (ISBN-10 and ISBN-13) with checksum verification
- Required field validation for title, author, ISBN, RRP, unit cost
- Duplicate prevention based on ISBN uniqueness
- Data type validation for numeric fields (price, page count, percentages)
- Range validation for realistic values (positive prices, reasonable page counts)

#### Inventory & Movement Validation
- Stock quantity validation (non-negative values, reasonable limits)
- Movement type validation against warehouse capabilities
- Date validation for movement entries (not future dates for historical data)
- Warehouse assignment validation (ensure movement types match warehouse channels)
- Bulk import data validation with detailed error reporting

#### Financial Validation
- Percentage validation for royalty rates and trade discounts (0-100%)
- Currency precision validation for pricing fields
- Profit margin calculation validation
- Territory rights format validation

### Admin Dashboard Integration
- Integration with existing refine.dev admin interface
- Custom resource providers for title and series management
- Data grid components with inline editing capabilities
- Export functionality for title catalogs
- Dashboard widgets for inventory analytics

### Series Management
- UI for creating and editing book series
- Interface for linking individual titles to series
- Series ordering and sequencing management
- Bulk operations for series assignment
- Series-based filtering and organization

### Bulk Import System

#### Title Catalog Import
- CSV/spreadsheet upload interface with drag-and-drop support
- Real-time data validation during import process
- Error handling with detailed feedback for invalid records
- Preview functionality before final import
- Progress tracking for large import operations
- Template download for proper CSV format

#### Monthly Warehouse Data Import
- Dedicated import interfaces for each warehouse (Turnaround, ACC, Flostream)
- Automated categorization of movement types based on source data
- Support for multiple file formats from different warehouse systems
- Validation against existing inventory levels
- Batch processing for large monthly datasets
- Error reconciliation and manual override capabilities
- Automated email confirmations and import summaries

### Permissions
- Role-based access control integration with existing Clerk authentication
- Permission levels: View, Edit, Create, Delete, Bulk Import
- User role management within admin interface
- Audit logging for sensitive operations
- Session management and secure access controls

### Performance

#### Database Optimization
- Comprehensive indexing on frequently queried fields (ISBN, title, author, warehouse, movement type)
- Efficient pagination for large datasets (50-100 items per page)
- Optimized joins between titles, inventory, and movement tables
- Query optimization for real-time stock level calculations
- Database connection pooling for concurrent access

#### Caching Strategy
- Redis caching for frequently accessed data (stock levels, sales calculations)
- Cache invalidation on inventory movements
- Cached aggregations for dashboard analytics
- Session-based caching for user-specific data

#### Real-time Updates
- Optimistic UI updates for stock movements
- Background job processing for bulk calculations
- WebSocket connections for live inventory updates
- Efficient data synchronization across multiple users

### File Upload
- Cover image upload and management using existing S3 infrastructure
- Image optimization and multiple size generation
- Secure file upload with presigned URLs
- File type validation and size limits
- CDN integration for optimized delivery

## External Dependencies

Based on the existing BookStock tech stack, the following additional libraries are recommended:

### ISBN Validation
- **isbn3** - Pure JavaScript ISBN validation library
- Handles both ISBN-10 and ISBN-13 formats with checksum verification
- Lightweight with no external dependencies

### CSV Parsing for Bulk Import
- **papaparse** - Robust CSV parsing library
- Handles large files with streaming support
- Built-in error handling and data type detection
- Browser and Node.js compatible

### File Upload Enhancement
- **react-dropzone** - File upload component with drag-and-drop
- Already compatible with existing upload infrastructure
- Enhanced UX for bulk file operations

All other functionality can be implemented using the existing tech stack:
- Next.js for API routes and server-side operations
- Prisma for database operations and schema management
- Clerk for authentication and role management
- refine.dev for admin interface components
- shadcn/ui for consistent UI components
- Existing S3 setup for file storage