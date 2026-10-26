import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/**
 * Negativtests für die Schichtregel (SPEC 4, Abnahme T1):
 * ESLint muss anschlagen, wenn eine Schicht gegen die Abhängigkeitsrichtung
 * importiert.
 */
const eslint = new ESLint();

async function lint(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter(
    (m) => m.ruleId === "no-restricted-imports",
  );
}

describe("Schichtregel (ESLint)", () => {
  it("meldet UI -> data/indexeddb", async () => {
    const messages = await lint(
      "src/ui/Fixture.tsx",
      'import "../data/indexeddb";\nexport {};\n',
    );
    expect(messages).toHaveLength(1);
  });

  it("meldet UI -> idb", async () => {
    const messages = await lint(
      "src/ui/Fixture.tsx",
      'import "idb";\nexport {};\n',
    );
    expect(messages).toHaveLength(1);
  });

  it("meldet Domäne -> UI", async () => {
    const messages = await lint(
      "src/domain/fixture.ts",
      'import "../ui/App";\nexport {};\n',
    );
    expect(messages).toHaveLength(1);
  });

  it("meldet Domäne -> React", async () => {
    const messages = await lint(
      "src/domain/fixture.ts",
      'import "react";\nexport {};\n',
    );
    expect(messages).toHaveLength(1);
  });

  it("meldet Datenschicht -> Domäne", async () => {
    const messages = await lint(
      "src/data/fixture.ts",
      'import "../domain";\nexport {};\n',
    );
    expect(messages).toHaveLength(1);
  });

  it("meldet Modell -> Datenschicht", async () => {
    const messages = await lint(
      "src/model/fixture.ts",
      'import "../data/repositories";\nexport {};\n',
    );
    expect(messages).toHaveLength(1);
  });

  it("erlaubt UI -> Domäne und Domäne -> Modell", async () => {
    expect(
      await lint("src/ui/Fixture.tsx", 'import "../domain";\nexport {};\n'),
    ).toHaveLength(0);
    expect(
      await lint("src/domain/fixture.ts", 'import "../model";\nexport {};\n'),
    ).toHaveLength(0);
  });

  it("erlaubt der Composition Root, alles zu verdrahten", async () => {
    expect(
      await lint(
        "src/app/fixture.ts",
        'import "../data/indexeddb";\nimport "../ui/App";\nexport {};\n',
      ),
    ).toHaveLength(0);
  });
});
