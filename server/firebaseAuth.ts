import { createRemoteJWKSet, jwtVerify } from "jose";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksProjectId: string | null = null;

export type VerifiedFirebaseUser = {
  uid: string;
  email: string | null;
};

function getFirebaseProjectId() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Firebase project id is not configured on the server");
  }
  return projectId;
}

function getJwks(projectId: string) {
  if (!jwks || jwksProjectId !== projectId) {
    jwks = createRemoteJWKSet(
      new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
    );
    jwksProjectId = projectId;
  }
  return jwks;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const projectId = getFirebaseProjectId();
  const { payload } = await jwtVerify(idToken, getJwks(projectId), {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  if (!payload.sub) {
    throw new Error("Firebase token does not include a user id");
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
  };
}
