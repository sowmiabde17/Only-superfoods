<!--
  InstallAppBanner.svelte — Smart PWA "Add to Home Screen" Banner & Guide
  Features:
  - Captures Android/Chrome 'beforeinstallprompt'
  - Detects iOS Safari and provides 2-step "Add to Home Screen" visual guide
  - Dismissible with 7-day memory in localStorage
  - Can be triggered anytime via 'osf:trigger-install' (e.g. from hamburger menu)
  - Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';

  const DISMISSED_KEY = 'osf_pwa_dismissed_until';

  let deferredPrompt = $state(null);
  let showBanner = $state(false);
  let showIOSModal = $state(false);
  let isStandalone = $state(false);
  let isIOS = $state(false);

  function checkStandalone() {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function checkIsIOS() {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua) && !window.MSStream;
  }

  function handleBeforeInstallPrompt(e) {
    e.preventDefault();
    deferredPrompt = e;

    // Check if dismissed recently
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    // Delay prompt slightly to let user see homepage first
    setTimeout(() => {
      if (!isStandalone) {
        showBanner = true;
      }
    }, 3500);
  }

  function handleManualTrigger() {
    if (isStandalone) {
      alert('Only Superfoods is already installed on your device! 🌱');
      return;
    }

    if (deferredPrompt) {
      showBanner = true;
      handleInstallClick();
    } else if (isIOS) {
      showIOSModal = true;
    } else {
      showBanner = true;
    }
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        showBanner = false;
      }
      deferredPrompt = null;
    } else if (isIOS) {
      showBanner = false;
      showIOSModal = true;
    } else {
      // Fallback instruction
      alert('To install, tap your browser menu (⋮) and select "Add to Home screen" or "Install App".');
    }
  }

  function handleDismiss() {
    showBanner = false;
    // Dismiss for 7 days
    try {
      localStorage.setItem(DISMISSED_KEY, (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
    } catch (e) {}
  }

  onMount(() => {
    isStandalone = checkStandalone();
    isIOS = checkIsIOS();

    if (isStandalone) return;

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('osf:trigger-install', handleManualTrigger);

    // If iOS and not dismissed, show friendly install pill after delay
    if (isIOS) {
      const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
      if (!dismissedUntil || Date.now() > parseInt(dismissedUntil, 10)) {
        setTimeout(() => {
          showBanner = true;
        }, 4500);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('osf:trigger-install', handleManualTrigger);
    };
  });
</script>

<!-- Floating PWA Install Banner (Docked above bottom navigation) -->
{#if showBanner && !isStandalone}
  <aside
    class="fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[45] mx-auto max-w-[420px] lg:bottom-5 lg:right-6 lg:left-auto lg:mx-0 lg:w-[380px] overflow-hidden rounded-2xl border border-[#A8D632] bg-[#FAF7F0] p-3 shadow-xl backdrop-blur-md transition-all duration-300"
    aria-label="Install Only Superfoods App"
  >
    <div class="flex items-center gap-3">
      <!-- App Icon Thumbnail -->
      <img
        src="/icons/icon-192.png"
        alt="Only Superfoods App Icon"
        class="h-11 w-11 rounded-xl object-cover shadow-2xs border border-[#E4E4DC] shrink-0"
      />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="rounded-full bg-[#2B5A16] px-1.5 py-0.2 text-[8.5px] font-bold text-white uppercase tracking-wider">
            Fast App
          </span>
          <h4 class="text-xs font-bold text-[#0B1F2E] truncate">
            Install Only Superfoods
          </h4>
        </div>
        <p class="text-[10.5px] text-[#4A5A52] leading-tight mt-0.5 truncate">
          1-Tap morning harvest drops &amp; quick re-order
        </p>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onclick={handleInstallClick}
          class="rounded-xl bg-[#2B5A16] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#1E3F20] active:scale-95 transition-all"
        >
          Install
        </button>

        <button
          type="button"
          onclick={handleDismiss}
          class="flex h-7 w-7 items-center justify-center rounded-full text-[#4A5A52] hover:bg-[#E4E4DC]/60 active:scale-95 transition-all"
          aria-label="Dismiss Install Prompt"
        >
          ✕
        </button>
      </div>
    </div>
  </aside>
{/if}

<!-- iOS Safari Step-by-Step Installation Modal -->
{#if showIOSModal}
  <div
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
    onclick={() => (showIOSModal = false)}
    aria-hidden="true"
  ></div>

  <div
    class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-3xl border-t border-[#E4E4DC] bg-white p-6 shadow-2xl transition-transform duration-300 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border"
    role="dialog"
    aria-label="How to Install on iPhone"
  >
    <div class="flex items-center justify-between border-b border-[#E4E4DC] pb-3">
      <div class="flex items-center gap-2">
        <img src="/icons/icon-192.png" alt="App Icon" class="h-8 w-8 rounded-lg" />
        <h3 class="text-sm font-bold text-[#0B1F2E]">
          Install on your iPhone / iPad
        </h3>
      </div>
      <button
        type="button"
        onclick={() => (showIOSModal = false)}
        class="flex h-7 w-7 items-center justify-center rounded-full text-[#4A5A52] hover:bg-[#F7F7F2]"
      >
        ✕
      </button>
    </div>

    <div class="mt-4 space-y-3.5 text-xs text-[#0B1F2E]">
      <div class="flex items-start gap-3 rounded-xl bg-[#FAF7F0] p-3 border border-[#E4E4DC]">
        <div class="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#2B5A16] font-bold text-xs shrink-0 shadow-2xs">
          1
        </div>
        <div>
          <p class="font-bold">Tap the Share Button</p>
          <p class="text-[11px] text-[#4A5A52] mt-0.5">
            At the bottom of your Safari screen, tap the share icon (a square with an arrow pointing up <span class="text-sm">⎋</span>).
          </p>
        </div>
      </div>

      <div class="flex items-start gap-3 rounded-xl bg-[#FAF7F0] p-3 border border-[#E4E4DC]">
        <div class="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#2B5A16] font-bold text-xs shrink-0 shadow-2xs">
          2
        </div>
        <div>
          <p class="font-bold">Select "Add to Home Screen"</p>
          <p class="text-[11px] text-[#4A5A52] mt-0.5">
            Scroll down the options list and tap <strong>"Add to Home Screen" <span class="text-sm">⊞</span></strong>, then tap <strong>Add</strong> at top right.
          </p>
        </div>
      </div>

      <div class="rounded-xl bg-[#EBF7DC] p-3 text-[11px] text-[#2B5A16] font-semibold flex items-center gap-2">
        <span>✨</span>
        <span>Only Superfoods will open in full-screen native app mode without the browser bar!</span>
      </div>

      <button
        type="button"
        onclick={() => (showIOSModal = false)}
        class="w-full rounded-xl bg-[#2B5A16] py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1E3F20]"
      >
        Got It! 👍
      </button>
    </div>
  </div>
{/if}

