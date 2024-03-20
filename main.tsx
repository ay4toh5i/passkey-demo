/** @jsx jsx */
import { Hono } from "https://deno.land/x/hono@v4.1.2/mod.ts";
import { jsx } from "https://deno.land/x/hono@v4.1.2/middleware.ts";
import {
  type Session,
  sessionMiddleware,
} from "https://deno.land/x/hono_sessions@v0.3.4/mod.ts";
import { DenoKvStore } from "https://deno.land/x/hono_sessions@v0.3.4/src/store/deno/DenoKvStore.ts";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "https://deno.land/x/simplewebauthn@v9.0.3/deno/server.ts";
import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
} from "https://deno.land/x/simplewebauthn@v9.0.3/deno/types.ts";
import * as base64url from "https://deno.land/std@0.220.1/encoding/base64url.ts";
import { Layout } from "./layout.tsx";
import { Registration } from "./registration.tsx";
import { Login } from "./login.tsx";

/**
 * It is strongly advised that authenticators get their own DB
 * table, ideally with a foreign key to a specific UserModel.
 *
 * "SQL" tags below are suggestions for column data types and
 * how best to store data received during registration for use
 * in subsequent authentications.
 */
type Authenticator = {
  // SQL: Encode to base64url then store as `TEXT`. Index this column
  credentialID: Uint8Array;
  // SQL: Store raw bytes as `BYTEA`/`BLOB`/etc...
  credentialPublicKey: Uint8Array;
  // SQL: Consider `BIGINT` since some authenticators return atomic timestamps as counters
  counter: number;
  // SQL: `VARCHAR(32)` or similar, longest possible value is currently 12 characters
  // Ex: 'singleDevice' | 'multiDevice'
  credentialDeviceType: CredentialDeviceType;
  // SQL: `BOOL` or whatever similar type is supported
  credentialBackedUp: boolean;
  // SQL: `VARCHAR(255)` and store string array as a CSV string
  // Ex: ['ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb']
  transports?: AuthenticatorTransportFuture[];
};

type User = {
  id: string;
  email: string;
  name: string;
  currentChallenge?: string;
  authenticators: Authenticator[];
};

type PublicKeyItem = {
  userId: User["id"],
  authenticator: Authenticator;
};

const kv = await Deno.openKv("deno-kv/tmp.db");

const sessionStore = new DenoKvStore(kv);

const app = new Hono<{
  Variables: {
    session: Session;
    session_key_rotation: boolean;
  };
}>();

app.use("*", sessionMiddleware({ store: sessionStore }));

app.get("/", (c) => {
  return c.html(
    <Layout>
      <main>
        <h1>Passkey demo app</h1>
        <a href="/registration">Click here to registration!</a>
        <br />
        <a href="/login">Click here to login!</a>
      </main>
    </Layout>,
  );
});

app.get("/registration", (c) => {
  return c.html(<Registration />);
});

app.get("/login", (c) => {
  return c.html(<Login />);
});

// Human-readable title for your website
const rpName = "Passkey demo app";
// A unique identifier for your website
const rpID = "localhost";
// The URL at which registrations and authentications should occur
const origin = `http://${rpID}:8000`;

app.post("/generate-registration-options", async (c) => {
  const data = await c.req.json();

  console.log(data);

  const user: User =
    (await kv.get<User>(["users_by_email", data.email])).pubkeyItem ?? {
      id: crypto.randomUUID().toString(),
      email: data.email,
      name: data.name,
      authenticators: [],
    };

  console.log("user", user);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: user.email,
    // Don't prompt users for additional information about the authenticator
    // (Recommended for smoother UX)
    attestationType: "none",
    // Prevent users from re-registering existing authenticators
    excludeCredentials: user.authenticators.map((authenticator) => ({
      id: authenticator.credentialID,
      type: "public-key",
      // Optional
      transports: authenticator.transports,
    })),
    // See "Guiding use of authenticators via authenticatorSelection" below
    authenticatorSelection: {
      // Defaults
      residentKey: "preferred",
      userVerification: "preferred",
      // Optional
      authenticatorAttachment: "platform",
    },
  });

  const userWithChallenge = {
    ...user,
    currentChallenge: options.challenge,
  };

  await kv.set(["users", user.id], userWithChallenge);
  await kv.set(["users_by_email", user.email], userWithChallenge);

  const session = c.get("session");

  session.set("currentUserId", user.id);

  return c.json(options);
});

app.post("/verify-registration", async (c) => {
  const session = c.get("session");

  const currentUserId = session.get("currentUserId");

  if (!currentUserId) {
    c.status(400);
    return c.body();
  }

  const data = await c.req.json();

  console.log("verify-registration", data);

  const { value: user } = await kv.get<User>(["users", currentUserId]);

  if (!user) {
    c.status(400);
    return c.body();
  }

  console.log("currentUser", user);

  const body = await c.req.json();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: user!.currentChallenge!,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (error) {
    console.error(error);
    return c.body(error.message, { status: 400 });
  }

  const { verified, registrationInfo } = verification;

  if (!verified) {
    c.status(400);
    return c.body();
  }

  const {
    credentialPublicKey,
    credentialID,
    counter,
    credentialDeviceType,
    credentialBackedUp,
  } = registrationInfo!;

  console.log("registration info", registrationInfo);

  const newAuthenticator: Authenticator = {
    credentialID,
    credentialPublicKey,
    counter,
    credentialDeviceType,
    credentialBackedUp,
    // `body` here is from Step 2
    transports: body.response.transports,
  };

  const userWithAuthenticator: User = {
    ...user,
    authenticators: [
      ...(user.authenticators ?? []),
      newAuthenticator,
    ],
    currentChallenge: undefined,
  };

  await kv.set(["users", userWithAuthenticator.id], userWithAuthenticator);
  await kv.set(
    ["users_by_email", userWithAuthenticator.email],
    userWithAuthenticator,
  );

  await kv.set(["public_keys", base64url.encodeBase64Url(newAuthenticator.credentialID)], {
    userId: user.id,
    authenticator: newAuthenticator,
  });

  return c.json(verification);
});

app.get("/generate-authentication-options", async (c) => {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });

  const session = c.get("session");

  session.set("loginChallenge", options.challenge);

  return c.json(options);
});

app.post("/verify-authentication", async (c) => {
  const session = c.get("session");

  const expectedChallenge = session.get("loginChallenge") as string;

  const data = await c.req.json();

  const { value: pubkeyItem } = await kv.get<PublicKeyItem>(["public_keys", data.id]);

  if (!pubkeyItem) {
    c.status(400);
    return c.text("no credentials found.");
  }

  const { userId, authenticator } = pubkeyItem;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: data,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator,
    });
  } catch (e) {
    c.status(400);
    return c.text("unexpectedly verification failed.");
  }

  if (!verification.verified) {
    c.status(400);
    return c.text("verification failed.");
  }

  const { value: user } = await kv.get(["users", userId]);

  return c.json({ verification, user });
});

Deno.serve(app.fetch);
