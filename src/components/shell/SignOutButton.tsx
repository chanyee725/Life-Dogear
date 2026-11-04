import { signOut } from "@/auth";
import { LOGIN_PATH } from "@/lib/auth/access";

/** "로그아웃" (server form): clears the session cookie and returns to the sign-in page. */
export function SignOutButton() {
  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: LOGIN_PATH });
  }
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="flex h-7 w-full items-center rounded-md px-2 text-[13px] text-muted hover:bg-hover hover:text-fg"
      >
        로그아웃
      </button>
    </form>
  );
}
