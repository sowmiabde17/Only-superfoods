<!--
  FluidShader.svelte — OGL.js ambient WebGL fluid background
  Renders a very subtle, GPU-accelerated lime-green & navy fluid wave.
  Keeps JS main thread free. Zero performance impact on mobile.
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';

  let canvasRef = $state(null);
  let animationId = null;
  let renderer = null;

  onMount(async () => {
    // Check prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    try {
      const { Renderer, Program, Mesh, Triangle } = await import('ogl');

      if (!canvasRef) return;

      renderer = new Renderer({
        canvas: canvasRef,
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 1.5), // Cap at 1.5 for mid-range Android perf
      });

      const gl = renderer.gl;

      const geometry = new Triangle(gl);

      // Subtle lime-green (#A8D632 -> [0.66, 0.84, 0.20]) and deep navy (#0B1F2E -> [0.04, 0.12, 0.18])
      const vertex = /* glsl */ `
        attribute vec2 uv;
        attribute vec2 position;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `;

      const fragment = /* glsl */ `
        precision highp float;
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv;
          // Organic fluid wave pattern
          float w1 = sin(uv.x * 3.5 + uTime * 0.4) * 0.5 + 0.5;
          float w2 = cos(uv.y * 3.0 - uTime * 0.35 + uv.x * 2.0) * 0.5 + 0.5;
          float fluid = smoothstep(0.2, 0.8, (w1 + w2) * 0.5);

          // Subtle blend: white base, translucent brand lime-green and soft navy
          vec3 lime = vec3(0.66, 0.84, 0.20);
          vec3 navy = vec3(0.04, 0.12, 0.18);
          vec3 color = mix(lime, navy, fluid * 0.4);

          // Very low alpha to maintain pure white #FFFFFF feel with delicate ambient motion
          float alpha = fluid * 0.07;
          gl_FragColor = vec4(color, alpha);
        }
      `;

      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          uTime: { value: 0 },
        },
        transparent: true,
      });

      const mesh = new Mesh(gl, { geometry, program });

      function resize() {
        if (!canvasRef || !renderer) return;
        const width = canvasRef.parentElement.clientWidth;
        const height = canvasRef.parentElement.clientHeight;
        renderer.setSize(width, height);
      }

      resize();
      window.addEventListener('resize', resize, { passive: true });

      let lastTime = 0;
      function update(t) {
        animationId = requestAnimationFrame(update);
        // Throttle updates to save battery on mobile (approx 30-60fps)
        if (t - lastTime < 24) return;
        lastTime = t;

        program.uniforms.uTime.value = t * 0.001;
        renderer.render({ scene: mesh });
      }

      animationId = requestAnimationFrame(update);

      return () => {
        window.removeEventListener('resize', resize);
      };
    } catch (err) {
      console.warn('WebGL fluid shader skipped:', err);
    }
  });

  onDestroy(() => {
    if (animationId) cancelAnimationFrame(animationId);
    if (renderer && renderer.gl) {
      const gl = renderer.gl;
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) loseContext.loseContext();
    }
  });
</script>

<canvas
  bind:this={canvasRef}
  class="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-90"
  aria-hidden="true"
></canvas>

