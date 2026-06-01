import { nodeHTTPRequestHandler } from "@trpc/server/adapters/node-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

function getTrpcPath(req: IncomingMessage) {
  const url = new URL(req.url ?? "", "http://localhost");
  const pathname = url.pathname.replace(/^\/api\/trpc\/?/, "");
  return decodeURIComponent(pathname);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  return nodeHTTPRequestHandler({
    req,
    res,
    path: getTrpcPath(req),
    router: appRouter,
    createContext: async () => createContext({ req, res } as never),
  });
}
