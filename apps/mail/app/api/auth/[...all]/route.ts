import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth"; // path to your auth file

export const { POST, GET } = toNextJsHandler(auth);
