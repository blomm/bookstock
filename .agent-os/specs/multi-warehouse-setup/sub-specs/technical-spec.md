# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/multi-warehouse-setup/spec.md

## Technical Requirements

### Warehouse Entity Model

- **Database Table:** `warehouses`
- **Primary Key:** UUID (`id`)
- **Required Fields:**
  - `name`: Varchar(100) - Human-readable warehouse name (e.g., "UK Warehouse - London")
  - `code`: Varchar(20) - Unique short code for internal reference (e.g., "UK-LON", "US-NYC", "ONLINE")
  - `type`: Enum - Warehouse type (values: "PHYSICAL", "VIRTUAL", "THIRD_PARTY") - default "PHYSICAL"
  - `status`: Enum - Operational status (values: "ACTIVE", "INACTIVE", "MAINTENANCE") - default "ACTIVE"
  - `is_active`: Boolean - Quick active/inactive flag (derived from status) - default true
- **Optional Fields:**
  - `address_line1`: Varchar(255)
  - `address_line2`: Varchar(255)
  - `city`: Varchar(100)
  - `state_province`: Varchar(100)
  - `postal_code`: Varchar(20)
  - `country`: Varchar(2) - ISO 3166-1 alpha-2 country code
  - `contact_name`: Varchar(100)
  - `contact_email`: Varchar(255)
  - `contact_phone`: Varchar(20)
  - `notes`: Text - Internal notes for warehouse management
- **Timestamps:** `created_at`, `updated_at`
- **Indexes:**
  - Unique index on `code`
  - Index on `status` for filtering
  - Index on `is_active` for quick active warehouse queries

### Warehouse Service Layer

- **Service Class:** `WarehouseService` at `src/services/warehouseService.ts`
- **Methods:**
  - `create(data)` - Create new warehouse with validation, ensure unique code
  - `update(id, data)` - Update warehouse details, handle status changes
  - `findById(id)` - Get warehouse by ID
  - `findByCode(code)` - Get warehouse by unique code
  - `list(options)` - List warehouses with pagination, filtering (status, type), search (name, code, location)
  - `activate(id)` - Change warehouse status to ACTIVE
  - `deactivate(id)` - Change warehouse status to INACTIVE
  - `delete(id)` - Soft delete or hard delete (check for inventory dependencies first)
- **Validation:**
  - Code must be unique, alphanumeric with hyphens, 2-20 characters
  - Name required, 1-100 characters
  - Country code must be valid ISO 3166-1 alpha-2 if provided
  - Email format validation if provided
  - Cannot deactivate warehouse if it has active inventory (future: will check inventory table)

### API Endpoints

- **Base Path:** `/api/warehouses`
- **Authentication:** All endpoints require authentication via Clerk
- **Authorization:**
  - Read operations (GET): All authenticated users with `warehouse:read` permission
  - Write operations (POST, PUT, DELETE): Admins only with `warehouse:create`, `warehouse:update`, `warehouse:delete` permissions
- **Endpoints:** See sub-specs/api-spec.md for detailed specifications

### UI Components

- **Warehouse List Page:** `/app/warehouses/page.tsx`
  - Server-side data fetching with error handling
  - Table component with columns: Name, Code, Type, Status, Location (City, Country), Actions
  - Filters: Status dropdown (All, Active, Inactive, Maintenance)
  - Search: Real-time search across name, code, city, country
  - Pagination: 20 items per page
  - "Add Warehouse" button (visible to admins only)
  - Row actions: View details, Edit (admins), Activate/Deactivate (admins)
  - Loading states and error handling with retry

- **Warehouse Form Component:** `src/components/warehouses/WarehouseForm.tsx`
  - Used for both create and edit modes
  - React Hook Form with Zod validation
  - Field groups:
    - **Basic Information:** Name, Code, Type (dropdown)
    - **Address:** Address lines, City, State/Province, Postal Code, Country (dropdown with search)
    - **Contact Details:** Contact Name, Email, Phone
    - **Status:** Status dropdown (Active, Inactive, Maintenance)
    - **Notes:** Textarea for internal notes
  - Real-time validation with error messages
  - Submit with loading state
  - Cancel button to return to list
  - Success: Redirect to warehouse list with success toast
  - Error: Display API errors in form

- **Warehouse Detail View:** `/app/warehouses/[id]/page.tsx`
  - Display all warehouse information in organized sections
  - Edit button (admins only)
  - Status badge with color coding (green=active, gray=inactive, yellow=maintenance)
  - Future: Will show inventory summary for this warehouse

### Zod Validation Schemas

- **Schema File:** `src/lib/validators/warehouse.ts`
- **CreateWarehouseSchema:**
  - name: z.string().min(1).max(100)
  - code: z.string().regex(/^[A-Z0-9-]{2,20}$/).toUpperCase()
  - type: z.enum(["PHYSICAL", "VIRTUAL", "THIRD_PARTY"]).default("PHYSICAL")
  - status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).default("ACTIVE")
  - address fields: optional z.string() with max lengths
  - country: optional z.string().length(2).toUpperCase()
  - contact_email: optional z.string().email()
  - contact_phone: optional z.string().max(20)
  - notes: optional z.string()
- **UpdateWarehouseSchema:** Partial of CreateWarehouseSchema (all fields optional)

### Database Migration

- **Migration File:** Create new Prisma migration for warehouses table
- **Seed Script:** Update `prisma/seed.ts` to include three default warehouses:
  1. UK Warehouse (code: "UK-LON", London, GB)
  2. US Warehouse (code: "US-NYC", New York, US)
  3. Online Fulfillment (code: "ONLINE", Virtual warehouse)

### Testing Requirements

- **Unit Tests:**
  - WarehouseService methods (create, update, list, status changes)
  - Zod schema validation (valid/invalid cases)
- **Integration Tests:**
  - API endpoints (CRUD operations, authentication, authorization)
  - Database operations (constraints, uniqueness)
- **E2E Tests:**
  - Warehouse list page rendering and filtering
  - Create warehouse flow (admin user)
  - Edit warehouse flow (admin user)
  - Status change flow (activate/deactivate)
  - Permission checks (non-admin cannot create/edit)

### Performance Considerations

- Warehouse list should load in < 500ms
- API responses should return in < 200ms (small dataset, simple queries)
- Index on `code` for fast lookups
- Index on `status` and `is_active` for filtering

### Future Considerations

- This schema prepares for future features:
  - Stock Level Tracking will add `inventory` relationship
  - Inter-warehouse transfers will reference `from_warehouse_id` and `to_warehouse_id`
  - Warehouse capacity planning will add capacity fields
  - Geographic optimization will use address coordinates (future: add lat/lng fields)
