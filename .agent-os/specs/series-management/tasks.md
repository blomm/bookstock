# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/series-management/spec.md

> Created: 2025-11-02
> Status: Ready for Implementation

## Tasks

- [x] 1. Create Series Database Schema and Migrations
  - [x] 1.1 Write migration tests for Series model creation
  - [x] 1.2 Create Prisma schema for Series model with fields: id, name, description, status (enum), organizationId, createdAt, updatedAt, createdBy
  - [x] 1.3 Create SeriesStatus enum with ACTIVE and ARCHIVED values
  - [x] 1.4 Add seriesId field to Title model as optional foreign key
  - [x] 1.5 Add unique constraint on (organizationId, name) for Series
  - [x] 1.6 Create database indexes: idx_series_organization on (organizationId, status), idx_series_name on (organizationId, name), idx_title_series on Title.seriesId
  - [x] 1.7 Generate and run Prisma migration
  - [x] 1.8 Verify all tests pass

- [ ] 2. Implement Series Service Layer
  - [ ] 2.1 Write unit tests for SeriesService methods (createSeries, getSeriesList, getSeriesById, updateSeries, archiveSeries, getSeriesMetrics, bulkUpdateTitles)
  - [ ] 2.2 Create Zod validation schemas for series input (name, description, status)
  - [ ] 2.3 Create Zod validation schema for bulk update operations
  - [ ] 2.4 Implement SeriesService.createSeries() with unique name validation
  - [ ] 2.5 Implement SeriesService.getSeriesList() with filtering (status, search) and pagination
  - [ ] 2.6 Implement SeriesService.getSeriesById() with member titles
  - [ ] 2.7 Implement SeriesService.updateSeries() with validation
  - [ ] 2.8 Implement SeriesService.archiveSeries() to set status to ARCHIVED
  - [ ] 2.9 Implement SeriesService.getSeriesMetrics() to aggregate inventory and sales across member titles
  - [ ] 2.10 Implement SeriesService.bulkUpdateTitles() with transaction handling for atomic updates
  - [ ] 2.11 Verify all tests pass

- [ ] 3. Build Series API Endpoints
  - [ ] 3.1 Write integration tests for GET /api/series endpoint
  - [ ] 3.2 Write integration tests for POST /api/series endpoint
  - [ ] 3.3 Write integration tests for GET /api/series/:id endpoint
  - [ ] 3.4 Write integration tests for PATCH /api/series/:id endpoint
  - [ ] 3.5 Write integration tests for DELETE /api/series/:id endpoint
  - [ ] 3.6 Write integration tests for GET /api/series/:id/metrics endpoint
  - [ ] 3.7 Write integration tests for PATCH /api/series/:id/bulk-update endpoint
  - [ ] 3.8 Implement GET /api/series with authentication (returns paginated series list with filters)
  - [ ] 3.9 Implement POST /api/series with authentication and validation (creates new series)
  - [ ] 3.10 Implement GET /api/series/:id with authentication (returns series with member titles)
  - [ ] 3.11 Implement PATCH /api/series/:id with authentication and validation (updates series details)
  - [ ] 3.12 Implement DELETE /api/series/:id with authentication (archives series)
  - [ ] 3.13 Implement GET /api/series/:id/metrics with authentication (returns aggregated metrics)
  - [ ] 3.14 Implement PATCH /api/series/:id/bulk-update with authentication (updates all titles in series)
  - [ ] 3.15 Extend PATCH /api/titles/:id to support seriesId field
  - [ ] 3.16 Add authorization checks to ensure users can only access their organization's series
  - [ ] 3.17 Add error handling for duplicate names, invalid series IDs, and validation errors
  - [ ] 3.18 Verify all tests pass

- [ ] 4. Create Series UI Components and Pages
  - [ ] 4.1 Write component tests for SeriesList page
  - [ ] 4.2 Write component tests for SeriesCreate form
  - [ ] 4.3 Write component tests for SeriesEdit form
  - [ ] 4.4 Write component tests for SeriesDetail page
  - [ ] 4.5 Create SeriesList page using refine.dev (displays series table with name, title count, total stock, status, search, and filters)
  - [ ] 4.6 Create SeriesCreate page with form (name, description, status fields with validation)
  - [ ] 4.7 Create SeriesEdit page with pre-populated form
  - [ ] 4.8 Create SeriesDetail page showing series info, member titles table, and aggregated metrics
  - [ ] 4.9 Add bulk operations toolbar to SeriesDetail page (Update RRP, Set Low Stock Threshold)
  - [ ] 4.10 Extend Title form to include Series dropdown (searchable select with current series)
  - [ ] 4.11 Add series filter to Titles list page
  - [ ] 4.12 Implement real-time data updates using SWR for series list and detail pages
  - [ ] 4.13 Add visual indicators for archived series
  - [ ] 4.14 Create confirmation dialogs for bulk operations
  - [ ] 4.15 Verify all tests pass

- [ ] 5. Integration Testing and Documentation
  - [ ] 5.1 Write E2E tests for complete series workflow (create series, assign titles, view metrics, update series)
  - [ ] 5.2 Write E2E tests for bulk operations workflow (update RRP for all titles in series, verify changes)
  - [ ] 5.3 Write E2E tests for series filtering on titles page (filter by series, verify correct titles shown)
  - [ ] 5.4 Write E2E tests for archiving series (archive series, verify status change, verify titles retain seriesId)
  - [ ] 5.5 Test edge cases (duplicate series names in same org, series with 0 titles, bulk update with invalid data)
  - [ ] 5.6 Verify performance with database indexes (query time for series list with 100+ series, metrics aggregation with 50+ titles per series)
  - [ ] 5.7 Test authorization (ensure users cannot access other organizations' series)
  - [ ] 5.8 Create API documentation with endpoints, request/response schemas, validation rules, and error codes
  - [ ] 5.9 Update user documentation with series management workflow and screenshots
  - [ ] 5.10 Verify all tests pass
