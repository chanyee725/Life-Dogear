import { handlers } from "@/auth";

// Auth.js endpoints (sign-in, callback, sign-out, session). Only reachable in login mode;
// the middleware answers 404 here otherwise.
export const { GET, POST } = handlers;
