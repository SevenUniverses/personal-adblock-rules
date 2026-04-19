import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const LISTS = [
  {
    name: "easylist",
    url: "https://easylist.to/easylist/easylist.txt"
  },
  {
    name: "easyprivacy",
    url: "https://easylist.to/easylist/easyprivacy.txt"
  },
  // uBlock Origin public filter lists (ABP-compatible syntax)
  {
    name: "ublock-filters",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt"
  },
  {
    name: "ublock-privacy",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt"
  },
  {
    name: "ublock-badware",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt"
  },
  {
    name: "ublock-unbreak",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt"
  }
];

// Chrome’s DNR dynamic quota is tiered; safe rules can go higher on newer Chrome,
// but keep a cap to avoid update failures on older/baseline environments.
const MAX_RULES_OUT = 30000;

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      // Some hosts behave better with a UA.
      "User-Agent": "adblocker-rules-builder/1.0"
    }
  });
  if (!res.ok) throw new Error(`Failed fetching ${url}: ${res.status}`);
  return await res.text();
}

function nowIso() {
  return new Date().toISOString();
}

async function convertToDnr({ filtersText }) {
  // Use the CLI for stability across @eyeo/abp2dnr versions.
  // Equivalent to: `cat filters.txt | npx @eyeo/abp2dnr > rules.json`
  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["--yes", "@eyeo/abp2dnr"],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`abp2dnr failed (exit ${code}).\n${stderr}`.trim()));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`Failed to parse abp2dnr output as JSON.\n${stderr}`.trim()));
      }
    });

    child.stdin.end(filtersText);
  });
}

async function main() {
  const fetched = await Promise.all(
    LISTS.map(async (l) => ({ name: l.name, url: l.url, text: await fetchText(l.url) }))
  );

  const combined = fetched.map((f) => `! ---- ${f.name} (${f.url}) ----\n${f.text}`).join("\n\n");

  const ruleset = await convertToDnr({ filtersText: combined });

  // Normalize to the shape your extension expects.
  const out = {
    version: `github-${nowIso()}`,
    generatedAt: nowIso(),
    sources: fetched.map(({ name, url }) => ({ name, url })),
    rules: ruleset?.rules ?? ruleset
  };

  if (!Array.isArray(out.rules)) {
    throw new Error("Conversion did not produce an array of rules.");
  }

  if (out.rules.length > MAX_RULES_OUT) {
    out.rules = out.rules.slice(0, MAX_RULES_OUT);
    out.truncated = true;
    out.truncatedTo = MAX_RULES_OUT;
  }

  await mkdir("docs", { recursive: true });
  await writeFile("docs/rules.json", JSON.stringify(out, null, 2), "utf8");
  await writeFile("docs/index.html", "<!doctype html><meta charset=utf-8><title>rules</title><pre>rules.json</pre>", "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

