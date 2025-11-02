# Monthly Sales Import - Technical Specification

## Overview
Implement bulk import functionality for monthly sales and damage data from warehouse partners (Turnaround, ACC, Flostream). This will enable accurate profit tracking and inventory reconciliation.

## Goals
1. Support CSV/Excel file uploads for sales data
2. Validate and process bulk sales records
3. Automatically create stock movements for sales
4. Update inventory levels atomically
5. Track financial data (RRP, unit cost, trade discount) at time of sale
6. Support damage/pulped records in the same import

## User Stories

### Story 1: Upload Monthly Sales File
**As a** publisher administrator
**I want to** upload a CSV file with monthly sales data from our warehouse partners
**So that** I can bulk-import sales records without manual entry

**Acceptance Criteria:**
- Upload CSV/Excel files via web interface
- Support standard warehouse partner formats (Turnaround, ACC, Flostream)
- Preview first 10 rows before confirming import
- Show validation errors before processing
- Support files with up to 10,000 rows

### Story 2: Process Sales Records
**As the** system
**I want to** process each sales record and create corresponding stock movements
**So that** inventory levels are automatically updated

**Acceptance Criteria:**
- Parse each row and validate required fields (ISBN, quantity, channel, date)
- Look up title by ISBN
- Determine correct warehouse based on sales channel
- Create stock movement with correct movement type (ONLINE_SALES, UK_TRADE_SALES, etc.)
- Capture financial snapshot (RRP, unit cost, trade discount at time of sale)
- Update inventory atomically
- Record all actions in audit log

### Story 3: Handle Import Errors Gracefully
**As a** publisher administrator
**I want to** see clear error messages for invalid records
**So that** I can fix data issues and re-import

**Acceptance Criteria:**
- Validate all rows before processing any
- Show detailed error report (row number, field, error message)
- Support partial imports (skip invalid rows, process valid ones)
- Download error report as CSV
- Rollback all changes if critical errors occur

### Story 4: Track Damages and Pulped Stock
**As a** publisher administrator
**I want to** import damage/pulped records in the same file
**So that** I can track all warehouse activity in one upload

**Acceptance Criteria:**
- Support "DAMAGED" and "PULPED" movement types
- Deduct from inventory like sales
- Track separately from sales for reporting
- Include reason/notes field

## Data Model

### SalesImport Model (NEW)
```prisma
model SalesImport {
  id               Int                @id @default(autoincrement())
  filename         String             @db.VarChar(255)
  uploadedBy       String             @map("uploaded_by")
  uploadDate       DateTime           @default(now()) @map("upload_date")
  status           ImportStatus       @default(PENDING)
  totalRows        Int                @map("total_rows")
  processedRows    Int                @default(0) @map("processed_rows")
  failedRows       Int                @default(0) @map("failed_rows")
  errorReport      Json?              @map("error_report")
  startedAt        DateTime?          @map("started_at")
  completedAt      DateTime?          @map("completed_at")

  // Relationships
  movements        StockMovement[]
  uploader         User               @relation(fields: [uploadedBy], references: [id])

  @@map("sales_imports")
  @@index([uploadedBy])
  @@index([status])
  @@index([uploadDate])
}

enum ImportStatus {
  PENDING      // Uploaded, awaiting validation
  VALIDATING   // Validation in progress
  VALID        // Validation passed, ready to process
  PROCESSING   // Import in progress
  COMPLETED    // Successfully completed
  FAILED       // Failed with errors
  PARTIAL      // Partially completed (some rows failed)
}
```

### CSV Format
```csv
ISBN,Date,Quantity,Channel,Type,RRP,UnitCost,TradeDiscount,Reference,Notes
9781234567890,2025-11-01,50,UK_TRADE,SALE,29.99,8.50,40,INV-2025-001,
9781234567891,2025-11-01,-5,UK_TRADE,DAMAGED,29.99,8.50,40,DMG-2025-001,Water damage
9781234567892,2025-11-01,120,ONLINE,SALE,19.99,5.00,0,ORD-2025-123,
```

### Field Mappings
- **ISBN** → Look up Title
- **Channel** → Determine warehouse and movement type
  - UK_TRADE → Turnaround warehouse, UK_TRADE_SALES
  - US_TRADE → ACC warehouse, US_TRADE_SALES
  - ROW_TRADE → Turnaround warehouse, ROW_TRADE_SALES
  - ONLINE → Flostream warehouse, ONLINE_SALES
