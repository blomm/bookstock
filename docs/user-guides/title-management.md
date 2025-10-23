# Title Management User Guide

## Overview

The Title Management system allows you to create, edit, search, and manage your complete book catalog in BookStock. This guide covers all features and workflows for managing titles effectively.

## Table of Contents

1. [Viewing Titles](#viewing-titles)
2. [Creating a New Title](#creating-a-new-title)
3. [Editing a Title](#editing-a-title)
4. [Searching and Filtering](#searching-and-filtering)
5. [Price History](#price-history)
6. [Bulk Operations](#bulk-operations)
7. [Deleting Titles](#deleting-titles)
8. [Best Practices](#best-practices)

---

## Viewing Titles

### Accessing the Title List

1. Navigate to **Titles** from the main menu
2. The title list displays with the following information:
   - ISBN
   - Title and Author
   - Format (Paperback, Hardcover, Ebook, Audiobook)
   - Current RRP and Unit Cost
   - Publisher
   - Current Stock (if inventory exists)

### Title Details

Click on any title to view its complete details:
- **Basic Information**: ISBN, title, author, subtitle
- **Publishing Details**: Publisher, publication date, format, binding
- **Pricing**: RRP, unit cost, trade discount, royalty rate
- **Physical Specifications**: Dimensions, weight, page count
- **Commercial Terms**: Print run, reprint quantity, out of print date
- **Series Information**: Series name and order
- **Price History**: All historical price changes
- **Inventory Summary**: Current stock across all warehouses

---

## Creating a New Title

### Prerequisites

- You must have the **title:create** permission
- ISBN-13 must be unique in the system
- Required fields must be completed

### Step-by-Step Process

1. **Navigate to Create Page**
   - Click **Create Title** button on the titles list page

2. **Fill Required Fields**
   - **ISBN**: Enter valid ISBN-13 (with or without hyphens)
   - **Title**: Full title of the book
   - **Author**: Author name(s)
   - **Format**: Select from Paperback, Hardcover, Ebook, Audiobook
   - **RRP (Recommended Retail Price)**: In your currency
   - **Unit Cost**: Your cost per unit

3. **Optional Fields**
   - **Subtitle**: Book subtitle if applicable
   - **Publisher**: Publisher name
   - **Publication Date**: Original publication date
   - **Category**: Book category/genre
   - **Series**: Link to existing series
   - **Dimensions**: Format as LxWxH (e.g., 229x152x19)
   - **Weight**: In grams
   - **Page Count**: Total pages
   - **Binding**: Binding type
   - **Trade Discount**: Percentage (0-100)
   - **Royalty Rate**: Percentage (0-100)
   - **Print Run**: Initial print quantity
   - **Reprint Quantity**: Standard reprint size
   - **Out of Print Date**: If applicable

4. **Submit**
   - Click **Create Title**
   - On success, you'll be redirected to the title detail page
   - A price history entry is automatically created

### Validation Rules

- **ISBN**: Must be valid ISBN-13 with correct checksum
- **RRP & Unit Cost**: Must be positive numbers
- **Dimensions**: Must follow LxWxH format if provided
- **Percentages**: Must be between 0 and 100
- **Duplicate ISBN**: System will prevent duplicate ISBNs

---

## Editing a Title

### Prerequisites

- You must have the **title:update** permission

### Step-by-Step Process

1. **Navigate to Title Detail Page**
   - Find the title using search or list
   - Click on the title to view details

2. **Click Edit Button**
   - Located in the top-right of the detail page

3. **Modify Fields**
   - Update any field you wish to change
   - Form will be pre-populated with current values

4. **Price Changes**
   - If changing RRP or Unit Cost, provide a **Price Change Reason**
   - This ensures price history is properly tracked
   - Examples: "Annual price increase", "Promotional pricing", "Supplier cost change"

5. **Submit**
   - Click **Update Title**
   - On success, you'll be redirected to the updated detail page

### Important Notes

- **Price History**: Any change to RRP or Unit Cost creates a new price history entry
- **ISBN Changes**: You can change ISBN to a different valid, unused ISBN
- **Duplicate Prevention**: Cannot change ISBN to one already in use
- **Audit Trail**: All changes are logged in the system audit log

---

## Searching and Filtering

### Search Functionality

The search box allows you to find titles by:
- **Title**: Partial or full title match
- **Author**: Author name
- **ISBN**: Full or partial ISBN

**How to Search:**
1. Enter your search term in the search box
2. Search is case-insensitive and debounced (waits for you to stop typing)
3. Results update automatically

### Filters

Apply filters to narrow down results:

- **Format**: Filter by Paperback, Hardcover, Ebook, or Audiobook
- **Category**: Filter by book category
- **Publisher**: Filter by publisher name
- **Series**: Filter by series

**How to Filter:**
1. Select filter values from the dropdowns/inputs
2. Multiple filters can be combined
3. Click **Clear Filters** to reset all filters

### Sorting

Sort results by:
- **Title** (A-Z or Z-A)
- **Author** (A-Z or Z-A)
- **Publication Date** (Newest or Oldest)
- **Price** (Low to High or High to Low)

### Pagination

- Default: 20 titles per page
- Use page numbers or Next/Previous buttons
- Total count displayed at bottom

---

## Price History

### Viewing Price History

1. Navigate to title detail page
2. Scroll to the **Price History** section
3. View all historical price changes in chronological order (newest first)

### Price History Information

Each entry shows:
- **Effective Date**: When this price became effective
- **RRP**: Recommended retail price at that time
- **Unit Cost**: Your cost at that time
- **Reason**: Explanation for the change

### When Price History is Created

- **On Creation**: Initial price history entry with reason "Initial creation"
- **On Price Change**: New entry when RRP or Unit Cost changes during edit
- **On Bulk Update**: New entry for all titles in bulk price update

### Using Price History

- **Track Pricing Trends**: See how prices have evolved over time
- **Financial Analysis**: Calculate margins at different points in time
- **Audit Compliance**: Maintain complete pricing audit trail
- **Royalty Calculations**: Use historical prices for accurate royalty payments

---

## Bulk Operations

For detailed instructions on bulk operations, see:
- [Bulk Import Guide](./bulk-import-instructions.md)
- [Bulk Price Update](#bulk-price-update)

### Bulk Price Update

Update prices for multiple titles simultaneously:

1. **Navigate to Bulk Update** (from Titles menu)
2. **Select Titles**: Choose titles to update
3. **Enter New Prices**: Provide new RRP and/or Unit Cost
4. **Provide Reason**: Single reason applied to all updates
5. **Review and Confirm**: Check summary before submitting
6. **Submit**: All prices updated atomically
7. **View Results**: Success/failure count displayed

**Benefits:**
- Time-saving for annual price increases
- Consistent price change reasons
- Atomic operation (all succeed or all fail)
- Price history maintained for all titles

---

## Deleting Titles

### Prerequisites

- You must have the **title:delete** permission
- Title must have **zero inventory** across all warehouses

### Step-by-Step Process

1. **Navigate to Title Detail Page**
2. **Click Delete Button**
3. **Confirmation Dialog Appears**
   - Shows warning if inventory exists
   - Explains that price history will also be deleted
4. **Confirm Deletion**
   - Click **Confirm** to proceed
   - Click **Cancel** to abort

### Deletion Rules

**Cannot Delete If:**
- Title has current stock > 0 in any warehouse
- Title has reserved stock > 0
- Title has committed stock > 0

**Error Message:**
"Cannot delete title with existing inventory. Please deplete all inventory before deleting this title."

**What Gets Deleted:**
- Title record
- All price history entries
- Any series associations (title removed from series)

**What's Preserved:**
- Audit log entries (for compliance)
- Historical sales data (references will show deleted title)

### Best Practices

- **Check Inventory First**: Use the inventory summary to verify zero stock
- **Consider Archiving**: Instead of deleting, mark title as out of print
- **Export Data**: Create a backup export before deleting important titles
- **Deplete Inventory**: Adjust inventory to zero across all warehouses before deleting

---

## Best Practices

### ISBN Management

- **Always Verify ISBN**: Double-check ISBN-13 before creation
- **Use Hyphens**: System accepts hyphens and normalizes automatically
- **ISBN-10 Conversion**: If you have ISBN-10, convert to ISBN-13 first
- **Unique ISBNs**: Each edition (paperback, hardcover) needs unique ISBN

### Data Entry

- **Complete All Fields**: Fill optional fields for better reporting
- **Consistent Naming**: Use consistent format for author names and publishers
- **Series Management**: Link titles to series for better organization
- **Categories**: Use standardized category names across titles

### Price Management

- **Document Changes**: Always provide clear price change reasons
- **Regular Reviews**: Review pricing regularly, especially before reprints
- **Cost Tracking**: Update unit costs when supplier prices change
- **Margin Analysis**: Monitor margins using price history data

### Search and Organization

- **Use Categories**: Assign categories for easier filtering
- **Link Series**: Connect series titles for cross-reference
- **Tag Publishers**: Group titles by publisher for reporting
- **Regular Cleanup**: Archive or delete obsolete titles

### Bulk Operations

- **Start Small**: Test with small batches before large imports
- **Validate Data**: Check CSV format and ISBN validity before import
- **Error Reports**: Download and fix errors before retrying
- **Backup First**: Export current data before bulk updates

### Performance Tips

- **Use Filters**: Narrow results with filters for faster loading
- **Pagination**: Work with paginated results for better performance
- **Search Specificity**: Use specific search terms for faster results
- **Cache Awareness**: System caches common queries for speed

---

## Troubleshooting

### Common Issues

**"Invalid ISBN-13 checksum"**
- Verify ISBN has correct 13 digits
- Check last digit (checksum) is correct
- Use ISBN validator tool if unsure

**"Title with ISBN already exists"**
- Check if title already in system
- If duplicate, edit existing instead of creating new
- If different edition, verify ISBN is correct

**"Cannot delete title with existing inventory"**
- Check inventory summary on detail page
- Deplete inventory across all warehouses
- Ensure reserved and committed stock also zero

**"Price change reason is required"**
- Must provide reason when changing RRP or Unit Cost
- Helps maintain accurate price history audit trail

**Search returns no results**
- Check spelling
- Try partial matches
- Clear filters and try again
- Verify title exists in system

---

## Keyboard Shortcuts

- **Ctrl/Cmd + K**: Focus search box
- **Enter**: Submit form
- **Esc**: Close dialogs
- **Tab**: Navigate between fields

---

## Support

For additional help:
- Contact your system administrator
- See [API Documentation](./api-endpoints.md) for integration details
- See [ISBN Validation Rules](./isbn-validation.md) for ISBN requirements

---

**Last Updated**: January 2025
**Version**: 1.0
