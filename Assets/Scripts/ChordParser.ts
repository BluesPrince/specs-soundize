// ChordParser.ts: turns a spoken or typed progression into one chord symbol per bar.
// Example: "two bars of C minor, one bar of A flat, one bar of B flat" -> ["Cm", "Cm", "A♭", "B♭"]
// Pure logic, no Lens Studio APIs, so it runs anywhere.

export interface ParseResult {
  bars: string[];
  error?: string;
}

const NUMBER_WORDS: { [w: string]: number } = {
  a: 1, an: 1, one: 1, won: 1, single: 1,
  two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
};

// Spoken note names and homophones -> letter
const NOTE_WORDS: { [w: string]: string } = {
  a: "A", ay: "A", eh: "A",
  b: "B", be: "B", bee: "B",
  c: "C", see: "C", sea: "C", si: "C",
  d: "D", dee: "D",
  e: "E",
  f: "F", eff: "F", ef: "F",
  g: "G", gee: "G", jee: "G",
};

const FLAT = "♭";  // ♭
const SHARP = "♯"; // ♯

// Major-key scale degrees in semitones from the tonic, used by "two five one in F"
const DEGREE_SEMITONES: { [d: number]: number } = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };
const DEGREE_WORDS: { [w: string]: number } = {
  one: 1, i: 1, "1": 1, two: 2, ii: 2, "2": 2, to: 2, too: 2, three: 3, iii: 3, "3": 3,
  four: 4, iv: 4, "4": 4, five: 5, v: 5, "5": 5, six: 6, vi: 6, "6": 6, seven: 7, vii: 7, "7": 7,
};
const SHARP_NAMES = ["C", "C" + SHARP, "D", "E" + FLAT, "E", "F", "F" + SHARP, "G", "A" + FLAT, "A", "B" + FLAT, "B"];
const FLAT_NAMES = ["C", "D" + FLAT, "D", "E" + FLAT, "E", "F", "G" + FLAT, "G", "A" + FLAT, "A", "B" + FLAT, "B"];
const LETTER_PC: { [l: string]: number } = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function normalize(text: string): string[] {
  let t = text.toLowerCase();
  t = t.replace(/♭/g, " flat ").replace(/♯/g, " sharp ");
  // typed shorthand like "Ab", "C#m7", "Bbmaj7": split letter from accidental and quality
  t = t.replace(/\b([a-g])(#)/g, "$1 sharp ");
  t = t.replace(/\b([a-g])b(?=\s|$|m|maj|min|dim|sus|7|,)/g, "$1 flat ");
  t = t.replace(/\b([a-g])(maj7|maj|min7|min|m7b5|m7|m|dim7|dim|sus4|sus2|sus|7)\b/g, "$1 $2");
  t = t.replace(/\b(flat|sharp)(maj7|maj|min7|min|m7b5|m7|m|dim|sus|7)\b/g, "$1 $2");
  t = t.replace(/[.;:!?]/g, ",");
  t = t.replace(/\band then\b|\bthen\b|\band\b/g, ",");
  t = t.replace(/,/g, " , ");
  t = t.replace(/-/g, " ");
  return t.split(/\s+/).filter((w) => w.length > 0);
}

function readQuality(words: string[], i: number): { q: string; next: number } {
  const w = words[i], w2 = words[i + 1], w3 = words[i + 2];
  const isSeven = (x?: string) => x === "seven" || x === "7" || x === "seventh";
  if (w === "half" && (w2 === "diminished" || w2 === "dim")) {
    return { q: "m7" + FLAT + "5", next: i + (isSeven(w3) ? 3 : 2) };
  }
  if (w === "m7b5") return { q: "m7" + FLAT + "5", next: i + 1 };
  if (w === "minor" || w === "min" || w === "m") {
    if (isSeven(w2)) return { q: "m7", next: i + 2 };
    return { q: "m", next: i + 1 };
  }
  if (w === "m7" || w === "min7") return { q: "m7", next: i + 1 };
  if (w === "major" || w === "maj") {
    if (isSeven(w2)) return { q: "maj7", next: i + 2 };
    return { q: "", next: i + 1 };
  }
  if (w === "maj7") return { q: "maj7", next: i + 1 };
  if (w === "diminished" || w === "dim") {
    if (isSeven(w2)) return { q: "dim7", next: i + 2 };
    return { q: "dim", next: i + 1 };
  }
  if (w === "dim7") return { q: "dim7", next: i + 1 };
  if (w === "sus" || w === "suspended" || w === "sus4") {
    if (w2 === "four" || w2 === "4") return { q: "sus4", next: i + 2 };
    if (w2 === "two" || w2 === "2") return { q: "sus2", next: i + 2 };
    return { q: "sus", next: i + 1 };
  }
  if (w === "sus2") return { q: "sus2", next: i + 1 };
  if (w === "dominant" && isSeven(w2)) return { q: "7", next: i + 2 };
  if (isSeven(w)) return { q: "7", next: i + 1 };
  return { q: "", next: i };
}

// "two five one in F", "ii V I in F", "2 5 1 in B flat"
function tryNumberedProgression(words: string[]): string[] | null {
  const inIdx = words.lastIndexOf("in");
  if (inIdx < 1 || inIdx > words.length - 2) return null;
  const degrees: number[] = [];
  for (let k = 0; k < inIdx; k++) {
    const w = words[k];
    if (w === "," ) continue;
    const d = DEGREE_WORDS[w];
    if (d === undefined) return null;
    degrees.push(d);
  }
  if (degrees.length < 2) return null;
  const letter = NOTE_WORDS[words[inIdx + 1]];
  if (!letter) return null;
  let pc = LETTER_PC[letter];
  const acc = words[inIdx + 2];
  let useFlats = letter === "F";
  if (acc === "flat") { pc = (pc + 11) % 12; useFlats = true; }
  else if (acc === "sharp") { pc = (pc + 1) % 12; }
  const names = useFlats ? FLAT_NAMES : SHARP_NAMES;
  const quality: { [d: number]: string } = { 1: "maj7", 2: "m7", 3: "m7", 4: "maj7", 5: "7", 6: "m7", 7: "m7" + FLAT + "5" };
  return degrees.map((d) => names[(pc + DEGREE_SEMITONES[d]) % 12] + quality[d]);
}

export function parseProgression(text: string): ParseResult {
  const words = normalize(text || "");
  if (words.length === 0) return { bars: [], error: "Say a progression, like: two bars of C minor, one bar of A flat." };

  const numbered = tryNumberedProgression(words);
  if (numbered) return { bars: numbered };

  const bars: string[] = [];
  let i = 0;
  let pendingCount: number | null = null;
  const skipped: string[] = [];

  while (i < words.length) {
    const w = words[i];
    if (w === ",") { i++; continue; }

    // Count: digits or number words, but "a"/"an" only when a bar word follows
    const isBarWord = (x?: string) => x === "bar" || x === "bars" || x === "measure" || x === "measures";
    if (/^\d+$/.test(w) && (isBarWord(words[i + 1]) || isBarWord(words[i + 2]))) {
      pendingCount = parseInt(w, 10); i++; continue;
    }
    if (NUMBER_WORDS[w] !== undefined && (isBarWord(words[i + 1]) || (w !== "a" && w !== "an" && isBarWord(words[i + 2])))) {
      pendingCount = NUMBER_WORDS[w]; i++; continue;
    }
    if (isBarWord(w)) { if (pendingCount === null) pendingCount = 1; i++; continue; }
    if (w === "of" || w === "on" || w === "the" || w === "chord" || w === "play" || w === "give" || w === "me") { i++; continue; }

    const letter = NOTE_WORDS[w];
    if (letter) {
      let name = letter;
      let j = i + 1;
      if (words[j] === "flat") { name += FLAT; j++; }
      else if (words[j] === "sharp") { name += SHARP; j++; }
      const q = readQuality(words, j);
      const count = pendingCount === null ? 1 : Math.max(1, Math.min(16, pendingCount));
      for (let k = 0; k < count; k++) bars.push(name + q.q);
      pendingCount = null;
      i = q.next;
      continue;
    }
    skipped.push(w);
    i++;
  }

  if (bars.length === 0) {
    return { bars: [], error: "I didn't catch a chord. Try: two bars of C minor, one bar of A flat." };
  }
  if (bars.length > 16) return { bars: bars.slice(0, 16), error: "Kept the first 16 bars." };
  return { bars };
}

// Root of a chord symbol as a pitch class 0-11 (C = 0), for the bass.
export function rootPitchClass(chord: string): number {
  const letter = chord.charAt(0);
  let pc = LETTER_PC[letter];
  if (pc === undefined) return 0;
  const acc = chord.charAt(1);
  if (acc === FLAT) pc = (pc + 11) % 12;
  else if (acc === SHARP) pc = (pc + 1) % 12;
  return pc;
}
