<script lang="ts">
  import { settings } from '../store';
</script>

<h1>Options</h1>

<label>
  <span>FOV: {$settings.fov}</span><br />
  <input type="range" min="60" max="120" bind:value={$settings.fov} />
</label>

<button on:click>Back</button>

<style>
  label {
    display: block;
    margin-bottom: 1em;
  }
</style>
