# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/series-management/spec.md

## Schema Changes

### New Table: Series

```prisma
model Series {
  id             Int      @id @default(autoincrement())
  name           String   @db.VarChar(100)
  description    String?  @db.Text
  status         SeriesStatus @default(ACTIVE)
  organizationId String   @db.VarChar(255)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  createdBy      String?  @db.VarChar(255)

  titles         Title[]

  @@unique([organizationId, name])
  @@index([organizationId, status], name: "idx_series_organization")
  @@index([organizationId, name], name: "idx_series_name")
}

enum SeriesStatus {
  ACTIVE
  ARCHIVED
}
```

### Updated Table: Title

Add new optional relationship to Series:

```prisma
model Title {
  // ... existing fields ...
  seriesId       Int?
  series         Series? @relation(fields: [seriesId], references: [id], onDelete: SetNull)

  // ... existing relations ...

  @@index([seriesId], name: "idx_title_series")
}
```

## Migration Steps

1. Create `SeriesStatus` enum with values ACTIVE and ARCHIVED
2. Create `Series` table with all fields as specified above
3. Add unique constraint on `(organizationId, name)`
4. Add indexes: `idx_series_organization` and `idx_series_name`
5. Add `seriesId` column to `Title` table as nullable integer
6. Add foreign key constraint from `Title.seriesId` to `Series.id` with ON DELETE SET NULL
7. Add index `idx_title_series` on `Title.seriesId`

## Rationale

### Series Model Design

- **Unique constraint on (organizationId, name)**: Prevents duplicate series names within an organization while allowing different organizations to use the same series names
- **Status enum (ACTIVE/ARCHIVED)**: Enables soft deletion and historical data retention without removing series or breaking title relationships
- **Optional description**: Allows additional context about the series without being mandatory
- **createdBy tracking**: Maintains audit trail of who created each series

### Title-Series Relationship

- **Optional relationship (nullable seriesId)**: Not all titles need to belong to a series; standalone titles remain supported
- **ON DELETE SET NULL**: If a series is deleted (hard delete, not typical), titles remain but lose series association rather than being deleted
- **No cascading**: Archiving a series doesn't affect title status; they remain independent

### Performance Indexes

- **idx_series_organization**: Optimizes common query pattern of listing active series for an organization
- **idx_series_name**: Speeds up series search by name and enforces uniqueness efficiently
- **idx_title_series**: Accelerates queries fetching all titles in a series for detail pages and aggregations
