export class StatusTransitionError extends Error {
  constructor(
    message: string,
    public fromStatus: string,
    public toStatus: string,
    public titleId?: string
  ) {
    super(message)
    this.name = 'StatusTransitionError'
  }
}

export class NotificationError extends Error {
  constructor(
    message: string,
    public titleId?: string,
    public recipient?: string
  ) {
    super(message)
    this.name = 'NotificationError'
  }
}

export class RetirementError extends Error {
  constructor(
    message: string,
    public titleId?: string,
    public reason?: string
  ) {
    super(message)
    this.name = 'RetirementError'
  }
}