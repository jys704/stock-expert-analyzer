import { nodeHTTPRequestHandler } from "@trpc/server/adapters/node-http";
import { initTRPC } from "@trpc/server";
import type { IncomingMessage, ServerResponse } from "node:http";
import superjson from "superjson";
import { getMarketSnapshot } from "../../server/marketData";

const t = initTRPC.create({
  transformer: superjson,
});

const serverlessRouter = t.router({
  market: t.router({
    snapshot: t.procedure.query(() => getMarketSnapshot()),
  }),
});

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
    router: serverlessRouter,
    createContext: async () => ({}),
  });
}
