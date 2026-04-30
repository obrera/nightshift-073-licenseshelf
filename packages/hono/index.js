function matchPath(pattern, pathname) {
  if (pattern === "*") {
    return {};
  }

  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = pathParts[index];

    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(actual);
      continue;
    }

    if (expected !== actual) {
      return null;
    }
  }

  return params;
}

class MiniContext {
  constructor(request, params) {
    this._headers = new Headers();
    this.req = {
      raw: request,
      path: new URL(request.url).pathname,
      param: (name) => params[name] ?? "",
      header: (name) => request.headers.get(name) ?? undefined,
      json: () => request.json()
    };
  }

  header(name, value) {
    this._headers.set(name, value);
  }

  json(data, status = 200) {
    this._headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(data), {
      status,
      headers: this._headers
    });
  }

  body(data, status = 200) {
    return new Response(data, {
      status,
      headers: this._headers
    });
  }
}

export class Hono {
  constructor() {
    this.routes = [];
    this.errorHandler = null;
    this.fetch = this.fetch.bind(this);
  }

  get(path, handler) {
    this.routes.push({ method: "GET", path, handler });
    return this;
  }

  post(path, handler) {
    this.routes.push({ method: "POST", path, handler });
    return this;
  }

  onError(handler) {
    this.errorHandler = handler;
    return this;
  }

  async fetch(request) {
    const pathname = new URL(request.url).pathname;

    for (const route of this.routes) {
      if (route.method !== request.method) {
        continue;
      }

      const params = matchPath(route.path, pathname);
      if (!params) {
        continue;
      }

      const context = new MiniContext(request, params);
      try {
        return await route.handler(context);
      } catch (error) {
        if (this.errorHandler) {
          return await this.errorHandler(error, context);
        }
        throw error;
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
