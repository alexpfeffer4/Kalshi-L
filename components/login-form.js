"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/login/actions";

const initialState = { error: "" };

export default function LoginForm({ passwordEnabled }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <div className="login-shell">
      <div className="panel login-panel">
        <div className="eyebrow">Admin lock</div>
        <h1 className="headline login-headline">Review Deck Login</h1>
        <p className="lede">
          {passwordEnabled
            ? "Enter the admin password to open the review queue and ingestion controls."
            : "No admin password is configured, so this page should not normally be shown."}
        </p>
        <form action={action}>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" />
          </div>
          <button className="action primary" disabled={pending} type="submit">
            Enter admin deck
          </button>
        </form>
        {state?.error ? <div className="notice notice-error">{state.error}</div> : null}
      </div>
    </div>
  );
}
