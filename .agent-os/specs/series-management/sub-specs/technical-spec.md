# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/series-management/spec.md

## Technical Requirements

### Data Model

- Create `Series` model in Prisma schema with fields:
  - `id`: Auto-increment integer primary key
  - `name`: String (required, max 100 characters, unique within organization)
  - `description`: Text (optional)
  - `status`: Enum (ACTIVE, ARCHIVED) default ACTIVE
  - `organizationId`: String (required, foreign key)
  - `createdAt`: DateTime (auto-generated)
  - `updatedAt`: DateTime (auto-updated)
  - `createdBy`: String (optional, Clerk user ID)

- Update `Title` model:
  - Add `seriesId`: Integer (optional, foreign key to Series)
  - Add relationship: `series Series?`

### Database Indexes

- `idx_series_organization`: Index on `(organizationId, status)` for filtered series lists
- `idx_series_name`: Index on `(organizationId, name)` for search and uniqueness
- `idx_title_series`: Index on `(seriesId)` for title-to-series lookups
- Unique constraint: `(organizationId, name)` to prevent duplicate series names per org

### API Endpoints

- `GET /api/series` - List all series with optional filters (status, search query) and pagination
- `POST /api/series` - Create new series with validation (unique name per org)
- `GET /api/series/:id` - Get series details with all member titles and aggregated metrics
- `PATCH /api/series/:id` - Update series name, description, or status
- `DELETE /api/series/:id` - Archive series (soft delete by setting status to ARCHIVED)
- `GET /api/series/:id/metrics` - Get aggregated metrics (title count, total stock, sales, profit)
- `PATCH /api/series/:id/bulk-update` - Update specified fields across all titles in series
- `PATCH /api/titles/:id` - Extend existing endpoint to support `seriesId` field

### Service Layer

- **SeriesService** methods:
  - `createSeries(organizationId, data, userId)` - Validate unique name, create series
  - `getSeriesList(organizationId, filters)` - Query with filtering and pagination
  - `getSeriesById(seriesId, organizationId)` - Get series with member titles
  - `updateSeries(seriesId, organizationId, data)` - Update series details with validation
  - `archiveSeries(seriesId, organizationId)` - Set status to ARCHIVED
  - `getSeriesMetrics(seriesId, organizationId)` - Aggregate inventory and sales across member titles
  - `bulkUpdateTitles(seriesId, organizationId, updates, userId)` - Transaction-wrapped bulk update

### UI Components (refine.dev)

- **SeriesList Page** (`/series`):
  - Table showing name, title count, total stock, status with sorting
  - Search bar for series name filtering
  - Status filter (Active/Archived/All)
  - Create Series button

- **SeriesCreate/Edit Pages** (`/series/create`, `/series/:id/edit`):
  - Form with name (required), description (textarea), status (select)
  - Validation: unique name within organization
  - Save/Cancel actions

- **SeriesDetail Page** (`/series/:id`):
  - Series header with name, description, metrics summary
  - Table of member titles with their individual metrics
  - Bulk operations toolbar: "Update RRP", "Set Low Stock Threshold"
  - Add/Remove titles section

- **Title Form Update**:
  - Add Series dropdown (searchable select)
  - Show current series if assigned
  - Allow null (no series)

### Validation Rules

- Series name: Required, 1-100 characters, unique per organization
- Series description: Optional, max 1000 characters
- Status: Must be ACTIVE or ARCHIVED
- Bulk operations: Validate field-specific rules (e.g., RRP must be positive decimal)
- Authorization: Users can only access/modify series in their organization

### Performance Considerations

- Aggregate queries for metrics should use database-level SUM/COUNT operations
- Cache series metrics for 5 minutes using SWR revalidation
- Batch title updates in bulk operations within single transaction
- Limit bulk operations to series with < 1000 titles (show warning if exceeded)

### Authorization

- All series endpoints require authentication via Clerk
- Organization isolation: Filter all queries by `organizationId` from user session
- Permission checks:
  - `series:read` - View series and metrics
  - `series:create` - Create new series
  - `series:update` - Edit series details and bulk operations
  - `series:delete` - Archive series
