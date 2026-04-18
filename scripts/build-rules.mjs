import { mkdir, writeFile } from "node:fs/promises";

const LISTS = [
  {
    name: "easylist",
    url: "https://easylist.to/easylist/easylist.txt"
  },
  {
    name: "easyprivacy",
    url: "https://easylist.to/easylist/easyprivacy.txt"
  }
];

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
  // abp2dnr exports a CLI and programmatic API. The simplest stable approach
  // for GitHub Actions is to shell out to its CLI (npx).
  //
  // However, we can’t assume node’s child_process is allowed everywhere without
  // extra complexity, so we use the programmatic API if available.
  //
  // abp2dnr’s API surface may evolve; if this fails in CI, use the CLI path.
  const abp2dnr = await import("@eyeo/abp2dnr");

  // API compatibility shim:
  // - Some versions export `convert` (list → ruleset)
  // - Others export `convertFilter` (single filter → rules)
  if (typeof abp2dnr.convert === "function") {
    return await abp2dnr.convert(filtersText);
  }

  if (typeof abp2dnr.convertFilters === "function") {
    return await abp2dnr.convertFilters(filtersText);
  }

  throw new Error(
    "Unsupported @eyeo/abp2dnr API. Update scripts/build-rules.mjs to use the CLI: npx @eyeo/abp2dnr"
  );
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

  await mkdir("docs", { recursive: true });
  await writeFile("docs/rules.json", JSON.stringify(out, null, 2), "utf8");
  await writeFile("docs/index.html", "<!doctype html><meta charset=utf-8><title>rules</title><pre>rules.json</pre>", "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

