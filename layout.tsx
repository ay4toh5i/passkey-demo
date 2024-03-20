/** @jsx jsx */
import { jsx } from "https://deno.land/x/hono@v4.1.2/middleware.ts";
import type { FC } from "https://deno.land/x/hono@v4.1.2/jsx.ts";

export const Layout: FC = ({ children }) => {
  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <link
          rel="stylesheet"
          href="https://cdn.simplecss.org/simple.min.css"
        />
        <script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js">
        </script>
        <title>Passkey demo app</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
};
