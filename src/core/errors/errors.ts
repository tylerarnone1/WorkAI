export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class ProviderError extends AppError {
  constructor(
    provider: string,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'PROVIDER_ERROR', 502, { provider, ...context });
    this.name = 'ProviderError';
  }
}

export class ToolExecutionError extends AppError {
  constructor(
    toolName: string,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'TOOL_EXECUTION_ERROR', 500, { toolName, ...context });
    this.name = 'ToolExecutionError';
  }
}

export class ApprovalTimeoutError extends AppError {
  constructor(requestId: string) {
    super(
      `Approval request timed out: ${requestId}`,
      'APPROVAL_TIMEOUT',
      408,
      { requestId },
    );
    this.name = 'ApprovalTimeoutError';
  }
}
