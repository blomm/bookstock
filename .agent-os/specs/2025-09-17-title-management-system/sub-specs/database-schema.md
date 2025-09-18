# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-17-title-management-system/spec.md

> Created: 2025-09-17
> Version: 1.0.0

## Database Changes

### New Tables

#### 1. Series Table
For managing book series with flexibility for future series without titles yet.

**Fields:**
- `id` - Primary key (auto-increment)
- `name` - Series name (required, indexed)
- `description` - Optional series description
- `created_at` - Timestamp
- `updated_at` - Timestamp

#### 2. Warehouses Table
Warehouse entities supporting current 3-warehouse setup with extensibility for future expansion.

**Fields:**
- `id` - Primary key (auto-increment)
- `name` - Warehouse name (Turnaround, ACC, Flostream)
- `code` - Short warehouse code (TRN, ACC, FLS)
- `location` - Geographic location (UK, US)
- `fulfills_channels` - JSON array of sales channels handled by this warehouse
- `is_active` - Boolean flag for warehouse status
- `created_at` - Timestamp
- `updated_at` - Timestamp

**Current Warehouse Setup:**
- **Turnaround (TRN)** - UK warehouse fulfilling UK Trade + ROW Trade sales
- **ACC (ACC)** - US warehouse fulfilling US Trade sales
- **Flostream (FLS)** - UK warehouse fulfilling Online sales (UK + International)

#### 3. Titles Table
Main book catalog with comprehensive publishing-specific metadata.

**Core Publishing Fields:**
- `id` - Primary key (auto-increment)
- `isbn` - International Standard Book Number (unique, required, indexed)
- `title` - Book title (required, indexed)
- `author` - Book author (required, indexed)
- `format` - Book format enum (Hardcover, Paperback, Digital, Audiobook)
- `rrp` - Recommended retail price (Decimal)
- `unit_cost` - Cost per unit for printing/production (Decimal)
- `page_count` - Number of pages (Integer)
- `publication_date` - Date of publication
- `publisher` - Publishing house name
- `category` - Primary book category/genre
- `subcategory` - Secondary classification (optional)

**Physical Product Fields:**
- `dimensions` - Physical dimensions (L×W×H in mm, for physical books)
- `weight` - Weight in grams (for physical books)
- `binding_type` - Binding specification (e.g., Perfect bound, Saddle stitched)
- `cover_finish` - Cover finish type (e.g., Matte, Gloss, Soft touch)

**Commercial Fields:**
- `trade_discount` - Standard trade discount percentage
- `royalty_rate` - Author royalty percentage
- `royalty_threshold` - Minimum sales before royalties apply
- `print_run_size` - Typical print run quantity
- `reprint_threshold` - Minimum stock level to trigger reprint

**Additional Metadata:**
- `description` - Book description/synopsis
- `keywords` - Search keywords for categorization
- `language` - Primary language (ISO code)
- `territory_rights` - Geographic sales rights

**Relationship Fields:**
- `series_id` - Foreign key to Series table (nullable)

**System Fields:**
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

#### 4. Inventory Table
Real-time stock levels tracking per title per warehouse.

**Fields:**
- `id` - Primary key (auto-increment)
- `title_id` - Foreign key to Titles table
- `warehouse_id` - Foreign key to Warehouses table
- `current_stock` - Current quantity in stock
- `reserved_stock` - Stock allocated but not yet shipped
- `available_stock` - Current minus reserved (calculated field)
- `last_movement_date` - Date of most recent stock movement
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

#### 5. Stock Movements Table
Complete audit trail of all inventory transactions with detailed categorization.

**Fields:**
- `id` - Primary key (auto-increment)
- `title_id` - Foreign key to Titles table
- `warehouse_id` - Foreign key to Warehouses table (destination for inbound, source for outbound)
- `movement_type` - Enum defining type of movement
- `quantity` - Number of units moved (positive for inbound, negative for outbound)
- `movement_date` - Date when movement occurred
- `source_warehouse_id` - Foreign key for transfers (nullable)
- `destination_warehouse_id` - Foreign key for transfers (nullable)
- `printer_name` - Name of printer for PRINT_RECEIVED movements (nullable)
- `reference_number` - External reference (invoice, transfer ID, etc.)
- `notes` - Additional movement details
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

**Movement Categories:**
- **Inbound**: PRINT_RECEIVED, WAREHOUSE_TRANSFER
- **Outbound Sales**: ONLINE_SALES, UK_TRADE_SALES, US_TRADE_SALES, ROW_TRADE_SALES, DIRECT_SALES
- **Outbound Other**: PULPED, DAMAGED, FREE_COPIES

### Prisma Schema Definitions

