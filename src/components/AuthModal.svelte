<!--
  AuthModal.svelte — WhatsApp Phone & 4-Digit PIN / 1-Tap Customer Login Modal
  Features:
  - Frictionless WhatsApp login: 4-digit PIN (10-min validity) + Hybrid 1-Tap Inbound Verify
  - 180-Day persistent sliding session in browser
  - Playful/flirty name onboarding step ("What should our morning harvesters call you? 😉")
  - Live clipboard auto-paste support for WhatsApp "Copy Code" button
  - Resend 60s countdown timer
  - Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from "svelte";
  import {
    sendWhatsAppOtp,
    verifyWhatsAppOtp,
    pollInboundVerification,
    updateCustomerProfile,
    getCurrentCustomer,
    closeAuthModal,
  } from "../lib/auth.js";

  let isOpen = $state(false);
  // 'phone' | 'otp' | 'inbound_wait' | 'name'
  let step = $state("phone");

  let phone = $state("");
  let otpCode = $state("");
  let currentToken = $state("");
  let inboundWaLink = $state("");
  let customerName = $state("");

  let isLoading = $state(false);
  let errorMessage = $state("");
  let successMessage = $state("");

  // 60-second Resend Timer
  let resendCountdown = $state(0);
  let timerInterval = null;

  // Inbound Polling
  let pollInterval = null;

  function startCountdown(seconds = 60) {
    if (timerInterval) clearInterval(timerInterval);
    resendCountdown = seconds;
    timerInterval = setInterval(() => {
      resendCountdown -= 1;
      if (resendCountdown <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }, 1000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function handleOpen(e) {
    isOpen = true;
    errorMessage = "";
    successMessage = "";
    const current = getCurrentCustomer();
    if (current?.phone) {
      phone = current.phone;
      customerName = current.name || "";
    }
    step = "phone";
  }

  function handleClose() {
    isOpen = false;
    errorMessage = "";
    successMessage = "";
    stopPolling();
    if (timerInterval) clearInterval(timerInterval);
    closeAuthModal();
  }

  onMount(() => {
    window.addEventListener("osf:open-auth", handleOpen);
    window.addEventListener("osf:close-auth", handleClose);
    return () => {
      window.removeEventListener("osf:open-auth", handleOpen);
      window.removeEventListener("osf:close-auth", handleClose);
      stopPolling();
      if (timerInterval) clearInterval(timerInterval);
    };
  });

  onDestroy(() => {
    stopPolling();
    if (timerInterval) clearInterval(timerInterval);
  });

  /* ── 1. SEND 4-DIGIT OTP (OUTBOUND) ────────────────────────────────── */
  async function handleSendOtp(e) {
    e?.preventDefault();
    errorMessage = "";
    isLoading = true;

    try {
      const res = await sendWhatsAppOtp(phone, "otp");
      currentToken = res.token || "";
      inboundWaLink = res.fallbackLink || "";
      step = "otp";
      startCountdown(60);
      successMessage = res.message || "4-digit PIN sent to your WhatsApp!";
    } catch (err) {
      errorMessage = err.message || "Please check your phone number.";
    } finally {
      isLoading = false;
    }
  }

  /* ── 2. START 1-TAP INBOUND VERIFICATION (HYBRID) ──────────────────── */
  async function handleStartInbound(e) {
    e?.preventDefault();
    errorMessage = "";
    isLoading = true;

    try {
      const res = await sendWhatsAppOtp(phone, "inbound");
      currentToken = res.token;
      inboundWaLink = res.waLink;
      step = "inbound_wait";

      // Open WhatsApp deep link
      if (typeof window !== "undefined") {
        window.open(res.waLink, "_blank");
      }

      // Start polling backend every 1.5 seconds
      stopPolling();
      pollInterval = setInterval(async () => {
        const pollRes = await pollInboundVerification(currentToken, {
          name: customerName,
        });
        if (pollRes.verified) {
          stopPolling();
          if (
            pollRes.isNewCustomer ||
            !pollRes.customer?.name ||
            pollRes.customer?.name === "Foodie"
          ) {
            step = "name";
          } else {
            successMessage = `Verified! Welcome back, ${pollRes.customer?.name || ""} ✨`;
            setTimeout(() => handleClose(), 900);
          }
        }
      }, 1500);
    } catch (err) {
      errorMessage =
        err.message || "Could not start 1-tap WhatsApp verification.";
    } finally {
      isLoading = false;
    }
  }

  /* ── 3. VERIFY 4-DIGIT OTP ─────────────────────────────────────────── */
  async function handleVerifyOtp(e) {
    e?.preventDefault();
    errorMessage = "";
    isLoading = true;

    try {
      const res = await verifyWhatsAppOtp(
        phone,
        otpCode,
        { name: customerName },
        currentToken,
      );
      if (
        res.isNewCustomer ||
        !res.customer?.name ||
        res.customer?.name === "Foodie"
      ) {
        step = "name";
      } else {
        successMessage = `Welcome back${res.customer?.name ? `, ${res.customer.name}` : ""}! 🍄`;
        setTimeout(() => handleClose(), 800);
      }
    } catch (err) {
      errorMessage = err.message || "Invalid 4-digit PIN. Please try again.";
    } finally {
      isLoading = false;
    }
  }

  /* ── 4. FLIRTY / PLAYFUL NAME ONBOARDING ────────────────────────────── */
  function handleSaveName(e) {
    e?.preventDefault();
    const cleanName = customerName.trim();
    if (cleanName) {
      updateCustomerProfile({ name: cleanName });
    }
    successMessage = cleanName
      ? `You're all set, ${cleanName}! We'll write your name on the box 😉`
      : `You're all set! Enjoy the freshest harvest 🍄`;
    setTimeout(() => handleClose(), 900);
  }

  function handleSkipName() {
    updateCustomerProfile({ name: "Foodie" });
    handleClose();
  }

  /* ── CLIPBOARD AUTO-PASTE FOR WHATSAPP "COPY CODE" BUTTON ─────────── */
  async function handlePasteFromClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        const cleanClip = clipText.replace(/\D/g, "").slice(0, 4);
        if (cleanClip.length === 4) {
          otpCode = cleanClip;
          successMessage = "Pasted 4-digit PIN from clipboard!";
        }
      }
    } catch (e) {
      console.warn("Clipboard read notice:", e);
    }
  }
