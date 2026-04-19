/*
 * Copyright (c) 2026 Varad Dnyaneshwar Modhekar
 * Licensed under the GNU Affero General Public License v3.0
 */
import sodium from "libsodium-wrappers-sumo";
import { WORDLIST } from "./wordlist.js";

export async function generateDicewarePassphrase(wordCount = 5) {
  await sodium.ready;

  const words = [];
  const max = WORDLIST.length; // 7776

  // 2^32 - 1
  const MAX_UINT32 = 0xffffffff;

  // Largest multiple of max below 2^32
  const maxValid = Math.floor((MAX_UINT32 + 1) / max) * max;

  for (let i = 0; i < wordCount; i++) {
    let index;

    while (true) {
      const bytes = sodium.randombytes_buf(4);

      const num =
        (bytes[0] << 24) |
        (bytes[1] << 16) |
        (bytes[2] << 8) |
        bytes[3];

      const unsigned = num >>> 0; // convert to unsigned

      if (unsigned < maxValid) {
        index = unsigned % max;
        break;
      }
    }

    words.push(WORDLIST[index]);
  }

  return words.join(" ");
}
const data =  await generateDicewarePassphrase()
console.log(data)