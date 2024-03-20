/** @jsx jsx */
import { Hono } from "https://deno.land/x/hono@v4.1.2/mod.ts";
import { jsx } from "https://deno.land/x/hono@v4.1.2/middleware.ts";
import type { FC } from "https://deno.land/x/hono@v4.1.2/jsx.ts";

const app = new Hono();

const Layout: FC = ({ children }) => {
  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <link rel="stylesheet" href="https://cdn.simplecss.org/simple.min.css" />
        <title>Passkey demo app</title>
      </head>
      <body>{children}</body>
    </html>
  );
};

app.get("/", (c) => {
  return c.html(
    <Layout>
      <h1>Hello Deno!</h1>
    </Layout>
  );
});

Deno.serve(app.fetch);
