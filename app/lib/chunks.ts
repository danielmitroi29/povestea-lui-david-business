/*
 * Imparte povestea in bucati de cate 4 propozitii pentru voce. Bucatile scurte
 * pornesc repede, iar fiecare se salveaza separat. Folosit si pe server, si in
 * pagina, deci impartirea trebuie sa fie identica in ambele locuri.
 */
const SENTENCES_PER_CHUNK = 4;

export function splitStory(story: string): string[] {
  // Ultima propozitie poate sa nu aiba punct; `$` o prinde si pe ea
  const sentences = story.match(/[^.!?\n]+(?:[.!?\n]+|$)/g) ?? [story];
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_CHUNK) {
    const c = sentences.slice(i, i + SENTENCES_PER_CHUNK).join("").trim();
    if (c) chunks.push(c);
  }
  return chunks.length ? chunks : [story];
}
