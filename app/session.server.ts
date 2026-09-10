import { createCookieSessionStorage, redirect } from "react-router";
import { env } from "~/lib/env.server";

const ONE_DAY = 60 * 60 * 24;

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [env.sessionSecret],
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_DAY * 90, // ~90 days — "log in once per device"
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function createUserSession(userId: number) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return sessionStorage.commitSession(session);
}

export async function getUserId(request: Request): Promise<number | null> {
  const session = await getSession(request);
  const userId = session.get("userId");
  return typeof userId === "number" ? userId : null;
}

/** Throws a redirect to /login if there's no valid session. */
export async function requireUserId(request: Request): Promise<number> {
  const userId = await getUserId(request);
  if (userId == null) {
    throw redirect("/login");
  }
  return userId;
}

export async function destroySession(request: Request) {
  const session = await getSession(request);
  return sessionStorage.destroySession(session);
}
