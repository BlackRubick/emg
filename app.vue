<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <UNotifications />
</template>

<script setup lang="ts">
useHead({
  htmlAttrs: { class: 'dark' },
})
</script>
