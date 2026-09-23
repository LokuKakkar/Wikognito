import { describe, expect, it } from "vitest";
import { generatePuzzle } from "../generator/puzzle-generator.js";
import { CompactPuzzleV2Schema, toCompactPuzzle, fromCompactPuzzle } from "./compact.js";
import { decodeClientPayload, encodeClientPayload } from "./payload.js";

const PET_TITLE = "Pet door";
const PET_BODY = `Pet door is an opening that allows a pet to enter.
A Pet door can be installed in a wall or a door.
Another Pet door may include a magnetic flap.`;

function makePetPuzzle() {
  return generatePuzzle({
    puzzleId: "puzzle-pet-door",
    puzzleNumber: 7,
    scheduledDate: "2026-08-19",
    generatorVersion: "1.0.0",
    title: PET_TITLE,
    body: PET_BODY,
  });
}

describe("compact puzzle V2", () => {
  it("stores title text separately from title token stream indexes", () => {
    const { clientPuzzle } = makePetPuzzle();
    const compact = toCompactPuzzle(clientPuzzle);

    expect(compact.v).toBe(2);
    expect(compact.title).toBe("Pet door");
    expect(compact.titleTokenIndexes.length).toBeGreaterThan(2);
    expect(
      compact.titleTokenIndexes.every((index) => index >= 0 && index < compact.stream.length),
    ).toBe(true);
    expect(CompactPuzzleV2Schema.safeParse(compact).success).toBe(true);

    const decoded = fromCompactPuzzle(compact);
    expect(decoded.title).toBe("Pet door");
    expect(decoded.titleTokenIds).toHaveLength(compact.titleTokenIndexes.length);
  });

  it("round-trips encode/decode without reconstructing the title from the stream", () => {
    const { publicDto } = makePetPuzzle();
    const decoded = decodeClientPayload(publicDto.payload);
    expect(decoded.title).toBe("Pet door");
    expect(decoded.titleTokenIds.length).toBeGreaterThan(2);

    const again = decodeClientPayload(encodeClientPayload(decoded));
    expect(again.title).toBe("Pet door");
    expect(again.titleTokenIds).toEqual(decoded.titleTokenIds);
  });

  it("rejects invalid titleTokenIndexes", () => {
    const { clientPuzzle } = makePetPuzzle();
    const compact = toCompactPuzzle(clientPuzzle);
    const invalid = { ...compact, titleTokenIndexes: [compact.stream.length] };
    expect(CompactPuzzleV2Schema.safeParse(invalid).success).toBe(false);
  });

  it("rejects V1 payloads", () => {
    const v1 = {
      v: 1,
      id: "x",
      n: 1,
      d: "2026-08-19",
      g: "1.0.0",
      dict: ["Pet"],
      stream: [[0, 0, 3, 3]],
      title: [0],
    };
    expect(CompactPuzzleV2Schema.safeParse(v1).success).toBe(false);
  });
});
