<script lang="ts">
  import { darkMode } from "../stores";
  import { copy } from "svelte-copy";
  import { Highlight } from "svelte-highlight";
  import java from "svelte-highlight/languages/java";
  import githubDark from "svelte-highlight/styles/github-dark";
  import github from "svelte-highlight/styles/github";
  import { parseJavaCode } from "../utils/javaParser";

  export let lines: Line[];
  export let startPoint: Point;
  export let saveFile: () => void;
  export let loadFile: (evt: Event) => void;
  export let loadRobot: (evt: Event) => void;

  let showCodeModal = false;
  let showJavaImportModal = false;
  let javaCodeInput = "";
  let importError = "";
  let copied = false;

  function generateCode() {
    let code = `// Generated path code\n`;
    code += `Pose2d startPose = new Pose2d(${startPoint.x.toFixed(2)}, ${startPoint.y.toFixed(2)}, Math.toRadians(${startPoint.heading === "linear" ? startPoint.startDeg : 0}));\n\n`;

    lines.forEach((line, idx) => {
      const method = line.controlPoints.length > 0 ? "tangentialTo" : "linearTo";
      const heading = line.endPoint.heading === "linear" ? line.endPoint.endDeg :
                      line.endPoint.heading === "constant" ? line.endPoint.degrees : 0;
      code += `.${method}(new Pose2d(${line.endPoint.x.toFixed(2)}, ${line.endPoint.y.toFixed(2)}, Math.toRadians(${heading})))\n`;
    });

    return code;
  }

  function handleJavaImport() {
    importError = "";
    const result = parseJavaCode(javaCodeInput);

    if (result) {
      startPoint = result.startPoint;
      lines = result.lines;
      showJavaImportModal = false;
      javaCodeInput = "";
    } else {
      importError = "Failed to parse Java code. Please ensure it contains valid Pose2d and spline method calls.";
    }
  }

  function clearAll() {
    if (confirm("Are you sure you want to clear all lines?")) {
      lines = [{
        endPoint: { x: 0, y: 0, heading: "linear", startDeg: 90, endDeg: 180 },
        controlPoints: [],
        color: "#56789A",
      }];
      startPoint = { x: 0, y: -64, heading: "linear", startDeg: 90, endDeg: 180 };
    }
  }
</script>

<svelte:head>
  {#if $darkMode === "dark"}
    {@html githubDark}
  {:else}
    {@html github}
  {/if}
</svelte:head>

<nav class="fixed top-0 left-0 right-0 h-20 bg-white dark:bg-neutral-800 shadow-md z-50 flex items-center px-6 justify-between">
  <div class="flex items-center gap-4">
    <h1 class="text-2xl font-semibold">SolversLib Visualizer</h1>
  </div>

  <div class="flex items-center gap-3">
    <button
      on:click={saveFile}
      class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
    >
      Export .p2p
    </button>

    <label class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors cursor-pointer text-sm">
      Import .p2p
      <input type="file" accept=".p2p,.pp" on:change={loadFile} class="hidden" />
    </label>

    <button
      on:click={() => { showJavaImportModal = true; }}
      class="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors text-sm"
    >
      Import Java
    </button>

    <label class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors cursor-pointer text-sm">
      Load Robot
      <input type="file" accept=".png" on:change={loadRobot} class="hidden" />
    </label>

    <button
      on:click={() => { showCodeModal = true; }}
      class="px-4 py-2 bg-slate-500 text-white rounded hover:bg-slate-600 transition-colors text-sm"
    >
      Export Code
    </button>

    <button
      on:click={clearAll}
      class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
    >
      Clear All
    </button>

    <button
      on:click={() => darkMode.toggle()}
      class="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
      title="Toggle Dark Mode"
    >
      {#if $darkMode === "dark"}
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
        </svg>
      {:else}
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      {/if}
    </button>
  </div>
</nav>

{#if showCodeModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4" on:click={() => { showCodeModal = false; }}>
    <div class="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-auto animate-modalf" on:click|stopPropagation>
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Export Code</h2>
        <button
          on:click={() => { showCodeModal = false; }}
          class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <div class="relative">
        <div class="absolute top-2 right-2 z-10">
          <button
            use:copy={generateCode()}
            on:svelte-copy={() => { copied = true; setTimeout(() => { copied = false; }, 2000); }}
            class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <Highlight language={java} code={generateCode()} />
      </div>
    </div>
  </div>
{/if}

{#if showJavaImportModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4" on:click={() => { showJavaImportModal = false; javaCodeInput = ""; importError = ""; }}>
    <div class="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-auto animate-modalf" on:click|stopPropagation>
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Import Java Code</h2>
        <button
          on:click={() => { showJavaImportModal = false; javaCodeInput = ""; importError = ""; }}
          class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
        Paste Java code containing Pose2d objects and spline method calls (linearTo, tangentialTo, splineTo).
      </p>

      {#if importError}
        <div class="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-3 rounded mb-4">
          {importError}
        </div>
      {/if}

      <textarea
        bind:value={javaCodeInput}
        placeholder="Paste your Java code here..."
        class="w-full h-64 p-3 border rounded dark:bg-neutral-700 dark:border-neutral-600 font-mono text-sm"
      ></textarea>

      <div class="flex gap-2 mt-4">
        <button
          on:click={handleJavaImport}
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Import
        </button>
        <button
          on:click={() => { showJavaImportModal = false; javaCodeInput = ""; importError = ""; }}
          class="px-4 py-2 bg-neutral-500 text-white rounded hover:bg-neutral-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
