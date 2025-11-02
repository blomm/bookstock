# Monthly Sales Import - Implementation Tasks

## Phase 1: Database & Service Layer

### Task 1: Create SalesImport Model
- [ ] Create Prisma migration for SalesImport model
- [ ] Add ImportStatus enum (PENDING, VALIDATING, VALID, PROCESSING, COMPLETED, FAILED, PARTIAL)
- [ ] Add relationship to StockMovement (importId field)
- [ ] Add relationship to User (uploadedBy)
- [ ] Run migration and verify schema
- [ ] Update Prisma client

### Task 2: CSV Parser & Validator
- [ ] Install CSV parsing library (papaparse or csv-parse)
- [ ] Create CSVParser class with row-by-row validation
- [ ] Implement field validators (ISBN, date, quantity, channel)
- [ ] Create ValidationResult type with errors array
- [ ] Add tests for CSV parsing with various formats
- [ ] Handle edge cases (empty rows, malformed data)

### Task 3: Sales Import Service
- [ ] Create SalesImportService class
- [ ] Implement uploadFile() method
- [ ] Implement validateImport() method
- [ ] Implement processImport() with batch processing
- [ ] Implement getImportStatus() method
- [ ] Add comprehensive service tests (20+ tests)

### Task 4: Import Processor
- [ ] Create batch processor (100 rows per batch)
- [ ] Implement transaction handling per batch
- [ ] Add progress tracking updates
- [ ] Handle rollback on critical errors
- [ ] Create stock movements from sales records
- [ ] Map channels to warehouses and movement types
- [ ] Add integration tests

## Phase 2: API Endpoints

### Task 5: Upload Endpoint
- [ ] Create POST /api/sales-imports route
- [ ] Add file upload handling (multipart/form-data)
- [ ] Validate file type and size
- [ ] Save file temporarily
- [ ] Create SalesImport record
- [ ] Return import ID and status
- [ ] Add authentication and authorization
- [ ] Write integration tests

### Task 6: Validation Endpoint
- [ ] Create POST /api/sales-imports/[id]/validate route
- [ ] Trigger CSV parsing and validation
- [ ] Update import status
- [ ] Store validation errors
- [ ] Return validation result
- [ ] Add integration tests

### Task 7: Processing Endpoint
- [ ] Create POST /api/sales-imports/[id]/process route
- [ ] Trigger batch processing
- [ ] Update progress in real-time
- [ ] Handle partial success scenarios
- [ ] Return processing result
- [ ] Add integration tests

### Task 8: Status & Error Endpoints
- [ ] Create GET /api/sales-imports route (list imports)
- [ ] Create GET /api/sales-imports/[id] route (get details)
- [ ] Create GET /api/sales-imports/[id]/errors route (error report CSV)
- [ ] Add pagination for import list
- [ ] Add filtering by status
- [ ] Write integration tests

## Phase 3: UI Components

### Task 9: Sales Import Page
- [ ] Create /sales-imports page route
- [ ] Add drag-and-drop file upload component
- [ ] Display file format instructions
- [ ] Show import history table
- [ ] Add filters and search
- [ ] Implement pagination
- [ ] Add component tests

### Task 10: Import Preview Modal
- [ ] Create ImportPreviewModal component
- [ ] Display first 10 rows in table
- [ ] Show column mapping
- [ ] Display validation warnings
- [ ] Add confirm/cancel actions
- [ ] Add component tests

### Task 11: Import Status Dashboard
- [ ] Create ImportStatusDashboard component
- [ ] Add real-time progress bar
- [ ] Display row counts (total, processed, failed)
- [ ] Show error summary
- [ ] Add download error report button
- [ ] Implement auto-refresh for status updates
- [ ] Add component tests

### Task 12: Integration & E2E Tests
- [ ] E2E test: Upload → Validate → Process workflow
- [ ] E2E test: Handle validation errors
- [ ] E2E test: Process with partial failures
- [ ] E2E test: Download error report
- [ ] E2E test: Verify inventory updates after import
- [ ] Performance test: 1000+ row import

## Phase 4: Polish & Documentation

### Task 13: Error Handling & UX
- [ ] Add loading states for all operations
- [ ] Improve error messages
- [ ] Add success notifications
- [ ] Handle network failures gracefully
- [ ] Add retry mechanism for failed imports

### Task 14: Documentation
- [ ] User guide for sales import
- [ ] CSV format documentation with examples
- [ ] Troubleshooting guide
- [ ] API documentation
- [ ] Update README

## Estimated Effort
- Phase 1: 8-12 hours
- Phase 2: 6-8 hours
- Phase 3: 8-10 hours
- Phase 4: 2-4 hours
- **Total: 24-34 hours**

## Dependencies
- Phase 1 complete (inventory & stock movements)
- File upload infrastructure
- CSV parsing library
- Background job queue (future enhancement)

## Success Criteria
- [x] Phase 1 complete
- [ ] All tests passing (60+ tests)
- [ ] Can import 1000 rows in <60 seconds
- [ ] Error reports are clear and actionable
- [ ] Inventory updates are atomic and accurate
- [ ] UI is responsive and user-friendly
