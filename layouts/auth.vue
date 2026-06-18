<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-gray-950 to-gray-950"></div>
      <!-- Animated EMG wave background -->
      <svg class="absolute bottom-0 left-0 right-0 opacity-5" viewBox="0 0 1440 200" preserveAspectRatio="none">
        <path d="M0,100 L50,100 L60,40 L70,160 L80,20 L90,180 L100,60 L110,140 L120,100 L200,100 L210,50 L220,150 L230,30 L240,170 L250,80 L260,120 L270,100 L1440,100" stroke="#14b8a6" stroke-width="2" fill="none">
          <animateTransform attributeName="transform" type="translate" values="-200 0;200 0;-200 0" dur="8s" repeatCount="indefinite"/>
        </path>
      </svg>
    </div>
    <slot />
  </div>
</template>
