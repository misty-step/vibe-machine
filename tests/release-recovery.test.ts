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
};

async function resumeDraft(options: Options = {}) {
  const sha = "a".repeat(40);
  const draft = {
    id: 7,
    draft: !options.published,
    assets: options.assets ? [{}] : [],
    author: { login: options.foreign ? "other" : "github-actions[bot]" },
    tag_name: `v${version}`,
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
          updateRelease: async (request: { target_commitish: string }) => {
            expect(request.target_commitish).toBe(sha);
            writes++;
          },
          getRelease: async () => ({ data: { ...draft, target_commitish: sha } }),
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
  it("resumes an empty bot draft at the verified source, retaining the generated version", async () => {
    const result = await resumeDraft();
    expect(result.writes).toBe(1);
    expect(result.outputs.release_created).toBe("true");
    expect(result.outputs.sha).toBe("a".repeat(40));
    expect(result.outputs.tag_name).toBe(`v${version}`);
  });

  it("refuses published/nonempty/foreign drafts, mismatched versions and immutable tags", async () => {
    for (const options of [{ published: true }, { assets: true }, { foreign: true }]) {
      await expect(resumeDraft(options)).rejects.toThrow("Only an empty bot draft");
    }
    await expect(resumeDraft({ wrongVersion: true })).rejects.toThrow("generated source version");
    await expect(resumeDraft({ movedTag: true })).rejects.toThrow("immutable tag");
  });
});
