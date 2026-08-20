import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction = process.env.NODE_ENV === 'production';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      response.status(status).json(
        typeof exceptionResponse === 'object'
          ? exceptionResponse
          : {
              statusCode: status,
              message: exceptionResponse,
            },
      );

      return;
    }

    if (exception instanceof Error) {
      console.error('[HttpExceptionFilter] Unhandled error:', exception);
    } else {
      console.error('[HttpExceptionFilter] Unhandled non-error exception:', exception);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        !isProduction && exception instanceof Error
          ? exception.message
          : 'Internal server error',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
