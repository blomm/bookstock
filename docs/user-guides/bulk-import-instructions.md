# Bulk Import Instructions

## Overview

The Bulk Import feature allows you to import multiple titles at once using a CSV file. This is ideal for:
- Initial system setup with existing catalog
- Adding multiple new titles from supplier catalogs
- Updating large numbers of titles efficiently

## Table of Contents

1. [Before You Start](#before-you-start)
2. [CSV Format Requirements](#csv-format-requirements)
3. [Step-by-Step Import Process](#step-by-step-import-process)
4. [Handling Errors](#handling-errors)
5. [Best Practices](#best-practices)
6. [CSV Template](#csv-template)
7. [Field Descriptions](#field-descriptions)

---

## Before You Start

### Prerequisites

- You must have the **title:create** permission
- Prepare your data in CSV format
- Validate ISBN numbers before importing
- Have a backup of your existing data

### What You Need

1. **CSV File**: Properly formatted with required columns
2. **Valid Data**: All required fields must be present
3. **Unique ISBNs**: No duplicates in file or system
4. **Network Connection**: Stable connection for upload

### Import Limits

- **Maximum File Size**: 10 MB
- **Maximum Titles per Import**: 1000 titles
- **Recommended Batch Size**: 100-200 titles for best performance
- **File Format**: CSV (Comma-Separated Values) only

---

## CSV Format Requirements

### Required Columns

The following columns MUST be present in your CSV:

| Column | Format | Example | Description |
|--------|--------|---------|-------------|
| `isbn` | 13 digits | 9780306406157 | ISBN-13 (with or without hyphens) |
| `title` | Text | "React Programming Guide" | Book title |
| `author` | Text | "John Smith" | Author name(s) |
| `format` | Enum | PAPERBACK | One of: PAPERBACK, HARDCOVER, EBOOK, AUDIOBOOK |
| `rrp` | Decimal | 29.99 | Recommended retail price |
| `unitCost` | Decimal | 8.50 | Your cost per unit |

### Optional Columns

| Column | Format | Example | Description |
|--------|--------|---------|-------------|
| `subtitle` | Text | "A Comprehensive Guide" | Book subtitle |
| `publisher` | Text | "Tech Books Inc" | Publisher name |
| `publicationDate` | Date | 2024-01-15 | Format: YYYY-MM-DD |
| `category` | Text | "Technology" | Book category/genre |
| `series` | Text | "React Mastery Series" | Series name |
| `seriesOrder` | Number | 1 | Position in series |
| `dimensions` | Text | 229x152x19 | Format: LxWxH in mm |
| `weight` | Number | 450 | Weight in grams |
| `pageCount` | Number | 350 | Total pages |
| `binding` | Text | "Perfect Binding" | Binding type |
| `tradeDiscount` | Decimal | 40.0 | Percentage (0-100) |
| `royaltyRate` | Decimal | 10.0 | Percentage (0-100) |
| `printRun` | Number | 5000 | Initial print quantity |
| `reprintQuantity` | Number | 2000 | Standard reprint size |
| `outOfPrintDate` | Date | 2025-12-31 | Format: YYYY-MM-DD |

### Format Specifications

**ISBN:**
- Can include or omit hyphens (system normalizes)
- Must be valid ISBN-13 with correct checksum
- Examples: `9780306406157` or `978-0-306-40615-7`

**Format Values:**
- Must be exactly: `PAPERBACK`, `HARDCOVER`, `EBOOK`, or `AUDIOBOOK`
- Case-sensitive (use UPPERCASE)

**Dates:**
- Format: `YYYY-MM-DD` (ISO 8601)
- Examples: `2024-01-15`, `2023-12-25`

**Dimensions:**
- Format: `LxWxH` (length x width x height in millimeters)
- Example: `229x152x19`
- No spaces, lowercase 'x'

**Numbers:**
- Use period (.) for decimal separator
- No commas in numbers
- Examples: `29.99`, `8.50`, `350`

**Text Fields:**
- Enclose in quotes if containing commas
- Example: `"Smith, John"` or `"Book Title: A Guide"`

---

## Step-by-Step Import Process

### Step 1: Prepare Your CSV File

1. **Download Template**
   - Navigate to **Titles > Bulk Import**
   - Click **Download CSV Template**
   - Save template to your computer

2. **Fill in Your Data**
   - Open template in Excel, Google Sheets, or text editor
   - Add your title data row by row
   - Ensure all required columns have values
   - Validate ISBN numbers

3. **Save as CSV**
   - File > Save As > CSV (Comma delimited)
   - UTF-8 encoding recommended
   - Verify file extension is `.csv`

### Step 2: Upload File

1. **Navigate to Import Page**
   - Click **Titles** in main menu
   - Click **Bulk Import** button

2. **Select File**
   - Click **Choose File** or drag-and-drop
   - Select your prepared CSV file
   - Maximum 10 MB file size

3. **File Validation**
   - System validates file format
   - Checks for required columns
   - Parses data for preview

### Step 3: Preview and Validate

1. **Review Preview**
   - First 10 rows displayed
   - Check data appears correct
   - Verify column mapping

2. **Validation Summary**
   - Total titles found
   - Validation warnings displayed
   - Common issues highlighted

3. **Fix Issues**
   - If errors found, download error report
   - Fix issues in your CSV
   - Re-upload corrected file

### Step 4: Import

1. **Click Import Button**
   - Confirm you want to proceed
   - Import begins processing

2. **Monitor Progress**
   - Progress bar shows percentage complete
   - Estimated time remaining displayed
   - Do not close browser during import

3. **Review Results**
   - Success count displayed
   - Failed count displayed
   - Detailed error report available

### Step 5: Handle Errors (if any)

1. **Download Error Report**
   - Click **Download Errors**
   - CSV contains only failed rows
   - Error message for each row

2. **Fix Errors**
   - Common errors listed in report
   - Fix data in original CSV
   - Remove successful imports

3. **Re-import**
   - Upload corrected file
   - Only failed titles re-imported
   - Repeat until all successful

---

## Handling Errors

### Common Errors and Solutions

**Invalid ISBN-13 checksum**
- **Cause**: ISBN checksum digit incorrect
- **Solution**: Verify ISBN is correct, recalculate checksum
- **Tool**: Use ISBN validator tool

**Title with ISBN already exists**
- **Cause**: ISBN already in system or duplicate in file
- **Solution**: Check existing titles, use unique ISBN
- **Action**: Edit existing title instead of importing

**Invalid format value**
- **Cause**: Format not one of: PAPERBACK, HARDCOVER, EBOOK, AUDIOBOOK
- **Solution**: Use exact uppercase values
- **Example**: Change "paperback" to "PAPERBACK"

**Missing required field**
- **Cause**: Required column empty or missing
- **Solution**: Ensure all required fields have values
- **Check**: isbn, title, author, format, rrp, unitCost

**Invalid date format**
- **Cause**: Date not in YYYY-MM-DD format
- **Solution**: Convert dates to ISO format
- **Example**: Convert "15/01/2024" to "2024-01-15"

**Invalid dimensions format**
- **Cause**: Dimensions not in LxWxH format
- **Solution**: Use correct format with lowercase 'x'
- **Example**: Change "229*152*19" to "229x152x19"

**Negative price value**
- **Cause**: RRP or unitCost is negative
- **Solution**: Use positive numbers only
- **Check**: Ensure no minus signs in price columns

**Percentage out of range**
- **Cause**: tradeDiscount or royaltyRate not between 0-100
- **Solution**: Use valid percentage values
- **Example**: Use "40" not "0.40" for 40%

### Error Report Format

The error report CSV contains:

| Column | Description |
|--------|-------------|
| `row_number` | Original row number from your CSV |
| `isbn` | ISBN from failed row |
| `title` | Title from failed row |
| `error` | Detailed error message |
| `suggestion` | How to fix the error |

---

## Best Practices

### Before Import

✅ **Validate ISBNs**: Check all ISBNs are valid before importing
✅ **Remove Duplicates**: Ensure no duplicate ISBNs in your file
✅ **Check Existing Data**: Verify ISBNs don't already exist in system
✅ **Test Small Batch**: Try importing 5-10 titles first
✅ **Backup Data**: Export current titles before bulk import
✅ **Use Template**: Start with official CSV template

### During Import

✅ **Stable Connection**: Use reliable network connection
✅ **Don't Close Browser**: Keep browser tab open during import
✅ **Monitor Progress**: Watch for errors during processing
✅ **Note Success Count**: Record how many succeeded for verification

### After Import

✅ **Verify Imports**: Check few random titles were imported correctly
✅ **Review Errors**: Download and analyze error report
✅ **Fix and Retry**: Correct errors and re-import failed titles
✅ **Check Price History**: Verify price history created for all titles
✅ **Update Series**: Link to series if not done in CSV

### Data Quality

✅ **Consistent Naming**: Use consistent format for authors/publishers
✅ **Complete Data**: Fill optional fields for better reporting
✅ **Valid Formats**: Use correct format enum values
✅ **Accurate Prices**: Double-check RRP and unit costs
✅ **Date Formats**: Use ISO date format (YYYY-MM-DD)
✅ **No Special Characters**: Avoid special characters in critical fields

### Performance Tips

✅ **Batch Size**: Import 100-200 titles at a time
✅ **Off-Peak Hours**: Import during low-traffic times
✅ **File Size**: Keep files under 5 MB for best performance
✅ **CSV Encoding**: Use UTF-8 encoding
✅ **Remove Empty Rows**: Delete blank rows from CSV

---

## CSV Template

### Download Link

**Template File**: [title-import-template.csv](../templates/title-import-template.csv)

### Sample Data

```csv
isbn,title,author,format,rrp,unitCost,publisher,category,pageCount,publicationDate
9780306406157,"React Programming Guide","John Smith",PAPERBACK,29.99,8.50,"Tech Books Inc","Technology",350,2024-01-15
9780306406164,"Vue.js Masterclass","Jane Doe",HARDCOVER,39.99,12.00,"Tech Books Inc","Technology",420,2024-02-20
9780306406171,"Angular Development","Bob Johnson",EBOOK,19.99,5.00,"Digital Press","Technology",280,2024-03-10
```

### Template with All Fields

```csv
isbn,title,subtitle,author,format,rrp,unitCost,publisher,publicationDate,category,series,seriesOrder,dimensions,weight,pageCount,binding,tradeDiscount,royaltyRate,printRun,reprintQuantity,outOfPrintDate
9780306406157,"React Programming Guide","A Comprehensive Introduction","John Smith",PAPERBACK,29.99,8.50,"Tech Books Inc",2024-01-15,"Technology","React Series",1,229x152x19,450,350,"Perfect Binding",40.0,10.0,5000,2000,
9780306406164,"Vue.js Masterclass","Advanced Techniques","Jane Doe",HARDCOVER,39.99,12.00,"Tech Books Inc",2024-02-20,"Technology",,,,550,420,"Case Binding",40.0,12.0,3000,1500,
9780306406171,"Angular Development","From Basics to Expert","Bob Johnson",EBOOK,19.99,5.00,"Digital Press",2024-03-10,"Technology","Angular Series",1,,,280,"Digital",45.0,15.0,,,
```

---

## Field Descriptions

### Required Fields

**isbn**
- 13-digit ISBN number (ISBN-13)
- Can include hyphens (system will normalize)
- Must be unique in file and system
- Must pass checksum validation

**title**
- Full title of the book
- Enclose in quotes if contains commas
- Maximum 255 characters

**author**
- Author name(s)
- Use comma-space to separate multiple authors
- Example: "Smith, John and Doe, Jane"

**format**
- Book format type
- Valid values: `PAPERBACK`, `HARDCOVER`, `EBOOK`, `AUDIOBOOK`
- Must be uppercase

**rrp**
- Recommended Retail Price
- Positive decimal number
- Use period (.) for decimal
- Example: `29.99`

**unitCost**
- Your cost per unit
- Positive decimal number
- Must be less than or equal to RRP typically
- Example: `8.50`

### Optional Fields

**subtitle**
- Book subtitle
- Enclose in quotes if contains commas

**publisher**
- Publisher name
- Will be standardized across system

**publicationDate**
- Original publication date
- Format: YYYY-MM-DD
- Example: `2024-01-15`

**category**
- Book category or genre
- Use consistent categories across imports

**series**
- Series name
- System will create series if it doesn't exist

**seriesOrder**
- Position in series
- Positive integer
- Example: `1` for first book

**dimensions**
- Physical dimensions
- Format: LxWxH in millimeters
- Example: `229x152x19`

**weight**
- Book weight in grams
- Positive integer
- Example: `450`

**pageCount**
- Total number of pages
- Positive integer
- Example: `350`

**binding**
- Binding type
- Examples: "Perfect Binding", "Case Binding", "Digital"

**tradeDiscount**
- Trade discount percentage
- Range: 0-100
- Example: `40.0` for 40%

**royaltyRate**
- Royalty rate percentage
- Range: 0-100
- Example: `10.0` for 10%

**printRun**
- Initial print quantity
- Positive integer
- Example: `5000`

**reprintQuantity**
- Standard reprint size
- Positive integer
- Example: `2000`

**outOfPrintDate**
- Date title goes out of print
- Format: YYYY-MM-DD
- Leave empty if still in print

---

## Troubleshooting

### Upload Issues

**File too large**
- Split into multiple smaller files
- Remove unnecessary columns
- Compress large text fields

**File format not recognized**
- Ensure file extension is `.csv`
- Re-save as CSV from Excel
- Check file encoding is UTF-8

**Column headers not recognized**
- Verify header row exactly matches template
- Check for extra spaces in column names
- Ensure no special characters in headers

### Data Issues

**All rows failing**
- Check required columns present
- Verify format column uses correct values
- Ensure ISBN column has valid data

**Some rows succeeding, others failing**
- Download error report
- Fix specific errors listed
- Re-import only failed rows

**Import hangs or times out**
- Reduce batch size
- Check network connection
- Try during off-peak hours

---

## Support

For additional help:
- Contact your system administrator
- See [Title Management User Guide](./title-management.md)
- See [ISBN Validation Rules](./isbn-validation.md)
- See [API Documentation](./api-endpoints.md)

---

**Last Updated**: January 2025
**Version**: 1.0
