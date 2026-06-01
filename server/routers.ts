import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createAnalysisReport, listAnalysisReports } from "./db";
import { storagePut } from "./storage";
import { decodePdfDataUrl, sanitizeStorageSegment } from "./analysisUtils";
import { verifyFirebaseIdToken } from "./firebaseAuth";
import { getMarketSnapshot } from "./marketData";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  market: router({
    snapshot: publicProcedure.query(() => getMarketSnapshot()),
  }),

  analysis: router({
    list: publicProcedure
      .input(z.object({ idToken: z.string().min(20) }))
      .query(async ({ input }) => {
        const verified = await verifyFirebaseIdToken(input.idToken);
        return listAnalysisReports(verified.uid);
      }),

    savePdfReport: publicProcedure
      .input(z.object({
        idToken: z.string().min(20),
        symbol: z.string().min(1).max(32),
        stockName: z.string().min(1).max(160),
        score: z.number().int().min(0).max(100),
        grade: z.string().min(1).max(8),
        stance: z.string().min(1).max(64),
        report: z.string().min(1).max(8_000),
        snapshot: z.unknown(),
        pdfDataUrl: z.string().min(100),
      }))
      .mutation(async ({ input }) => {
        const verified = await verifyFirebaseIdToken(input.idToken);
        const pdfBuffer = decodePdfDataUrl(input.pdfDataUrl);
        const safeUser = sanitizeStorageSegment(verified.uid, "user");
        const safeSymbol = sanitizeStorageSegment(input.symbol, "stock");
        const fileName = `${Date.now()}-${safeSymbol}-analysis.pdf`;
        const storageResult = await storagePut(
          `analysis-reports/${safeUser}/${fileName}`,
          pdfBuffer,
          "application/pdf",
        );

        const saved = await createAnalysisReport({
          firebaseUserId: verified.uid,
          userEmail: verified.email,
          symbol: input.symbol.toUpperCase(),
          stockName: input.stockName,
          score: input.score,
          grade: input.grade,
          stance: input.stance,
          report: input.report,
          snapshotJson: JSON.stringify(input.snapshot),
          fileKey: storageResult.key,
          fileUrl: storageResult.url,
        });

        return saved;
      }),
  }),
});

export type AppRouter = typeof appRouter;
