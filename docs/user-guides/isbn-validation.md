# ISBN Validation Rules

## Overview

ISBN (International Standard Book Number) is a unique identifier for books. BookStock uses ISBN-13 format exclusively for identifying titles. This document explains the validation rules, formats, and common issues.

## Table of Contents

1. [ISBN-13 Format](#isbn-13-format)
2. [Validation Rules](#validation-rules)
3. [Checksum Calculation](#checksum-calculation)
4. [ISBN-10 to ISBN-13 Conversion](#isbn-10-to-isbn-13-conversion)
5. [Formatting and Normalization](#formatting-and-normalization)
6. [Common Issues](#common-issues)
7. [Validation Examples](#validation-examples)
8. [Tools and Resources](#tools-and-resources)

---

## ISBN-13 Format

### Structure

ISBN-13 consists of **13 digits** organized into 5 parts:

```
978-0-306-40615-7
│││ │ │   │││││ │
│││ │ │   │││││ └─ Check digit
│││ │ │   │││││
│││ │ │   ││││└─── Item number (variable length)
│││ │ │   │││└──── Title identifier
│││ │ │   ││└───── Publisher identifier
│││ │ │   │└────── Registration group
│││ │ │   └─────── Publisher prefix
│││ │ └─────────── Group identifier
│││ └───────────── EAN prefix (978 or 979 for books)
││└─────────────── GS1 prefix
│└──────────────── Bookland
└───────────────── EAN prefix
```

### Components

1. **GS1 Prefix** (3 digits): `978` or `979` for books
2. **Registration Group** (1-5 digits): Language/country identifier
3. **Registrant** (variable): Publisher identifier
4. **Publication** (variable): Title identifier
5. **Check Digit** (1 digit): Calculated validation digit

### Format Variations

**With Hyphens:**
```
978-0-306-40615-7
```

**Without Hyphens:**
```
9780306406157
```

Both formats are valid. BookStock normalizes all ISBNs by removing hyphens for storage.

---

## Validation Rules

### Required Format

✅ **Must be exactly 13 digits**

```
Valid:   9780306406157
Invalid: 978030640615      (12 digits)
Invalid: 97803064061573    (14 digits)
```

✅ **Must start with 978 or 979**

```
Valid:   9780306406157     (starts with 978)
Valid:   9791234567890     (starts with 979)
Invalid: 9800306406157     (starts with 980)
Invalid: 9770306406157     (starts with 977)
```

✅ **Must contain only digits (after removing hyphens)**

```
Valid:   9780306406157
Valid:   978-0-306-40615-7
Invalid: 978-0-306-4061X-7 (contains X)
Invalid: 978A306406157     (contains letter)
```

✅ **Must have valid checksum**

The last digit must match the calculated checksum (see [Checksum Calculation](#checksum-calculation)).

```
Valid:   9780306406157     (checksum: 7)
Invalid: 9780306406158     (checksum: 7, but has 8)
```

### Uniqueness Rules

✅ **Must be unique in system**

- No duplicate ISBNs allowed
- Each edition needs unique ISBN
- Different formats (paperback vs hardcover) need different ISBNs

---

## Checksum Calculation

### Algorithm

The ISBN-13 checksum uses a modulo 10 algorithm with weights of 1 and 3.

### Steps

1. Take first 12 digits
2. Multiply alternating digits by 1 and 3
3. Sum all products
4. Calculate: `10 - (sum % 10)`
5. If result is 10, checksum is 0

### Formula

```
Check digit = 10 - ((Σ(digit × weight)) % 10)
```

where weights alternate: 1, 3, 1, 3, 1, 3, ...

### Example Calculation

**ISBN**: 978-0-306-40615-7

```
Position: 1   2   3   4   5   6   7   8   9  10  11  12  13
Digit:    9   7   8   0   3   0   6   4   0   6   1   5   ?
Weight:   1   3   1   3   1   3   1   3   1   3   1   3   -
Product:  9  21   8   0   3   0   6  12   0  18   1  15   -

Sum = 9 + 21 + 8 + 0 + 3 + 0 + 6 + 12 + 0 + 18 + 1 + 15 = 93

Check digit = 10 - (93 % 10)
            = 10 - 3
            = 7
```

**Result**: The check digit is **7**, so the complete ISBN is **9780306406157**.

### JavaScript Implementation

```javascript
function calculateISBN13Checksum(isbn12) {
  // Remove any hyphens and take first 12 digits
  const digits = isbn12.replace(/-/g, '').slice(0, 12);

  if (digits.length !== 12) {
    throw new Error('Must provide 12 digits');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i], 10);
    const weight = (i % 2 === 0) ? 1 : 3;
    sum += digit * weight;
  }

  const checksum = (10 - (sum % 10)) % 10;
  return checksum;
}

// Example usage
const isbn12 = '978030640615';
const checksum = calculateISBN13Checksum(isbn12);
console.log(checksum);  // Output: 7
console.log(`${isbn12}${checksum}`);  // Output: 9780306406157
```

### Validation Implementation

```javascript
function validateISBN13(isbn) {
  // Remove hyphens
  const cleaned = isbn.replace(/-/g, '');

  // Check length
  if (cleaned.length !== 13) {
    return false;
  }

  // Check all digits
  if (!/^\d{13}$/.test(cleaned)) {
    return false;
  }

  // Check prefix
  if (!cleaned.startsWith('978') && !cleaned.startsWith('979')) {
    return false;
  }

  // Check checksum
  const providedChecksum = parseInt(cleaned[12], 10);
  const calculatedChecksum = calculateISBN13Checksum(cleaned.slice(0, 12));

  return providedChecksum === calculatedChecksum;
}

// Example usage
console.log(validateISBN13('9780306406157'));  // true
console.log(validateISBN13('9780306406158'));  // false
console.log(validateISBN13('978-0-306-40615-7'));  // true
```

---

## ISBN-10 to ISBN-13 Conversion

### Why Convert?

- Older books may have ISBN-10
- ISBN-10 was used before 2007
- BookStock requires ISBN-13
- Simple conversion process

### Conversion Steps

1. Remove check digit from ISBN-10 (last character)
2. Add `978` prefix
3. Calculate new ISBN-13 checksum
4. Append checksum

### Example Conversion

**ISBN-10**: 0-306-40615-2

```
Step 1: Remove check digit
        0306406150306406157

Step 2: Add 978 prefix
        9780306406150306406157

Step 3: Calculate checksum (using ISBN-13 algorithm)
        Checksum = 7

Step 4: Result
        978-0-306-40615-7
```

### JavaScript Implementation

```javascript
function convertISBN10ToISBN13(isbn10) {
  // Remove hyphens and check digit
  const cleaned = isbn10.replace(/-/g, '').slice(0, 9);

  if (cleaned.length !== 9) {
    throw new Error('Invalid ISBN-10 format');
  }

  // Add 978 prefix
  const isbn12 = '978' + cleaned;

  // Calculate new checksum
  const checksum = calculateISBN13Checksum(isbn12);

  // Return ISBN-13
  return isbn12 + checksum;
}

// Example usage
const isbn10 = '0-306-40615-2';
const isbn13 = convertISBN10ToISBN13(isbn10);
console.log(isbn13);  // Output: 9780306406157
```

### Special Cases

**ISBN-10 with 'X' check digit:**

ISBN-10 can have 'X' as check digit (represents 10). This is removed during conversion.

```
Input:  0-306-40615-X
Output: 9780306406157
```

---

## Formatting and Normalization

### Hyphenation Rules

Hyphens in ISBN-13 separate the components but are optional:

```
Formatted:   978-0-306-40615-7
Normalized:  9780306406157
```

**Hyphen Positions:**
- After GS1 prefix (position 3)
- After registration group (variable)
- After registrant (variable)
- Before check digit (position 12)

### Normalization Process

BookStock normalizes all ISBNs for storage:

1. Remove all hyphens
2. Remove all spaces
3. Convert to uppercase (if any letters)
4. Validate length and checksum
5. Store as 13-digit string

```javascript
function normalizeISBN(isbn) {
  // Remove hyphens and spaces
  let normalized = isbn.replace(/[-\s]/g, '');

  // Convert to uppercase (for ISBN-10 with X)
  normalized = normalized.toUpperCase();

  return normalized;
}

// Example usage
console.log(normalizeISBN('978-0-306-40615-7'));  // 9780306406157
console.log(normalizeISBN('978 0 306 40615 7'));  // 9780306406157
```

### Display Formatting

For display purposes, ISBNs can be formatted with hyphens:

```javascript
function formatISBN13(isbn) {
  const cleaned = normalizeISBN(isbn);

  if (cleaned.length !== 13) {
    return isbn;  // Return original if invalid
  }

  // Basic formatting (978-X-XXX-XXXXX-X)
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7, 12)}-${cleaned.slice(12)}`;
}

// Example usage
console.log(formatISBN13('9780306406157'));
// Output: 978-0-306-40615-7
```

---

## Common Issues

### Issue: "Invalid ISBN-13 checksum"

**Cause**: The check digit doesn't match the calculated checksum.

**Solution**:
1. Verify you have the correct ISBN (check book cover)
2. Try recalculating the checksum
3. Check for typos in digits
4. Use ISBN validation tool

**Example**:
```
Error:    9780306406158  (checksum should be 7, not 8)
Correct:  9780306406157
```

### Issue: "ISBN must be 13 digits"

**Cause**: ISBN has wrong number of digits.

**Solution**:
- If 10 digits: Convert ISBN-10 to ISBN-13
- If 12 digits: Add check digit
- If more than 13: Remove extra characters

**Examples**:
```
10 digits: 0306406157     → Convert to ISBN-13
12 digits: 978030640615   → Add checksum: 9780306406157
14 digits: 97803064061577 → Remove extra digit
```

### Issue: "ISBN must start with 978 or 979"

**Cause**: Invalid GS1 prefix.

**Solution**:
- Verify ISBN is for a book (not magazine/music)
- Check if ISBN-10 needs conversion
- Verify source of ISBN

**Examples**:
```
Invalid: 9770306406157 (starts with 977 - magazines)
Invalid: 9800306406157 (starts with 980 - invalid)
Valid:   9780306406157 (starts with 978)
Valid:   9791234567890 (starts with 979)
```

### Issue: "Title with ISBN already exists"

**Cause**: ISBN is not unique in system.

**Solution**:
- Check if title already exists
- Verify ISBN is correct
- Use different ISBN for different edition
- Edit existing title instead of creating new one

### Issue: Contains non-digit characters

**Cause**: ISBN contains letters or special characters (except hyphens).

**Solution**:
- Remove non-digit characters (except hyphens)
- Verify ISBN from reliable source
- Check for OCR errors if scanned

**Examples**:
```
Invalid: 978-0-306-4061X-7 (X not valid in ISBN-13)
Invalid: 978A306406157     (letter A)
Invalid: 978.0.306.40615.7 (periods instead of hyphens)
Valid:   978-0-306-40615-7
Valid:   9780306406157
```

---

## Validation Examples

### Valid ISBNs

```
✅ 9780306406157                 (normalized)
✅ 978-0-306-40615-7            (formatted)
✅ 978 0 306 40615 7            (spaced)
✅ 9791234567890                (979 prefix)
✅ 979-10-90636-07-1            (979 prefix formatted)
```

### Invalid ISBNs

```
❌ 978030640615                 (12 digits - missing check digit)
❌ 97803064061577               (14 digits - too long)
❌ 0306406157                   (10 digits - needs conversion)
❌ 9780306406158                (wrong checksum - should be 7)
❌ 9770306406157                (wrong prefix - should be 978/979)
❌ 978-0-306-4061X-7            (X not valid in ISBN-13)
❌ 978A306406157                (contains letter A)
❌ 978.0.306.40615.7            (periods instead of hyphens)
❌ abc-def-ghi-jkl-m            (all letters)
❌ 978 0306 40615 7            (wrong spacing/format)
```

---

## Tools and Resources

### Online Validators

1. **ISBN Check**: https://www.isbn-check.com
2. **ISBN Search**: https://isbnsearch.org
3. **ISBN.org**: https://www.isbn.org

### Validation Libraries

**JavaScript/TypeScript:**
```bash
npm install isbn3
```

```typescript
import { ISBN } from 'isbn3';

const isValid = ISBN.validate('9780306406157');
const isbn13 = ISBN.asIsbn13('0306406157', true);
```

**Python:**
```bash
pip install isbnlib
```

```python
import isbnlib

is_valid = isbnlib.is_isbn13('9780306406157')
isbn13 = isbnlib.to_isbn13('0306406157')
```

### BookStock Validation API

```bash
curl -X POST "https://your-domain.com/api/validate/isbn" \
  -H "Content-Type: application/json" \
  -d '{"isbn": "9780306406157"}'
```

Response:
```json
{
  "valid": true,
  "isbn13": "9780306406157",
  "formatted": "978-0-306-40615-7",
  "prefix": "978",
  "group": "0",
  "publisher": "306",
  "title": "40615",
  "checkDigit": "7"
}
```

### Excel Formula

For validating ISBNs in Excel:

```excel
=IF(LEN(A1)=13,
    IF(MOD(SUMPRODUCT(--MID(A1,ROW($1:$12),1),{1;3;1;3;1;3;1;3;1;3;1;3}),10)=0,
        "Valid",
        "Invalid Checksum"),
    "Must be 13 digits")
```

---

## Best Practices

### For Users

✅ **Always double-check ISBNs** before entering
✅ **Use copy-paste** from reliable sources when possible
✅ **Verify checksum** using online tools
✅ **Keep hyphens** when copying (system handles normalization)
✅ **Convert ISBN-10** to ISBN-13 before importing
✅ **Use barcode scanners** for accurate entry
✅ **Check book cover** for correct ISBN
✅ **Verify uniqueness** before creating title

### For Developers

✅ **Normalize on input** - remove hyphens/spaces immediately
✅ **Validate on both client and server**
✅ **Provide clear error messages**
✅ **Support both formats** (with/without hyphens)
✅ **Calculate checksum** server-side for security
✅ **Index ISBN** for fast duplicate detection
✅ **Log validation failures** for debugging
✅ **Cache validation results** for performance

---

## FAQ

**Q: Can I use ISBN-10?**
A: No, convert to ISBN-13 first. Use our conversion tool or API.

**Q: Why does my ISBN fail validation?**
A: Most common reasons are wrong checksum, wrong length, or invalid prefix. Use our validator tool.

**Q: Are hyphens required?**
A: No, hyphens are optional. System accepts both formats.

**Q: Can I have multiple titles with same ISBN?**
A: No, each ISBN must be unique. Different editions need different ISBNs.

**Q: What about ebooks and audiobooks?**
A: They need separate ISBNs from print editions.

**Q: How do I find an ISBN?**
A: Check book cover, copyright page, or use ISBN database search.

**Q: Can I change an ISBN?**
A: Yes, but carefully. Ensure new ISBN is valid and unique.

**Q: What if a book doesn't have an ISBN?**
A: Old books (pre-1970) may not have ISBNs. Contact your publisher for assignment.

---

## Support

For ISBN validation support:
- See [Title Management User Guide](./title-management.md)
- See [Bulk Import Instructions](./bulk-import-instructions.md)
- See [API Documentation](./api-endpoints.md)
- Contact: support@bookstock.com

---

**Last Updated**: January 2025
**Version**: 1.0