- **Type** → SALE (positive qty) or DAMAGED/PULPED (negative qty)
- **Date** → movementDate
- **RRP, UnitCost, TradeDiscount** → Financial snapshot

## Technical Architecture

### Components

#### 1. File Upload Service
```typescript
class SalesImportService {
  async uploadFile(file: File, userId: string): Promise<SalesImport>
  async validateImport(importId: number): Promise<ValidationResult>
  async processImport(importId: number): Promise<ProcessResult>
  async getImportStatus(importId: number): Promise<SalesImport>
  async downloadErrorReport(importId: number): Promise<Blob>
}
```

#### 2. CSV Parser
- Use `papaparse` or `csv-parse` library
- Stream large files to avoid memory issues
- Validate each row against schema
- Collect errors for reporting

#### 3. Import Processor
- Process in batches (100 rows at a time)
- Use database transactions per batch
- Update progress in real-time
- Handle rollback on critical errors

#### 4. API Endpoints
- `POST /api/sales-imports` - Upload file
- `GET /api/sales-imports` - List imports
- `GET /api/sales-imports/[id]` - Get import details
- `POST /api/sales-imports/[id]/validate` - Validate import
- `POST /api/sales-imports/[id]/process` - Process import
- `GET /api/sales-imports/[id]/errors` - Download error report

### Validation Rules

#### File-level
- Max file size: 10MB
- Supported formats: CSV, XLSX
- Required columns present
- No duplicate headers

#### Row-level
- ISBN valid (13 digits, checksum)
- Title exists in database
- Date is valid (not future)
- Quantity is integer
- Channel is valid enum value
- RRP/UnitCost/TradeDiscount are valid decimals
- Warehouse exists for channel

#### Business Rules
- No duplicate sales for same ISBN + Date + Channel
- Quantity cannot reduce stock below zero (except for adjustments)
- Financial data (RRP, cost) should match title's current values (warning only)

## UI Components

### 1. Sales Import Page
- Drag-and-drop file upload
- File format instructions
- Import history table
- Progress indicators

### 2. Import Preview Modal
- First 10 rows displayed
- Column mapping confirmation
- Validation warnings/errors
- Confirm/Cancel buttons

### 3. Import Status Dashboard
- Real-time progress bar
- Row counts (total, processed, failed)
- Error summary
- Download error report button

## Implementation Phases

### Phase 1: Database & Service Layer
- [ ] Create SalesImport model and migration
- [ ] Implement SalesImportService with validation
- [ ] Add CSV parsing logic
- [ ] Create import processor with batch processing
- [ ] Write comprehensive tests

### Phase 2: API Endpoints
- [ ] POST /api/sales-imports (upload)
- [ ] POST /api/sales-imports/[id]/validate
- [ ] POST /api/sales-imports/[id]/process
- [ ] GET endpoints for status and errors
- [ ] Integration tests

### Phase 3: UI Components
- [ ] Sales Import page with file upload
- [ ] Import preview modal
- [ ] Progress tracking dashboard
- [ ] Error report download
- [ ] E2E tests

## Testing Strategy

### Unit Tests
- CSV parsing with various formats
- Validation rules
- Error handling
- Batch processing logic

### Integration Tests
- Full import workflow
- Database transactions
- Inventory updates
- Error rollback scenarios

### E2E Tests
- Upload file → Validate → Process
- Handle errors gracefully
- Download error reports
- Check inventory after import

## Performance Considerations

- Process in batches to avoid memory issues
- Use database transactions per batch
- Implement progress tracking
- Consider background job for large imports (future enhancement)
- Index on ISBN for fast lookups

## Security Considerations

- Validate file types (prevent code injection)
- Limit file size
- Require appropriate permissions (sales:import)
- Audit log all imports
- Sanitize CSV content

## Success Metrics

- Import 1000+ rows in under 60 seconds
- 99%+ success rate for valid data
- Clear error messages for 100% of failures
- Zero data corruption incidents
- Automatic inventory reconciliation

## Future Enhancements

- Scheduled imports (daily/weekly)
- Email notifications on completion
- Automatic format detection
- Integration with warehouse partner APIs
- Comparison with expected sales