```prisma
model Series {
  id          Int      @id @default(autoincrement())
  name        String   @unique @db.VarChar(255)
  description String?  @db.Text
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relationships
  titles      Title[]

  @@map("series")
  @@index([name])
}

model Warehouse {
  id               Int      @id @default(autoincrement())
  name             String   @db.VarChar(100)  // Turnaround, ACC, Flostream
  code             String   @unique @db.VarChar(10)  // TRN, ACC, FLS
  location         String   @db.VarChar(100)  // UK, US
  fulfillsChannels Json     // ["UK_TRADE", "ROW_TRADE"] for Turnaround
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  // Relationships
  inventory           Inventory[]
  stockMovements      StockMovement[] @relation("WarehouseMovements")
  sourceMovements     StockMovement[] @relation("SourceWarehouse")
  destinationMovements StockMovement[] @relation("DestinationWarehouse")

  @@map("warehouses")
  @@index([code])
  @@index([isActive])
}

model Title {
  // Core Publishing Fields
  id              Int       @id @default(autoincrement())
  isbn            String    @unique @db.VarChar(13)
  title           String    @db.VarChar(500)
  author          String    @db.VarChar(255)
  format          Format
  rrp             Decimal   @db.Decimal(8, 2)
  unitCost        Decimal   @db.Decimal(8, 2) @map("unit_cost")
  pageCount       Int?      @map("page_count")
  publicationDate DateTime? @map("publication_date")
  publisher       String?   @db.VarChar(255)
  category        String?   @db.VarChar(100)
  subcategory     String?   @db.VarChar(100)

  // Physical Product Fields
  dimensions      String?   @db.VarChar(50)  // L×W×H in mm
  weight          Int?      // Weight in grams
  bindingType     String?   @db.VarChar(50) @map("binding_type")
  coverFinish     String?   @db.VarChar(50) @map("cover_finish")

  // Commercial Fields
  tradeDiscount   Decimal?  @db.Decimal(5, 2) @map("trade_discount")  // Percentage
  royaltyRate     Decimal?  @db.Decimal(5, 2) @map("royalty_rate")    // Percentage
  royaltyThreshold Int?     @map("royalty_threshold")                  // Minimum sales
  printRunSize    Int?      @map("print_run_size")
  reprintThreshold Int?     @map("reprint_threshold")

  // Additional Metadata
  description     String?   @db.Text
  keywords        String?   @db.VarChar(500)
  language        String?   @db.VarChar(10)  // ISO language code
  territoryRights String?   @db.VarChar(200) @map("territory_rights")

  // Relationships
  seriesId        Int?      @map("series_id")
  series          Series?   @relation(fields: [seriesId], references: [id])
  inventory       Inventory[]
  stockMovements  StockMovement[]

  // System Fields
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@map("titles")
  @@index([isbn])
  @@index([title])
  @@index([author])
  @@index([seriesId])
  @@index([format])
  @@index([category])
  @@index([publisher])
  @@index([publicationDate])
}

model Inventory {
  id                 Int       @id @default(autoincrement())
  titleId            Int       @map("title_id")
  warehouseId        Int       @map("warehouse_id")
  currentStock       Int       @map("current_stock")
  reservedStock      Int       @default(0) @map("reserved_stock")
  lastMovementDate   DateTime? @map("last_movement_date")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  // Relationships
  title              Title     @relation(fields: [titleId], references: [id])
  warehouse          Warehouse @relation(fields: [warehouseId], references: [id])

  @@unique([titleId, warehouseId])
  @@map("inventory")
  @@index([titleId])
  @@index([warehouseId])
  @@index([currentStock])
}

model StockMovement {
  id                    Int          @id @default(autoincrement())
  titleId               Int          @map("title_id")
  warehouseId           Int          @map("warehouse_id")
  movementType          MovementType @map("movement_type")
  quantity              Int          // Positive for inbound, negative for outbound
  movementDate          DateTime     @map("movement_date")
  sourceWarehouseId     Int?         @map("source_warehouse_id")
  destinationWarehouseId Int?        @map("destination_warehouse_id")
  printerName           String?      @db.VarChar(100) @map("printer_name")
  referenceNumber       String?      @db.VarChar(100) @map("reference_number")
  notes                 String?      @db.Text
  createdAt             DateTime     @default(now()) @map("created_at")
  updatedAt             DateTime     @updatedAt @map("updated_at")

  // Relationships
  title                 Title        @relation(fields: [titleId], references: [id])
  warehouse             Warehouse    @relation("WarehouseMovements", fields: [warehouseId], references: [id])
  sourceWarehouse       Warehouse?   @relation("SourceWarehouse", fields: [sourceWarehouseId], references: [id])
  destinationWarehouse  Warehouse?   @relation("DestinationWarehouse", fields: [destinationWarehouseId], references: [id])

  @@map("stock_movements")
  @@index([titleId])
  @@index([warehouseId])
  @@index([movementType])
  @@index([movementDate])
  @@index([sourceWarehouseId])
  @@index([destinationWarehouseId])
}

enum Format {
  HARDCOVER
  PAPERBACK
  DIGITAL
  AUDIOBOOK
}

enum MovementType {
  // Inbound movements
  PRINT_RECEIVED
  WAREHOUSE_TRANSFER

  // Outbound - Sales channels
  ONLINE_SALES        // Via Flostream
  UK_TRADE_SALES      // Via Turnaround
  US_TRADE_SALES      // Via ACC
  ROW_TRADE_SALES     // Via Turnaround
  DIRECT_SALES        // Direct sales channel

  // Outbound - Other
  PULPED
  DAMAGED
  FREE_COPIES
}
```

