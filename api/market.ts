import type { IncomingMessage, ServerResponse } from "node:http";
import { getMarketSnapshot } from "../server/marketData";

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const snapshot = await getMarketSnapshot();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    res.end(JSON.stringify(snapshot));
  } catch (error) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: "market_snapshot_failed",
      message: error instanceof Error ? error.message : "Unknown server error",
    }));
  }
}
