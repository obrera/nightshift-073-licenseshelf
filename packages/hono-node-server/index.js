import { createServer } from "node:http";
import { Readable } from "node:stream";

export function serve(args) {
  const server = createServer(async (req, res) => {
    const url = `http://${req.headers.host ?? `localhost:${args.port}`}${req.url ?? "/"}`;
    const body =
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : Readable.toWeb(req);

    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body,
      duplex: "half"
    });

    const response = await args.fetch(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (!response.body) {
      res.end();
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  });

  server.listen(args.port);
}
