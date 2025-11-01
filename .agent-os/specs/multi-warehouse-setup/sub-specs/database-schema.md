# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/multi-warehouse-setup/spec.md

## Schema Changes

### New Table: `warehouses`

Create a new table to store warehouse entity data with the following structure:

```prisma
model Warehouse {
  id              String    @id @default(cuid())
  name            String    @db.VarChar(100)
  code            String    @unique @db.VarChar(20)
  type            WarehouseType @default(PHYSICAL)
  status          WarehouseStatus @default(ACTIVE)
  isActive        Boolean   @default(true) @map("is_active")

  // Address fields
  addressLine1    String?   @map("address_line1") @db.VarChar(255)
  addressLine2    String?   @map("address_line2") @db.VarChar(255)
  city            String?   @db.VarChar(100)
  stateProvince   String?   @map("state_province") @db.VarChar(100)
  postalCode      String?   @map("postal_code") @db.VarChar(20)
  country         String?   @db.VarChar(2)

  // Contact fields
  contactName     String?   @map("contact_name") @db.VarChar(100)
  contactEmail    String?   @map("contact_email") @db.VarChar(255)
  contactPhone    String?   @map("contact_phone") @db.VarChar(20)

  // Notes
  notes           String?   @db.Text

  // Timestamps
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  // Future relationships (not implemented in this spec)
  // inventory       Inventory[]
  // transfersFrom   StockTransfer[] @relation("FromWarehouse")
  // transfersTo     StockTransfer[] @relation("ToWarehouse")

  @@map("warehouses")
  @@index([status])
  @@index([isActive])
}

enum WarehouseType {
  PHYSICAL
  VIRTUAL
  THIRD_PARTY
}

enum WarehouseStatus {
  ACTIVE
  INACTIVE
  MAINTENANCE
}
```

## Migration Strategy

### Prisma Migration Command

```bash
npx prisma migrate dev --name add_warehouses_table
```

### Migration Steps

1. **Create Migration:**
   - Add Warehouse model to `prisma/schema.prisma`
   - Add WarehouseType and WarehouseStatus enums
   - Run migration command to generate SQL

2. **Verify Migration:**
   - Check generated migration SQL in `prisma/migrations/`
   - Ensure indexes are created correctly
   - Verify enum types are created

3. **Apply Migration:**
   - Run migration against development database
   - Verify table structure with `npx prisma studio`

4. **Seed Initial Data:**
   - Update `prisma/seed.ts` to include warehouse seeding
   - Run seed script: `npx prisma db seed`

## Seed Data Script

Add the following to `prisma/seed.ts`:

```typescript
// Seed Warehouses
const warehouses = await Promise.all([
  prisma.warehouse.upsert({
    where: { code: 'UK-LON' },
    update: {},
    create: {
      name: 'UK Warehouse - London',
      code: 'UK-LON',
      type: 'PHYSICAL',
      status: 'ACTIVE',
      isActive: true,
      addressLine1: '123 Publishing Street',
      city: 'London',
      postalCode: 'EC1A 1BB',
      country: 'GB',
      contactEmail: 'uk-warehouse@bookstock.example',
      contactPhone: '+44 20 7946 0958',
    },
  }),
  prisma.warehouse.upsert({
    where: { code: 'US-NYC' },
    update: {},
    create: {
      name: 'US Warehouse - New York',
      code: 'US-NYC',
      type: 'PHYSICAL',
      status: 'ACTIVE',
      isActive: true,
      addressLine1: '456 Book Avenue',
      city: 'New York',
      stateProvince: 'NY',
      postalCode: '10001',
      country: 'US',
      contactEmail: 'us-warehouse@bookstock.example',
      contactPhone: '+1 212 555 0123',
    },
  }),
  prisma.warehouse.upsert({
    where: { code: 'ONLINE' },
    update: {},
    create: {
      name: 'Online Fulfillment Center',
      code: 'ONLINE',
      type: 'VIRTUAL',
      status: 'ACTIVE',
      isActive: true,
      notes: 'Virtual warehouse for online order fulfillment and direct-to-consumer sales',
    },
  }),
])

console.log(`Created ${warehouses.length} warehouses`)
```

## Database Constraints

### Primary Constraints

- **Primary Key:** `id` (CUID, unique identifier)
- **Unique Constraint:** `code` must be unique across all warehouses
- **Not Null Constraints:** `name`, `code`, `type`, `status`, `isActive`, `createdAt`, `updatedAt`

### Indexes

- **Index on `code`:** Fast lookups by warehouse code (unique index automatically created)
- **Index on `status`:** Optimize filtering by warehouse status (ACTIVE, INACTIVE, MAINTENANCE)
- **Index on `isActive`:** Quick queries for active warehouses only

### Data Integrity Rules

- **Code Format:** Must match pattern `^[A-Z0-9-]{2,20}$` (enforced in application layer)
- **Country Code:** Should be valid ISO 3166-1 alpha-2 code if provided (enforced in application layer)
- **Email Format:** Must be valid email if provided (enforced in application layer)
- **Type Values:** Limited to PHYSICAL, VIRTUAL, THIRD_PARTY
- **Status Values:** Limited to ACTIVE, INACTIVE, MAINTENANCE

## Rationale

### Design Decisions

1. **CUID for Primary Key:**
   - Secure, URL-safe unique identifiers
   - Consistent with existing Title model pattern
   - Better for distributed systems than auto-increment

2. **Separate `isActive` Boolean:**
   - Quick filtering for active warehouses without enum comparison
   - Derived from `status` field (ACTIVE = true, others = false)
   - Performance optimization for common queries

3. **Flexible Address Structure:**
   - Supports both UK and US address formats
   - Optional fields accommodate virtual warehouses
   - `stateProvince` field handles both US states and UK counties

4. **Three Warehouse Types:**
   - PHYSICAL: Traditional warehouse locations
   - VIRTUAL: Online fulfillment without physical location
   - THIRD_PARTY: External warehouse partners (future use)

5. **Three Status Values:**
   - ACTIVE: Normal operations
   - INACTIVE: Permanently closed or disabled
   - MAINTENANCE: Temporarily unavailable (preserves data for reactivation)

6. **Contact Information Optional:**
   - Not all warehouses may have dedicated contacts
   - Virtual warehouses may not need contact details
   - Flexibility for different organizational structures

### Performance Considerations

- Indexes on `status` and `isActive` support fast filtering (most common queries)
- Unique index on `code` ensures fast lookups and prevents duplicates
- VarChar length limits prevent excessive storage usage
- Text type for `notes` field allows unlimited length for internal documentation

### Future Extensibility

This schema prepares for future features:

1. **Inventory Tracking:** Ready for `inventory` relationship to link titles to warehouses
2. **Stock Transfers:** Schema supports `transfersFrom` and `transfersTo` relationships
3. **Geographic Features:** Address fields support future lat/lng geocoding for optimization
4. **Capacity Planning:** Can add capacity fields (max_capacity, current_capacity) later
5. **Third-Party Integration:** Type field supports external warehouse partners
6. **Audit Trail:** Created/updated timestamps support change tracking

### Migration Rollback Plan

If migration needs to be rolled back:

```bash
# Rollback migration
npx prisma migrate resolve --rolled-back [migration_name]

# Or drop table manually if needed
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TYPE IF EXISTS "WarehouseType";
DROP TYPE IF EXISTS "WarehouseStatus";
```

Note: Rollback should be safe in development. In production, coordinate with data team before rolling back.
