import { isISBN } from 'isbn3'

// Types for external metadata sources
export interface EnrichedMetadata {
  title?: string
  subtitle?: string
  author?: string
  publisher?: string
  publicationYear?: number
  description?: string
  pageCount?: number
  language?: string
  category?: string
  subcategory?: string
  dimensions?: string
  weight?: number
  coverImageUrl?: string
  subjects?: string[]
  awards?: string[]
  reviews?: {
    source: string
    rating?: number
    excerpt?: string
  }[]
  series?: {
    name: string
    volume?: number
    order?: number
  }
  relatedISBNs?: string[]
  availability?: {
    inPrint: boolean
    publisherStock?: number
    lastUpdated: Date
  }
}

export interface MetadataSource {
  name: string
  priority: number
  available: boolean
  rateLimited: boolean
  lastRequest?: Date
}

// Mock external API responses (in real implementation, these would be actual API calls)
interface GoogleBooksResponse {
  totalItems: number
  items?: Array<{
    volumeInfo: {
      title: string
      subtitle?: string
      authors?: string[]
      publisher?: string
      publishedDate?: string
      description?: string
      pageCount?: number
      categories?: string[]
      language?: string
      imageLinks?: {
        thumbnail?: string
        small?: string
        medium?: string
        large?: string
      }
      dimensions?: {
        height?: string
        width?: string
        thickness?: string
      }
      industryIdentifiers?: Array<{
        type: string
        identifier: string
      }>
    }
    saleInfo?: {
      country: string
      saleability: string
      isEbook: boolean
      listPrice?: {
        amount: number
        currencyCode: string
      }
    }
  }>
}

interface OpenLibraryResponse {
  title?: string
  authors?: Array<{ name: string }>
  publishers?: string[]
  publish_date?: string
  number_of_pages?: number
  subjects?: string[]
  description?: string | { value: string }
  languages?: Array<{ key: string }>
  weight?: string
  physical_dimensions?: string
  series?: string[]
  covers?: number[]
}

export class MetadataEnrichmentService {
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  private static cache = new Map<string, { data: EnrichedMetadata; timestamp: number }>()

  // Available metadata sources (in order of preference)
  private static sources: MetadataSource[] = [
    { name: 'Google Books', priority: 1, available: true, rateLimited: false },
    { name: 'Open Library', priority: 2, available: true, rateLimited: false },
    { name: 'WorldCat', priority: 3, available: false, rateLimited: true }, // Not implemented
    { name: 'Nielsen BookData', priority: 4, available: false, rateLimited: true }, // Not implemented
    { name: 'Publisher Catalogs', priority: 5, available: false, rateLimited: false } // Not implemented
  ]

  // Main enrichment method
  static async enrichMetadata(isbn: string): Promise<EnrichedMetadata | null> {
    const normalizedISBN = isbn.replace(/[-\s]/g, '')

    if (!isISBN(normalizedISBN)) {
      throw new Error('Invalid ISBN format')
    }

    // Check cache first
    const cached = this.getCachedMetadata(normalizedISBN)
    if (cached) {
      return cached
    }

    let enrichedData: EnrichedMetadata = {}

    // Try each source in priority order
    for (const source of this.sources.filter(s => s.available && !s.rateLimited)) {
      try {
        let sourceData: Partial<EnrichedMetadata> = {}

        switch (source.name) {
          case 'Google Books':
            sourceData = await this.fetchFromGoogleBooks(normalizedISBN)
            break
          case 'Open Library':
            sourceData = await this.fetchFromOpenLibrary(normalizedISBN)
            break
          default:
            continue
        }

        // Merge data, preferring higher priority sources
        enrichedData = this.mergeMetadata(enrichedData, sourceData)

        // Mark source as recently used
        source.lastRequest = new Date()
      } catch (error) {
        console.warn(`Failed to fetch from ${source.name}:`, error)
        continue
      }
    }

    // Cache the result
    this.setCachedMetadata(normalizedISBN, enrichedData)

    return Object.keys(enrichedData).length > 0 ? enrichedData : null
  }

  // Fetch from Google Books API (mock implementation)
  private static async fetchFromGoogleBooks(isbn: string): Promise<Partial<EnrichedMetadata>> {
    // In real implementation, this would make actual API call
    // const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
    // const data: GoogleBooksResponse = await response.json()

    // Mock response for demonstration
    const mockResponse: GoogleBooksResponse = {
      totalItems: 1,
      items: [{
        volumeInfo: {
          title: 'Sample Book Title',
          subtitle: 'A Comprehensive Guide',
          authors: ['John Smith', 'Jane Doe'],
          publisher: 'Sample Publishing',
          publishedDate: '2024-01-15',
          description: 'This is a comprehensive guide to the subject matter...',
          pageCount: 320,
          categories: ['Technology', 'Programming'],
          language: 'en',
          imageLinks: {
            thumbnail: 'https://example.com/cover-thumb.jpg',
            small: 'https://example.com/cover-small.jpg'
          },
          dimensions: {
            height: '23.4 cm',
            width: '15.6 cm',
            thickness: '2.4 cm'
          }
        }
      }]
    }

    // Parse mock response
    if (mockResponse.totalItems > 0 && mockResponse.items) {
      const item = mockResponse.items[0]
      const volumeInfo = item.volumeInfo

      return {
        title: volumeInfo.title,
        subtitle: volumeInfo.subtitle,
        author: volumeInfo.authors?.join(', '),
        publisher: volumeInfo.publisher,
        publicationYear: volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.split('-')[0]) : undefined,
        description: volumeInfo.description,
        pageCount: volumeInfo.pageCount,
        language: volumeInfo.language,
        category: volumeInfo.categories?.[0],
        subcategory: volumeInfo.categories?.[1],
        dimensions: this.parseDimensions(volumeInfo.dimensions),
        coverImageUrl: volumeInfo.imageLinks?.small || volumeInfo.imageLinks?.thumbnail
      }
    }

