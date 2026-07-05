import { createStart, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { attachGeekarenaAuth } from "./lib/geekarena-auth.attacher";



const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    // For server function RPC requests, rethrow so the client receives a proper
    // RPC error (which useServerFn .catch() handlers can absorb) instead of an
    // HTML error page that blanks the screen.
    const url = request?.url ?? "";
    if (url.includes("/_serverFn/")) {
      throw error;
    }
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachGeekarenaAuth],
}));