</script>

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs transition-opacity duration-300"
    onclick={handleClose}
    aria-hidden="true"
  ></div>

  <!-- Modal Dialog -->
  <div
    class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-3xl border-t border-[#E4E4DC] bg-white p-6 shadow-2xl transition-transform duration-300 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border"
    role="dialog"
    aria-label="WhatsApp Customer Login"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-[#E4E4DC] pb-4"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F8EE] text-[#25D366] shadow-2xs"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75 0 1.83.504 3.543 1.38 5.008L2.25 21.75l4.908-1.29A9.704 9.704 0 0012 21.75c5.385 0 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 1.5a8.25 8.25 0 110 16.5 8.205 8.205 0 01-4.22-1.157l-.3-.178-3.09.813.827-3.023-.195-.31A8.204 8.204 0 013.75 12c0-4.556 3.694-8.25 8.25-8.25z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div>
          <h3 class="text-base font-bold text-[#0B1F2E]">
            {#if step === "name"}
              Welcome to the Farm! ✨
            {:else}
              WhatsApp Fast Sign-In
            {/if}
          </h3>
          <p class="text-[11px] text-[#4A5A52]">
            {#if step === "name"}
              One quick detail before harvest
            {:else}
              Safe 4-digit PIN • Instant WhatsApp verification
            {/if}
          </p>
        </div>
      </div>

      <button
        type="button"
        onclick={handleClose}
        class="flex h-8 w-8 items-center justify-center rounded-full text-[#4A5A52] hover:bg-[#F7F7F2] active:scale-95 transition-transform"
        aria-label="Close Login"
      >
        ✕
      </button>
    </div>

    <!-- Error/Success Feedback -->
    {#if errorMessage}
      <div
        class="mt-4 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700"
      >
        {errorMessage}
      </div>
    {/if}
    {#if successMessage}
      <div
        class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800"
      >
        {successMessage}
      </div>
    {/if}

    <!-- ═══ STEP 1: ENTER PHONE ═══ -->
    {#if step === "phone"}
      <form onsubmit={handleSendOtp} class="mt-5 space-y-4">
        <div>
          <label
            for="wa-phone-input"
            class="block text-xs font-bold uppercase tracking-wider text-[#4A5A52]"
          >
            WhatsApp Mobile Number
          </label>
          <div
            class="mt-1.5 flex rounded-xl border border-[#E4E4DC] bg-[#FAF7F0] focus-within:border-[#2B5A16] focus-within:bg-white transition-all overflow-hidden shadow-2xs"
          >
            <span
              class="flex items-center px-3.5 text-xs font-bold text-[#2B5A16] border-r border-[#E4E4DC] bg-[#F4EFE6]"
            >
              🇮🇳 +91
            </span>
            <input
              id="wa-phone-input"
              type="tel"
              bind:value={phone}
              placeholder="98765 43210"
              maxlength="10"
              class="w-full bg-transparent px-3.5 py-3 text-sm font-semibold text-[#0B1F2E] outline-none"
              required
            />
          </div>
          <p class="mt-1.5 text-[11px] text-[#4A5A52]/80 leading-normal">
            No password needed! We will deliver a fast 4-digit PIN directly on
            WhatsApp.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || phone.replace(/\D/g, "").length < 10}
          class="w-full rounded-2xl bg-[#25D366] hover:bg-[#20BA59] py-3.5 text-sm font-bold text-white shadow-md active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {#if isLoading}
            <span>Sending 4-Digit PIN...</span>
          {:else}
            <span>Send 4-Digit PIN via WhatsApp 💬</span>
          {/if}
        </button>

        <!-- HYBRID 1-TAP OPTION -->
        <div class="relative py-1">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-[#E4E4DC]"></div>
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span
              class="bg-white px-2 text-[#4A5A52]/70 font-semibold text-[10px]"
              >or 1-tap verify</span
            >
          </div>
        </div>

        <button
          type="button"
          onclick={handleStartInbound}
          disabled={isLoading || phone.replace(/\D/g, "").length < 10}
          class="w-full rounded-2xl border border-[#2B5A16]/20 bg-[#FAFBF7] hover:bg-[#EBF5E4] py-3 text-xs font-bold text-[#2B5A16] active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <span>⚡ 1-Tap Verify via WhatsApp (No PIN Typing)</span>
        </button>
      </form>
    {/if}

    <!-- ═══ STEP 2: ENTER 4-DIGIT PIN ═══ -->
    {#if step === "otp"}
      <form onsubmit={handleVerifyOtp} class="mt-5 space-y-4">
        <div
          class="rounded-2xl border border-[#D4E3C5] bg-[#F2F8EA] p-3.5 text-center space-y-1"
        >
          <p class="text-xs text-[#2B5A16]">
            Enter the 4-digit code sent to <strong class="font-bold"
              >+91 {phone.slice(-10)}</strong
            >
          </p>
          <p class="text-[10px] text-[#4A5A52]">
            ⏱️ Valid for 10 minutes • Tap "Copy Code" in WhatsApp
          </p>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <label
              for="wa-pin-input"
              class="block text-xs font-bold uppercase tracking-wider text-[#4A5A52]"
            >
              4-Digit Verification PIN
            </label>
            <button
              type="button"
              onclick={handlePasteFromClipboard}
              class="text-[11px] font-bold text-[#2B5A16] hover:underline"
            >
              📋 Paste from Clipboard
            </button>
          </div>
          <input
            id="wa-pin-input"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            bind:value={otpCode}
            placeholder="••••"
            maxlength="4"
            class="mt-2 w-full text-center tracking-[0.8em] text-3xl font-mono font-black rounded-2xl border border-[#E4E4DC] bg-[#FAF7F0] py-3 text-[#0B1F2E] outline-none focus:border-[#2B5A16] focus:bg-white transition-all shadow-inner"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || otpCode.trim().length !== 4}
          class="w-full rounded-2xl bg-[#143922] hover:bg-[#2B5A16] py-3.5 text-sm font-bold text-white shadow-md active:scale-98 transition-all disabled:opacity-50"
        >
          {#if isLoading}
            Verifying PIN...
          {:else}
            Verify &amp; Continue 🚀
          {/if}
        </button>

        <div class="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            onclick={() => (step = "phone")}
            class="text-[#4A5A52] hover:text-[#0B1F2E] font-medium"
          >
            ← Change Number
          </button>
          {#if resendCountdown > 0}
            <span class="text-xs text-[#4A5A52]/70 font-medium">
              Resend in {resendCountdown}s
            </span>
          {:else}
            <button
              type="button"
              onclick={handleSendOtp}
              class="font-bold text-[#25D366] hover:underline"
            >
              Resend PIN
            </button>
          {/if}
        </div>

        {#if inboundWaLink}
          <div class="pt-2 text-center">
            <a
              href={inboundWaLink}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-block text-[11px] font-bold text-[#2B5A16] hover:underline"
            >
              💬 WhatsApp message taking time? Tap to verify in 1-tap →
            </a>
          </div>
        {/if}
      </form>
    {/if}

    <!-- ═══ STEP 3: FLIRTY & PLAYFUL NAME ONBOARDING ═══ -->
    {#if step === "name"}
      <form onsubmit={handleSaveName} class="mt-5 space-y-4">
        <div
          class="rounded-2xl border border-[#FDE68A] bg-gradient-to-br from-[#FEF9C3] to-[#FEF3C7] p-4 text-center space-y-1.5 shadow-2xs"
        >
          <div class="text-2xl">🍄✨</div>
          <h4
            class="text-base font-bold text-[#0B1F2E]"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            What should our morning harvesters call you? 😉
          </h4>
          <p class="text-xs text-[#4A5A52] leading-relaxed">
            We write your name by hand on your fresh kraft punnet at 5:30 AM
            dawn. What can we call you, handsome / gorgeous? ✨
          </p>
        </div>

        <div>
          <label
            for="wa-flirty-name"
            class="block text-xs font-bold uppercase tracking-wider text-[#4A5A52]"
          >
            Your Name or Pet Name
          </label>
          <input
            id="wa-flirty-name"
            type="text"
            bind:value={customerName}
            placeholder="e.g. Advik, Chef Priya, Mushroom Lover, Gorgeous ✨"
            class="mt-1.5 w-full rounded-2xl border border-[#E4E4DC] bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#0B1F2E] outline-none focus:border-[#2B5A16] focus:bg-white transition-all shadow-2xs"
          />
        </div>

        <button
          type="submit"
          class="w-full rounded-2xl bg-[#143922] hover:bg-[#2B5A16] py-3.5 text-sm font-bold text-white shadow-md active:scale-98 transition-all"
        >
          That's Me! Let's Eat Fresh 🌿
        </button>

        <div class="text-center pt-1">
          <button
            type="button"
            onclick={handleSkipName}
            class="text-xs text-[#4A5A52] hover:text-[#0B1F2E] underline"
          >
            Just call me Foodie for now →
          </button>
        </div>
      </form>
    {/if}

    <!-- ═══ STEP 4: WAITING FOR 1-TAP INBOUND MESSAGE ═══ -->
    {#if step === "inbound_wait"}
      <div class="mt-6 text-center space-y-4">
        <div
          class="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F8EE] text-[#25D366]"
        >
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-30"
          ></span>
          <svg
            class="h-8 w-8 relative z-10"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75 0 1.83.504 3.543 1.38 5.008L2.25 21.75l4.908-1.29A9.704 9.704 0 0012 21.75c5.385 0 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 1.5a8.25 8.25 0 110 16.5 8.205 8.205 0 01-4.22-1.157l-.3-.178-3.09.813.827-3.023-.195-.31A8.204 8.204 0 013.75 12c0-4.556 3.694-8.25 8.25-8.25z"
              clip-rule="evenodd"
            />
          </svg>
        </div>

        <div>
          <h4 class="text-base font-bold text-[#0B1F2E]">
            Waiting for your WhatsApp tap... 💬
          </h4>
          <p
            class="text-xs text-[#4A5A52] mt-1 max-w-[280px] mx-auto leading-relaxed"
          >
            WhatsApp has opened with your pre-filled verification code. Hit <strong
              >"Send"</strong
            > in WhatsApp and return right here!
          </p>
        </div>

        <div class="space-y-2 pt-2">
          {#if inboundWaLink}
            <a
              href={inboundWaLink}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#20BA59] px-6 py-3 text-xs font-bold text-white shadow-md active:scale-98 transition-all"
            >
              <span>Re-Open WhatsApp Chat 💬</span>
            </a>
          {/if}

          <div>
            <button
              type="button"
              onclick={() => (step = "phone")}
              class="text-xs font-semibold text-[#4A5A52] hover:text-[#0B1F2E] underline"
            >
              Cancel &amp; use 4-digit PIN instead
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
