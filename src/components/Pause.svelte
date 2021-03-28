<script lang="ts">
  import Options from './Options.svelte';
  import { fly, fade } from 'svelte/transition';

  export let paused: boolean;

  let menu: 'main' | 'options' = 'main';
</script>

{#if paused}
  <div class="overlay" transition:fade={{ duration: 100 }}>
    {#if menu === 'main'}
      <div class="menu" transition:fly={{ duration: 200, x: 100 }}>
        <h1>FPS Test</h1>
        <button
          on:click={() => document.body.requestPointerLock()}>Resume</button>
        <button on:click={() => (menu = 'options')}>Options</button>
      </div>
    {:else}
      <div class="menu" transition:fly={{ duration: 200, x: 100 }}>
        <Options on:click={() => (menu = 'main')} />
      </div>
    {/if}
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    width: 100vw;
    height: 100vh;
    top: 0;
    left: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    user-select: none;
  }

  .menu {
    position: absolute;
    max-width: 600px;
    width: 100%;
    padding: 1em;
  }
</style>
