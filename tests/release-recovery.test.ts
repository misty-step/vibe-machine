import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/release.yml", "utf8");
const scripts = [...workflow.matchAll(/ {10}script: \|\n((?: {12}.*\n|\n)+)/g)].map((match) =>
  match[1].replace(/^ {12}/gm, "")
);
const script = scripts.find((source) => source.includes("Only an empty bot draft"));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const version = JSON.parse(readFileSync("package.json", "utf8")).version;

type Options = {
  published?: boolean;
  assets?: boolean;
  foreign?: boolean;
  wrongVersion?: boolean;
  movedTag?: boolean;
  corrupt?: "tag" | "notes" | "prerelease";
};

async function resumeDraft(options: Options = {}) {
  const sha = "a".repeat(40);
  const draft = {
    id: 7,
    draft: !options.published,
    assets: options.assets ? [{}] : [],
    author: { login: options.foreign ? "other" : "github-actions[bot]" },
    tag_name: `v${version}`,
    name: `v${version}`,
    body: "Canonical generated release notes",
    prerelease: false,
  };
  const outputs: Record<string, string> = {};
  let writes = 0;
  await new AsyncFunction("github", "context", "core", "process", script)(
    {
      paginate: async () => [draft],
      rest: {
        repos: {
          listReleases: () => {},
          getContent: async () => ({
            data: {
              content: Buffer.from(
                JSON.stringify({ version: options.wrongVersion ? "0.0.0" : version })
              ).toString("base64"),
            },
          }),
          updateRelease: async (request: {
            target_commitish: string;
            tag_name: string;
            body: string;
            draft: boolean;
          }) => {
            expect(request.target_commitish).toBe(sha);
            expect(request.tag_name).toBe(draft.tag_name);
            expect(request.body).toBe(draft.body);
            expect(request.draft).toBe(true);
            writes++;
          },
          getRelease: async () => ({
            data: {
              ...draft,
              target_commitish: sha,
              tag_name: options.corrupt === "tag" ? "untagged-fixture" : draft.tag_name,
              body: options.corrupt === "notes" ? "Unexpected note rewrite" : draft.body,
              prerelease: options.corrupt === "prerelease" ? !draft.prerelease : draft.prerelease,
            },
          }),
        },
        git: {
          getRef: async () => {
            if (options.movedTag) return { data: { object: { sha: "b".repeat(40) } } };
            throw Object.assign(new Error("No tag"), { status: 404 });
          },
        },
      },
    },
    { repo: {}, sha },
    {
      setOutput: (key: string, value: string) => {
        outputs[key] = value;
      },
    },
    { env: { RESUME_TAG: draft.tag_name } }
  );
  return { writes, outputs };
}

describe("unpublished native release recovery", () => {
  it("requires the manifest's actual tag, not draft-list visibility, before preparing another PR", async () => {
    const source = scripts.find((s) => s.includes("Missing generator baseline version"));
    for (const status of [undefined, 404, 403, 500]) {
      const outputs: Record<string, string> = {};
      const check = new AsyncFunction("github", "context", "core", source)(
        {
          rest: {
            repos: {
              getContent: async () => ({
                data: { content: Buffer.from(JSON.stringify({ ".": version })).toString("base64") },
              }),
            },
            git: {
              getRef: async (request: { ref: string }) => {
                expect(request.ref).toBe(`tags/v${version}`);
                if (status) throw Object.assign(new Error("Tag lookup failed"), { status });
                return { data: { object: { sha: "a".repeat(40) } } };
              },
            },
          },
        },
        { repo: {}, sha: "a".repeat(40) },
        {
          setOutput: (key: string, value: string) => {
            outputs[key] = value;
          },
        }
      );
      if (status === 403 || status === 500)
        await expect(check).rejects.toThrow("Tag lookup failed");
      else {
        await check;
        expect(outputs.exists).toBe(status === 404 ? "false" : "true");
      }
    }
    expect(workflow).toContain("if: steps.baseline.outputs.exists == 'true'");
  });

  it("resumes an empty bot draft at the verified source, retaining the generated version", async () => {
    const result = await resumeDraft();
    expect(result.writes).toBe(1);
    expect(result.outputs.release_created).toBe("true");
    expect(result.outputs.id).toBe("7");
    expect(result.outputs.sha).toBe("a".repeat(40));
    expect(result.outputs.tag_name).toBe(`v${version}`);
  });

  it("refuses published/nonempty/foreign drafts, mismatched versions and immutable tags", async () => {
    for (const options of [{ published: true }, { assets: true }, { foreign: true }]) {
      await expect(resumeDraft(options)).rejects.toThrow("Only an empty bot draft");
    }
    await expect(resumeDraft({ wrongVersion: true })).rejects.toThrow("generated source version");
    await expect(resumeDraft({ movedTag: true })).rejects.toThrow("immutable tag");
    for (const corrupt of ["tag", "notes", "prerelease"] as const) {
      await expect(resumeDraft({ corrupt })).rejects.toThrow("metadata readback failed");
    }
  });
});
