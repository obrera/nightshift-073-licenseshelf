export function serve(args: {
  fetch(request: Request): Response | Promise<Response>;
  port: number;
}): void;
