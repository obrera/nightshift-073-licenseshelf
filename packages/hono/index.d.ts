export interface HonoRequest {
  raw: Request;
  path: string;
  param(name: string): string;
  header(name: string): string | undefined;
  json<T = unknown>(): Promise<T>;
}

export interface Context {
  req: HonoRequest;
  header(name: string, value: string): void;
  json(data: unknown, status?: number): Response;
  body(data: BodyInit | null, status?: number): Response;
}

export type Handler = (context: Context) => Response | Promise<Response>;

export class Hono {
  get(path: string, handler: Handler): this;
  post(path: string, handler: Handler): this;
  onError(handler: (error: unknown, context: Context) => Response | Promise<Response>): this;
  fetch(request: Request): Promise<Response>;
}
