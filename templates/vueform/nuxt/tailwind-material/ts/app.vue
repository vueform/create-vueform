<template>
  <div class="max-w-[320px] h-screen flex items-center justify-center mx-auto">
    <ClientOnly>
      <Vueform>
        <TextElement name="hello_world" label="Hello" placeholder="World" />
      </Vueform>
    </ClientOnly>
  </div>
</template>