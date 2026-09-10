import { redirect } from "react-router";
import { destroySession } from "~/session.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  const cookie = await destroySession(request);
  return redirect("/login", { headers: { "Set-Cookie": cookie } });
}

// Support a plain GET too (e.g. a nav link) — same effect.
export async function loader({ request }: Route.LoaderArgs) {
  const cookie = await destroySession(request);
  return redirect("/login", { headers: { "Set-Cookie": cookie } });
}
