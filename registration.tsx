/** @jsx jsx */
import { jsx } from "https://deno.land/x/hono@v4.1.2/middleware.ts";
import type { FC } from "https://deno.land/x/hono@v4.1.2/jsx.ts";
import { html } from "https://deno.land/x/hono@v4.1.2/helper.ts";
import { Layout } from "./layout.tsx";

const registrationScript = html`
<script>
  const { startRegistration } = SimpleWebAuthnBrowser;

  // <button>
  const elemBegin = document.getElementById('btnBegin');
  // <span>/<p>/etc...
  const elemSuccess = document.getElementById('success');
  // <span>/<p>/etc...
  const elemError = document.getElementById('error');

  // Start registration when the user clicks a button
  elemBegin.addEventListener('click', async () => {
    // Reset success/error messages
    elemSuccess.innerHTML = '';
    elemError.innerHTML = '';

    const email = document.getElementById("email").value;
    const name = document.getElementById("name").value;

    // GET registration options from the endpoint that calls
    // @simplewebauthn/server -> generateRegistrationOptions()
    const resp = await fetch('/generate-registration-options', {
      method: "POST",
      body: JSON.stringify({ email, name }),
    });

    let attResp;
    try {
      // Pass the options to the authenticator and wait for a response
      attResp = await startRegistration(await resp.json());
    } catch (error) {
      // Some basic error handling
      if (error.name === 'InvalidStateError') {
        elemError.innerText = 'Error: Authenticator was probably already registered by user';
      } else {
        elemError.innerText = error;
      }

      throw error;
    }

    // POST the response to the endpoint that calls
    // @simplewebauthn/server -> verifyRegistrationResponse()
    const verificationResp = await fetch('/verify-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attResp),
    });

    // Wait for the results of verification
    const verificationJSON = await verificationResp.json();

    // Show UI appropriate for the \`verified\` status
    if (verificationJSON && verificationJSON.verified) {
      elemSuccess.innerHTML = 'Success!';
    } else {
      elemError.innerHTML = \`Oh no, something went wrong! Response: <pre>\${JSON.stringify(
        verificationJSON,
      )}</pre>\`;
    }
  });
</script>
`;

export const Registration: FC = ({ children }) => {
  return (
    <Layout>
      <main>
        <h1>Registration</h1>
        <p>
          <label>Email</label>
          <input id="email" type="email" />
          <label>Name</label>
          <input id="name" type="text" />
        </p>
        <button id="btnBegin">Start Registration</button>
        <p id="success"></p>
        <p id="error"></p>
        <a href="/">Go to home</a>
      </main>
      {registrationScript}
    </Layout>
  );
};
