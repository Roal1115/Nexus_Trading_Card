import { createStart } from '@tanstack/react-start';
import { createMiddleware } from '@tanstack/react-start';
import { renderErrorPage } from "./lib/error-page";
import { attachGeekarenaAuth } from "./lib/geekarena-auth.attacher";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Don't swallow Vite/build errors — only handle runtime errors
    if (error != null && typeof error === "object") {
      if ("plugin" in error) throw error; // Vite plugin errors — rethrow
      if ("statusCode" in error) throw error; // HTTP errors — rethrow
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth, attachGeekarenaAuth],
}));