## Migration Considerations

### Initial Migration
1. **Create Series table** - Establish series management capability
2. **Create Warehouses table** - Set up Turnaround, ACC, Flostream warehouses
3. **Create Titles table** - Main catalog with enhanced publishing fields
4. **Create Inventory table** - Real-time stock levels per title per warehouse
5. **Create Stock Movements table** - Complete audit trail of all transactions
6. **Create enums** - Format and MovementType standardized values
7. **Add indexes** - Performance optimization for search and reporting

### Seed Data Structure
```sql
-- Warehouse setup
INSERT INTO warehouses (name, code, location, fulfills_channels, is_active) VALUES
('Turnaround', 'TRN', 'UK', '["UK_TRADE_SALES", "ROW_TRADE_SALES"]', true),
('ACC', 'ACC', 'US', '["US_TRADE_SALES"]', true),
('Flostream', 'FLS', 'UK', '["ONLINE_SALES"]', true);

-- Example series seed data
INSERT INTO series (name, description) VALUES
('Opinionated Guides', 'Technical guide series'),
('East London Photo Stories', 'Photography series');
```

### Index Strategy
- **Primary indexes**: ISBN (unique lookup), title and author (search)
- **Relationship indexes**: series_id (joins), format and category (filtering)
- **Publishing indexes**: publisher, publication_date (reporting and analytics)
- **Performance indexes**: Composite indexes may be added based on query patterns

## Rationale

### Series as Separate Entity
- **Flexibility**: Allows creation of series before any titles are added
- **Data integrity**: Centralized series information prevents duplication
- **Future extensibility**: Series can have additional metadata (order, completion status)
- **Query optimization**: Efficient series-based filtering and grouping

### Publishing-Specific Field Design

**Core vs. Calculated Fields**
- **Stored**: Essential publishing data that cannot be derived (ISBN, RRP, unit cost, page count)
- **Calculated**: Profit margins, sales velocity, months of stock (computed from sales data)
- **Commercial**: Royalty rates and thresholds enable automated royalty calculations
- **Physical**: Dimensions and weight crucial for shipping and fulfillment

**ISBN (VarChar(13))**
- Supports both ISBN-10 and ISBN-13 formats
- Unique constraint ensures no duplicate entries
- Indexed for fast lookup and inventory management

**Decimal Precision for Financial Data**
- `Decimal(8,2)` for prices supports up to $999,999.99
- `Decimal(5,2)` for percentages supports rates up to 999.99%
- Prevents floating-point precision issues in financial calculations
- Ensures accurate profit and royalty computations

**Publishing Industry Standards**
- **Page Count**: Essential for printing cost calculations and shipping
- **Binding/Cover**: Affects production costs and customer appeal
- **Print Run Size**: Helps optimize printing economics
- **Territory Rights**: Critical for international sales compliance
- **Trade Discount**: Standard industry pricing structure

**Flexible Categorization**
- **Category/Subcategory**: Two-tier classification system
- **Keywords**: Supports advanced search and recommendation engines
- **Language/Territory**: International publishing support

### Performance Considerations

**Index Strategy**
- ISBN index: O(log n) lookup for inventory checks
- Title/Author indexes: Fast text-based searching
- Series relationship index: Efficient joins and filtering
- Format/Genre indexes: Category-based browsing

**Large Catalog Support**
- Optimized for catalogs with 100,000+ titles
- Efficient memory usage with appropriate field sizes
- Scalable relationship structure

### Data Integrity Rules

**Required Fields**
- ISBN, title, author, format, pricing: Essential for catalog functionality
- Ensures minimum viable product information

**Unique Constraints**
- ISBN uniqueness prevents duplicate catalog entries
- Series name uniqueness maintains data consistency

**Referential Integrity**
- Foreign key relationship maintains series-title consistency
- Nullable series_id allows standalone titles

**Validation Requirements**
- ISBN format validation (to be implemented in application layer)
- Price validation (positive values, reasonable ranges)
- Format enum constraint ensures data consistency