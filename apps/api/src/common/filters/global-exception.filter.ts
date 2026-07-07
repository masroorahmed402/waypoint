import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { randomUUID } from 'crypto';

/** Every error leaves the API in one consistent envelope. Internals never leak. */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        error = (b.error as string) ?? exception.name;
      }
    } else if (exception instanceof Error && process.env.NODE_ENV !== 'production') {
      message = exception.message;
    }

    if (status >= 500) {
      // structured server-side log; never sent to client
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ requestId, path: req.url, err: String(exception) }));
    }

    res.status(status).json({ statusCode: status, error, message, requestId });
  }
}
