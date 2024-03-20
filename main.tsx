/** @jsx jsx */
import { Hono } from "https://deno.land/x/hono@v4.1.2/mod.ts";
import { jsx } from "https://deno.land/x/hono@v4.1.2/middleware.ts";

const app = new Hono();

app.get("/", (c) => {
  return c.html(<h1>Hello Deno!</h1>);
});

Deno.serve(app.fetch);
