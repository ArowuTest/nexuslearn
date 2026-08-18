"use client";

type AdminSignInSurfaceProps = {
  adminKey: string;
  login: { login_id: string; password: string };
  loading: boolean;
  message: string;
  onAdminKeyChange: (value: string) => void;
  onLoginChange: (login: { login_id: string; password: string }) => void;
  onSignIn: () => void;
  onBootstrap: () => void;
};

export default function AdminSignInSurface({
  adminKey,
  login,
  loading,
  message,
  onAdminKeyChange,
  onLoginChange,
  onSignIn,
  onBootstrap,
}: AdminSignInSurfaceProps) {
  return (
    <main className="min-h-screen bg-[#f6f3ea] px-5 py-8 text-[#1d1a3e]">
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
        <div className="mb-8 text-center">
          <p className="font-display text-sm uppercase tracking-[0.18em] text-[#7357c9]">NexusLearn platform</p>
          <h1 className="font-display mt-3 text-4xl font-semibold">Admin sign in to the configuration control room</h1>
          <p className="mt-3 text-sm leading-6 text-[#1d1a3e]/62">
            Sign in with your named platform account to continue to the functions assigned to your role.
          </p>
        </div>
        <form className="bg-white p-6 shadow-card" onSubmit={(event) => { event.preventDefault(); onSignIn(); }}>
          <label className="block">
            <span className="text-sm font-semibold">Login ID</span>
            <input value={login.login_id} onChange={(event) => onLoginChange({ ...login, login_id: event.target.value })} className="mt-2 w-full border border-[#1d1a3e]/15 px-4 py-3 outline-none focus:border-[#7357c9]" placeholder="name@example.com" autoComplete="username" autoFocus />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-semibold">Password</span>
            <input value={login.password} onChange={(event) => onLoginChange({ ...login, password: event.target.value })} type="password" className="mt-2 w-full border border-[#1d1a3e]/15 px-4 py-3 outline-none focus:border-[#7357c9]" placeholder="Password" autoComplete="current-password" />
          </label>
          <button type="submit" disabled={loading || !login.login_id || !login.password} className="btn-pop mt-6 w-full bg-[#ffbf45] px-6 py-3 text-[#1d1a3e] disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Signing in" : "Sign in"}
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-[#1d1a3e]/54">
            Access is role-controlled. Reviewers see review tools; platform administrators see the full control room.
          </p>
        </form>
        <p className="mt-4 bg-white/70 px-4 py-3 text-sm text-[#1d1a3e]/66" role="status">{message}</p>
        <details className="mt-6 text-xs text-[#1d1a3e]/55">
          <summary className="cursor-pointer text-center font-semibold">First-time platform setup</summary>
          <div className="mt-3 border border-[#1d1a3e]/10 bg-white p-4">
            <p className="leading-5">
              The bootstrap key is only for creating the first named administrator during deployment. It is not part of normal sign in and should be removed after setup.
            </p>
            <label className="mt-3 block">
              <span className="font-semibold">Temporary bootstrap API key</span>
              <input value={adminKey} onChange={(event) => onAdminKeyChange(event.target.value)} type="password" className="mt-2 w-full border border-[#1d1a3e]/10 px-3 py-2 outline-none focus:border-[#7357c9]" placeholder="Deployment bootstrap key" autoComplete="off" />
            </label>
            <button type="button" onClick={onBootstrap} disabled={loading || !adminKey} className="btn-pop mt-3 bg-[#55cbd3] px-4 py-2 text-xs disabled:opacity-50">
              Load setup workspace
            </button>
          </div>
        </details>
      </div>
    </main>
  );
}
