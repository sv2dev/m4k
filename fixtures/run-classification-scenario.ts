/** Isolate model mocks from the other package suites and from real-container smoke tests. */
export async function runClassificationScenario(scenario: string) {
  const child = Bun.spawn(
    [
      process.execPath,
      new URL("./classification-lifecycle.ts", import.meta.url).pathname,
      scenario,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const timeout = setTimeout(() => child.kill(), 4_000);
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code !== 0) throw new Error(`Classification fixture failed (${code}): ${stderr}`);
    return JSON.parse(stdout);
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null) child.kill();
  }
}
