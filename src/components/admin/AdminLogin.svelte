<!--
  AdminLogin.svelte — Master PIN Gate for Insider Farm Portal
  Svelte 5 runes mode.
-->
<script>
  import { loginAdmin } from '../../lib/adminAuth.js';

  let pin = $state('');
  let errorMsg = $state('');
  let isSubmitting = $state(false);

  /** @type {{ onLoginSuccess: () => void }} */
  let { onLoginSuccess } = $props();

  async function handleSubmit(e) {
    e?.preventDefault();
    errorMsg = '';
    isSubmitting = true;

    const result = await loginAdmin(pin);
    isSubmitting = false;
    if (result?.ok) {
      onLoginSuccess?.();
    } else {
      errorMsg = result?.error || 'Incorrect master PIN. Access restricted to authorized Kadugodi farm staff.';
    }
  }
</script>

<div class="min-h-screen w-full bg-[#0B1F2E] flex items-center justify-center p-4">
  <div class="w-full max-w-md rounded-3xl border border-[#2B5A16]/40 bg-[#112838] p-8 shadow-2xl text-white">
    <!-- Farm Branding Header -->
    <div class="text-center mb-8">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2B5A16] border-2 border-[#8DC63F] shadow-lg mb-4 text-3xl">
        🌱
      </div>
      <span class="text-[11px] font-extrabold uppercase tracking-widest text-[#8DC63F]">
        INSIDER ACCESS ONLY • ZERO PUBLIC FOOTPRINT
      </span>
      <h1 class="mt-2 text-2xl font-bold tracking-tight text-white" style="font-family: 'Playfair Display', Georgia, serif;">
        Only Superfoods Ops Desk
      </h1>
      <p class="mt-1 text-xs text-[#9BB1A5]">
        Kadugodi Fruiting Rooms, Stock Engine &amp; Dispatch Console
      </p>
    </div>

    <!-- PIN Entry Form -->
    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label for="admin-pin-input" class="block text-xs font-semibold uppercase tracking-wider text-[#D1DFD7] mb-1.5">
          Enter Master Operational PIN
        </label>
        <div class="relative">
          <input
            id="admin-pin-input"
            type="password"
            bind:value={pin}
            placeholder="••••••••••••"
            class="w-full rounded-xl border border-[#2B5A16] bg-[#0A1822] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#8DC63F] focus:ring-2 focus:ring-[#8DC63F]/20 transition-all font-mono"
            autocomplete="current-password"
            required
          />
        </div>
      </div>

      {#if errorMsg}
        <div class="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300 flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      {/if}

      <button
        type="submit"
        disabled={isSubmitting || !pin.trim()}
        class="w-full rounded-xl bg-[#8DC63F] py-3 text-sm font-bold text-[#0B1F2E] transition-all hover:bg-[#7db534] active:scale-98 disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-md"
      >
        {isSubmitting ? 'Authenticating...' : 'Unlock Ops Station →'}
      </button>

      <div class="pt-4 border-t border-white/10 text-center">
        <p class="text-[11px] text-[#7A9285]">
          Default master operational PIN: <code class="bg-white/10 px-1.5 py-0.5 rounded text-[#8DC63F] font-mono">farm560067</code>
        </p>
      </div>
    </form>
  </div>
</div>

