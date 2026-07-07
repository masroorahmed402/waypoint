import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/** Structured request log: who did what, when, how fast. No bodies, no tokens, no PII values. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({
          t: new Date().toISOString(),
          userId: req.user?.sub ?? null,
          method: req.method,
          path: req.route?.path ?? req.url,
          ms: Date.now() - start,
        }));
      }),
    );
  }
}
