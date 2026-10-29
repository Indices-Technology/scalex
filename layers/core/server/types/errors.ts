/**
 * An expected failure with a message safe to show people ("This job link is not valid").
 * Services throw it; defineApiHandler turns it into a clean HTTP error.
 * Anything else that's thrown is a bug: logged with the request id, shown as a generic 500.
 */
export class AppError extends Error {
  constructor(
    /** Stable, for code to branch on: 'NOT_FOUND', 'WRONG_CODE' … */
    public code: string,
    message: string,
    public status = 400,
    /** The form field at fault, so the page can point at it. */
    public field?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', `${what} not found`, 404)
export const forbidden = (message = 'You cannot do this') => new AppError('FORBIDDEN', message, 403)
