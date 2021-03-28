<script lang="ts">
  import { settings } from '../store';
</script>

<h1>Options</h1>

<h2>Controls</h2>
<label>
  <span>Mouse Sensitivity: {$settings.mouseSensitivity}</span><br />
  <input
    type="range"
    min="0.01"
    max="30"
    step="0.01"
    bind:value={$settings.mouseSensitivity} />
</label>

<h2>Audio</h2>
<label>
  <span>Volume: {Math.round($settings.masterVolume * 100)}</span><br />
  <input
    type="range"
    min="0"
    max="1"
    step="0.01"
    bind:value={$settings.masterVolume} />
</label>

<h2>Video</h2>
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
