/** @jsx jsx */
import { jsx } from "https://deno.land/x/hono@v4.1.2/middleware.ts";
import type { FC } from "https://deno.land/x/hono@v4.1.2/jsx.ts";
import { html } from "https://deno.land/x/hono@v4.1.2/helper.ts";
import { Layout } from "./layout.tsx";

const loginScript = html`
<script>
  const { startAuthentication } = SimpleWebAuthnBrowser;

  // <button>
  const elemBegin = document.getElementById('btnBegin');
  // <span>/<p>/etc...
  const elemSuccess = document.getElementById('success');
  // <span>/<p>/etc...
  const elemError = document.getElementById('error');

  // Start authentication when the user clicks a button
  elemBegin.addEventListener('click', async () => {
    // Reset success/error messages
    elemSuccess.innerHTML = '';
    elemError.innerHTML = '';

    // GET authentication options from the endpoint that calls
    // @simplewebauthn/server -> generateAuthenticationOptions()
    const resp = await fetch('/generate-authentication-options');

    let asseResp;
    try {
      // Pass the options to the authenticator and wait for a response
      asseResp = await startAuthentication(await resp.json());
    } catch (error) {
      // Some basic error handling
      elemError.innerText = error;
      throw error;
    }

    // POST the response to the endpoint that calls
    // @simplewebauthn/server -> verifyAuthenticationResponse()
    const verificationResp = await fetch('/verify-authentication', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(asseResp),
    });

    // Wait for the results of verification
    const verificationRespJSON = await verificationResp.json();

    // Show UI appropriate for the  \`verified\` status
    if (verificationRespJSON?.verification.verified) {
      const user = verificationRespJSON.user;
      elemSuccess.innerHTML = \`Success! You are \${user.name}\`;
    } else {
      elemError.innerHTML = \`Oh no, something went wrong! Response: <pre>\${JSON.stringify(
        verificationJSON,
      )}</pre>\`;
    }
  });
</script>
`;

export const Login: FC = ({ children }) => {
  return (
    <Layout>
      <main>
        <h1>Login</h1>
        <button id="btnBegin">Login</button>
        <p id="success"></p>
        <p id="error"></p>
        <a href="/">Go to home</a>
      </main>
      {loginScript}
    </Layout>
  );
};
