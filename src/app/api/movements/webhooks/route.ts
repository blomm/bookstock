import { NextRequest, NextResponse } from 'next/server'
import WebhookService, { WebhookEndpoint, WebhookEventType } from '@/services/webhookService'

// GET /api/movements/webhooks - List webhook endpoints and get metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const endpointId = searchParams.get('endpointId')

    switch (action) {
      case 'metrics':
        if (!endpointId) {
          return NextResponse.json(
            { error: 'endpointId is required for metrics' },
            { status: 400 }
          )
        }
        return await handleGetMetrics(endpointId)

      case 'delivery-status':
        const deliveryId = searchParams.get('deliveryId')
        if (!deliveryId) {
          return NextResponse.json(
            { error: 'deliveryId is required for delivery status' },
            { status: 400 }
          )
        }
        return await handleGetDeliveryStatus(deliveryId)

      case 'list':
      default:
        return await handleListEndpoints()
    }

  } catch (error) {
    console.error('Webhook API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process webhook request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/movements/webhooks - Register new webhook endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.id || !body.url || !body.secret) {
      return NextResponse.json(
        {
          success: false,
          error: 'id, url, and secret are required'
        },
        { status: 400 }
      )
    }

    if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'events array is required and must contain at least one event type'
        },
        { status: 400 }
      )
    }

    // Validate event types
    const validEvents: WebhookEventType[] = [
      'movement.created', 'movement.updated', 'movement.deleted',
      'movement.approved', 'movement.rejected',
      'inventory.updated', 'batch.completed', 'batch.failed'
    ]

    for (const event of body.events) {
      if (!validEvents.includes(event)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid event type: ${event}. Valid types: ${validEvents.join(', ')}`
          },
          { status: 400 }
        )
      }
    }

    // Set defaults for optional fields
    const endpoint: WebhookEndpoint = {
      id: body.id,
      url: body.url,
      secret: body.secret,
      isActive: body.isActive !== undefined ? body.isActive : true,
      events: body.events,
      retryPolicy: body.retryPolicy || {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2
      },
      metadata: body.metadata || {}
    }

    await WebhookService.registerEndpoint(endpoint)

    return NextResponse.json({
      success: true,
      message: 'Webhook endpoint registered successfully',
      endpoint: {
        id: endpoint.id,
        url: endpoint.url,
        isActive: endpoint.isActive,
        events: endpoint.events
      }
    })

  } catch (error) {
    console.error('Webhook registration error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to register webhook endpoint',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT /api/movements/webhooks - Update webhook endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'id is required'
        },
        { status: 400 }
      )
    }

    // Filter out undefined values to create updates object
    const updates: Partial<WebhookEndpoint> = {}

    if (body.url !== undefined) updates.url = body.url
    if (body.secret !== undefined) updates.secret = body.secret
    if (body.isActive !== undefined) updates.isActive = body.isActive
    if (body.events !== undefined) updates.events = body.events
    if (body.retryPolicy !== undefined) updates.retryPolicy = body.retryPolicy
    if (body.metadata !== undefined) updates.metadata = body.metadata

    const success = await WebhookService.updateEndpoint(body.id, updates)

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: `Webhook endpoint with id '${body.id}' not found`
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook endpoint updated successfully'
    })

  } catch (error) {
    console.error('Webhook update error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update webhook endpoint',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/movements/webhooks - Remove webhook endpoint
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const endpointId = searchParams.get('endpointId')

    if (!endpointId) {
      return NextResponse.json(
        {
          success: false,
          error: 'endpointId parameter is required'
        },
        { status: 400 }
      )
    }

    const success = await WebhookService.unregisterEndpoint(endpointId)

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: `Webhook endpoint with id '${endpointId}' not found`
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook endpoint removed successfully'
    })

  } catch (error) {
    console.error('Webhook deletion error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove webhook endpoint',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleListEndpoints(): Promise<NextResponse> {
  // In production, this would return actual endpoints from the database
  // For now, return a placeholder response indicating the endpoints would be listed

  return NextResponse.json({
    success: true,
    message: 'Endpoint listing would be implemented here',
    data: {
      endpoints: [],
      total: 0
    }
  })
}

async function handleGetMetrics(endpointId: string): Promise<NextResponse> {
  try {
    const metrics = await WebhookService.getEndpointMetrics(endpointId)

    return NextResponse.json({
      success: true,
      data: metrics
    })

  } catch (error) {
    console.error('Webhook metrics error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get endpoint metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleGetDeliveryStatus(deliveryId: string): Promise<NextResponse> {
  try {
    const delivery = await WebhookService.getDeliveryStatus(deliveryId)

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          error: `Delivery with id '${deliveryId}' not found`
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: delivery.id,
        endpointId: delivery.endpointId,
        event: delivery.event,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        maxRetries: delivery.maxRetries,
        lastAttemptAt: delivery.lastAttemptAt,
        nextAttemptAt: delivery.nextAttemptAt,
        responseStatus: delivery.responseStatus,
        createdAt: delivery.createdAt,
        deliveredAt: delivery.deliveredAt
      }
    })

  } catch (error) {
    console.error('Webhook delivery status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get delivery status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}