    return {}
  }

  // Fetch from Open Library API (mock implementation)
  private static async fetchFromOpenLibrary(isbn: string): Promise<Partial<EnrichedMetadata>> {
    // In real implementation:
    // const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`)
    // const data = await response.json()

    // Mock response
    const mockResponse: OpenLibraryResponse = {
      title: 'Alternative Book Title',
      authors: [{ name: 'Alternative Author' }],
      publishers: ['Alternative Publishing'],
      publish_date: '2024',
      number_of_pages: 315,
      subjects: ['Technology', 'Programming', 'Software Development'],
      description: 'Alternative description from Open Library...',
      languages: [{ key: '/languages/eng' }],
      weight: '580g',
      physical_dimensions: '23.4 x 15.6 x 2.4 centimeters'
    }

    return {
      title: mockResponse.title,
      author: mockResponse.authors?.[0]?.name,
      publisher: mockResponse.publishers?.[0],
      publicationYear: mockResponse.publish_date ? parseInt(mockResponse.publish_date) : undefined,
      description: typeof mockResponse.description === 'string'
        ? mockResponse.description
        : mockResponse.description?.value,
      pageCount: mockResponse.number_of_pages,
      language: this.parseLanguageCode(mockResponse.languages?.[0]?.key),
      weight: mockResponse.weight ? this.parseWeight(mockResponse.weight) : undefined,
      dimensions: mockResponse.physical_dimensions,
      subjects: mockResponse.subjects
    }
  }

  // Intelligent metadata merging
  private static mergeMetadata(
    existing: EnrichedMetadata,
    newData: Partial<EnrichedMetadata>
  ): EnrichedMetadata {
    const merged = { ...existing }

    // Merge with preference for more complete/reliable data
    Object.entries(newData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (!merged[key as keyof EnrichedMetadata]) {
          // Use new data if existing doesn't have this field
          (merged as any)[key] = value
        } else {
          // Apply field-specific merge logic
          switch (key) {
            case 'description':
              // Prefer longer descriptions
              if (typeof value === 'string' && typeof merged.description === 'string') {
                if (value.length > merged.description.length) {
                  merged.description = value
                }
              }
              break
            case 'pageCount':
              // Prefer non-zero page counts
              if (typeof value === 'number' && value > 0) {
                if (!merged.pageCount || merged.pageCount === 0) {
                  merged.pageCount = value
                }
              }
              break
            case 'subjects':
              // Merge subject arrays
              if (Array.isArray(value) && Array.isArray(merged.subjects)) {
                merged.subjects = [...new Set([...merged.subjects, ...value])]
              } else if (Array.isArray(value)) {
                merged.subjects = value
              }
              break
            default:
              // For other fields, keep existing unless it's empty
              if (!merged[key as keyof EnrichedMetadata] ||
                  (typeof merged[key as keyof EnrichedMetadata] === 'string' &&
                   (merged[key as keyof EnrichedMetadata] as string).trim() === '')) {
                (merged as any)[key] = value
              }
          }
        }
      }
    })

    return merged
  }

  // Helper methods
  private static parseDimensions(dimensions?: { height?: string; width?: string; thickness?: string }): string | undefined {
    if (!dimensions) return undefined

    const height = dimensions.height?.replace(/[^\d.]/g, '')
    const width = dimensions.width?.replace(/[^\d.]/g, '')
    const thickness = dimensions.thickness?.replace(/[^\d.]/g, '')

    if (height && width && thickness) {
      return `${height}x${width}x${thickness}`
    }

    return undefined
  }

  private static parseWeight(weight: string): number | undefined {
    const match = weight.match(/(\d+(?:\.\d+)?)\s*g/)
    return match ? parseFloat(match[1]) : undefined
  }

  private static parseLanguageCode(languageKey?: string): string | undefined {
    if (!languageKey) return undefined

    const codeMap: { [key: string]: string } = {
      '/languages/eng': 'en',
      '/languages/spa': 'es',
      '/languages/fre': 'fr',
      '/languages/ger': 'de'
    }

    return codeMap[languageKey] || languageKey.split('/').pop()
  }

  // Cache management
  private static getCachedMetadata(isbn: string): EnrichedMetadata | null {
    const cached = this.cache.get(isbn)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }
    return null
  }

  private static setCachedMetadata(isbn: string, data: EnrichedMetadata): void {
    this.cache.set(isbn, { data, timestamp: Date.now() })
  }

  // Utility method to get source status
  static getSourceStatus(): MetadataSource[] {
    return this.sources.map(source => ({ ...source }))
  }

  // Method to apply enriched metadata to title data
  static applyEnrichment(
    titleData: any,
    enrichedData: EnrichedMetadata,
    strategy: 'MERGE' | 'REPLACE_EMPTY' | 'REPLACE_ALL' = 'REPLACE_EMPTY'
  ): any {
    const result = { ...titleData }

    Object.entries(enrichedData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        switch (strategy) {
          case 'REPLACE_ALL':
            (result as any)[key] = value
            break
          case 'REPLACE_EMPTY':
            if (!result[key] || (typeof result[key] === 'string' && result[key].trim() === '')) {
              (result as any)[key] = value
            }
            break
          case 'MERGE':
            if (key === 'subjects' && Array.isArray(value)) {
              // Convert subjects to keywords
              if (!result.keywords) {
                result.keywords = value.join(', ')
              }
            } else if (!result[key]) {
              (result as any)[key] = value
            }
            break
        }
      }
    })

    return result
  }
}