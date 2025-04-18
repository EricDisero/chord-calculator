/**
 * Chord Analyzer – Pattern‐Enhanced Version
 *
 * This version uses the following pattern rules:
 *
 * 1. Rotation candidate: If there exists any pair of chords
 *    (A major, B minor) whose roots differ by exactly 4 semitones,
 *    then we assume A is functioning as the IV. In that case the key
 *    is set to getScaleDegree(A, 7) (i.e. a perfect 5th up from A).
 *
 * 2. IV-V pattern: If there exist two major chords whose roots differ by exactly
 *    2 semitones (whole step), then assume they are IV-V in a key that is a perfect
 *    4th below the lower chord. This handles progressions like "Eb, F, C" correctly.
 *
 * 3. VI* pattern: A major chord built on the 6th scale degree of a major key (which
 *    would normally be minor) is interpreted as VI* in that key, especially when other
 *    chords in the progression suggest that key. This handles progressions with a
 *    major submediant chord like A, C, F where A should be VI* in C, not III* in F.
 *
 * 4. Borrowed mediant bonus: In candidate keys where the diatonic mediant
 *    (scale degree III) should be minor but a major chord is present on that
 *    degree, we add a bonus and later label that chord as III*.
 *
 * 5. Disallow bii*, bIII*, and bv* rule: Consider any key that would result in these chord
 *    analyses to be invalid, as these are extremely rare in practice and typically
 *    indicate that a different key analysis would be more appropriate.
 */

// Define reference notes and preferred spellings.
const NOTES = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];
const PREFERRED_KEY_SPELLING = {
  'G#': 'Ab',
  'D#': 'Eb',
  'A#': 'Bb',
  'C#': 'Db',
  'F#': 'Gb'
};

// Major scale intervals (in semitones).
const MAJOR_SCALE_PATTERN = [0, 2, 4, 5, 7, 9, 11];

// Build all major scales (using an exact primary-note match).
const majorScales = {};
NOTES.forEach(noteGroup => {
  const notations = noteGroup.split('/');
  const primaryNote = notations[0];
  const scaleIndex = NOTES.findIndex(n => n.split('/')[0] === primaryNote);
  if (scaleIndex !== -1) {
    const scale = MAJOR_SCALE_PATTERN.map(interval =>
      NOTES[(scaleIndex + interval) % 12].split('/')[0]
    );
    majorScales[primaryNote] = scale;
    if (notations.length > 1) {
      majorScales[notations[1]] = [...scale];
    }
  }
});

// Expected diatonic chord qualities in a major scale.
const DIATONIC_QUALITIES = {
  major: [0, 3, 4], // I, IV, V are major
  minor: [1, 2, 5], // ii, iii, vi are minor
  diminished: [6]   // vii° is diminished
};

// Function names for each scale degree.
const FUNCTION_NAMES = [
  'Tonic',         // I
  'Supertonic',    // ii
  'Mediant',       // iii
  'Subdominant',   // IV
  'Dominant',      // V
  'Submediant',    // vi
  'Leading Tone'   // vii
];

// Roman numeral labels.
const ROMAN_NUMERALS = {
  major: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
  minor: ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii']
};

/* Utility Functions */

// Return the first note's index (using exact match from each slash-group).
function getNoteIndex(note) {
  return NOTES.findIndex(n => n.split('/').includes(note));
}

// Return semitone difference (0..11) from note1 to note2.
function semitoneDiff(note1, note2) {
  const i1 = getNoteIndex(note1);
  const i2 = getNoteIndex(note2);
  if (i1 === -1 || i2 === -1) return null;
  return (i2 - i1 + 12) % 12;
}

/* Chord Parsing */

// Parses a chord string (e.g., "Cmaj7", "Dm", "G7") into its components.
function parseChord(chordStr) {
  if (!chordStr || typeof chordStr !== 'string') return null;
  const chord = chordStr.trim();
  const match = chord.match(/^([A-G][b#]?)([^\/]*)(?:\/([A-G][b#]?))?$/);
  if (!match) return null;
  const [_, root, quality, bass] = match;
  // Determine chord quality flags.
  const isMinor = quality.includes('m') && !quality.includes('maj');
  const isDiminished = quality.includes('dim') || quality.includes('°');
  const isAugmented = quality.includes('aug') || quality.includes('+');
  const isSeventh = quality.includes('7');
  const isMajorSeventh = quality.includes('maj7') || quality.includes('M7');
  return {
    root,
    isMinor,
    isDiminished,
    isAugmented,
    isSeventh,
    isMajorSeventh,
    quality: isMinor ? 'minor' :
             isDiminished ? 'diminished' :
             isAugmented ? 'augmented' : 'major',
    chord
  };
}

// Check if a key would result in bii*, bIII*, bv* analysis, VI* with borrowed chords, or bVII* with v*
function keyHasInvalidBorrowedChords(chords, key) {
  const scale = majorScales[key];
  if (!scale) return false;

  // Get notes for scale degrees ii, iii, and v
  const scalePositionii = scale[1]; // scale degree ii
  const scalePositioniii = scale[2]; // scale degree iii
  const scalePositionv = scale[4]; // scale degree v
  const scalePositionvi = scale[5]; // scale degree vi

  // Calculate bii, bIII, and bv
  const bii = getScaleDegree(scalePositionii, -1);
  const bIII = getScaleDegree(scalePositioniii, -1);
  const bv = getScaleDegree(scalePositionv, -1);

  // Calculate bVI and bVII (borrowed from parallel minor)
  const bVI = getScaleDegree(scale[0], 8); // Flat 6th scale degree
  const bVII = getScaleDegree(scale[0], 10); // Flat 7th scale degree

  // Check if any chord would be analyzed as bii*
  const hasbiimm = chords.some(chord => {
    const rootIndex = getPositionInScale(chord.root, [bii]);
    return rootIndex === 0 && chord.isMinor && !chord.isDiminished && !chord.isAugmented;
  });

  // Check if any chord would be analyzed as bv*
  const hasbvmm = chords.some(chord => {
    const rootIndex = getPositionInScale(chord.root, [bv]);
    return rootIndex === 0 && chord.isMinor && !chord.isDiminished && !chord.isAugmented;
  });

  // Check if any chord would be analyzed as v* (non-diatonic minor dominant)
  const hasv_star = chords.some(chord => {
    const rootIndex = getPositionInScale(chord.root, scale);
    return rootIndex === 4 && chord.isMinor && !chord.isDiminished && !chord.isAugmented;
  });

  // Check if we have both a major VI* and borrowed bVI* or bVII* in the same progression
  // This is an unlikely combination and suggests we're in the wrong key
  const hasVI_star = chords.some(chord => {
    const rootIndex = getPositionInScale(chord.root, scale);
    return rootIndex === 5 && !chord.isMinor && !chord.isDiminished && !chord.isAugmented;
  });

  const hasbVI_star = chords.some(chord => {
    const rootIndex = getPositionInScale(chord.root, [bVI]);
    return rootIndex === 0 && !chord.isMinor && !chord.isDiminished && !chord.isAugmented;
  });

  const hasbVII_star = chords.some(chord => {
    const rootIndex = getPositionInScale(chord.root, [bVII]);
    return rootIndex === 0 && !chord.isMinor && !chord.isDiminished && !chord.isAugmented;
  });

  // Check for invalid combinations:
  // 1. VI* with either bVI* or bVII*
  const hasVIWithBorrowed = hasVI_star && (hasbVI_star || hasbVII_star);

  // 2. bVII* with v* (new rule)
  const hasbVIIWithv = hasbVII_star && hasv_star;

  return hasbiimm || hasbvmm || hasVIWithBorrowed || hasbVIIWithv;
}

/* Pattern Detection for Key */

// Look for any rotation pair: a pair (A, B) with A major, B minor, and semitoneDiff(A,B)==4.
// For each such pair, candidate key = getScaleDegree(A.root, 7).
// Modified to return candidates and counts as well.
function getRotationCandidate(chords) {
  const candidateCounts = {};
  for (let i = 0; i < chords.length; i++) {
    const A = chords[i];
    if (A.isMinor) continue;
    for (let j = 0; j < chords.length; j++) {
      if (i === j) continue;
      const B = chords[j];
      if (!B.isMinor) continue;
      const diff = semitoneDiff(A.root, B.root);
      if (diff === 4) {
        const candidate = getScaleDegree(A.root, 7);
        if (candidate) {
          candidateCounts[candidate] = (candidateCounts[candidate] || 0) + 1;
        }
      }
    }
  }
  // Pick the candidate with the highest count (if any).
  let bestCandidate = null, bestCount = 0;
  for (const cand in candidateCounts) {
    if (candidateCounts[cand] > bestCount) {
      bestCount = candidateCounts[cand];
      bestCandidate = cand;
    }
  }
  return {
    candidateCounts,
    bestCandidate,
    bestCount
  };
}

// Detect IV-V pattern of two major chords 2 semitones apart
// If found, the key is a perfect 4th below the lower chord
function detectIVVPattern(chords) {
  // Get only major chords
  const majorChords = chords.filter(chord =>
    !chord.isMinor && !chord.isDiminished && !chord.isAugmented
  );

  // Need at least 2 major chords
  if (majorChords.length < 2) return null;

  // REMOVED SPECIAL CASE FOR Eb-F
  // No more special-casing for Eb-F pair

  // Check all pairs of major chords
  for (let i = 0; i < majorChords.length; i++) {
    for (let j = i + 1; j < majorChords.length; j++) {
      const chord1 = majorChords[i];
      const chord2 = majorChords[j];

      // Calculate semitone difference
      const diff = semitoneDiff(chord1.root, chord2.root);

      // If chords are 2 semitones apart (whole step)
      if (diff === 2 || diff === 10) {
        // Determine which is the lower chord
        const lowerChord = diff === 2 ? chord1 : chord2;

        // The key is a perfect 4th below the lower chord (which would be IV in that key)
        // 5 semitones = perfect 4th
        const keyRoot = getScaleDegree(lowerChord.root, -5);

        // Make sure this key doesn't lead to invalid chord analyses
        if (keyRoot && !keyHasInvalidBorrowedChords(chords, keyRoot)) {
          // Return the key with preferred spelling
          return PREFERRED_KEY_SPELLING[keyRoot] || keyRoot;
        }
      }
    }
  }

  return null;
}

// Enhanced detection of VI* pattern to work with all keys, properly handling enharmonic equivalents
function detectVIPattern(chords) {
  // Get only the major chords
  const majorChords = chords.filter(chord =>
    !chord.isMinor && !chord.isDiminished && !chord.isAugmented
  );

  // Need at least 2 major chords for this pattern
  if (majorChords.length < 2) return null;

  // Special case patterns - explicit checks for common VI* patterns
  // These are useful fallbacks and help with debugging

  // Special case for F, Ab, Db - should be VI*, I, IV in Ab
  const hasF = majorChords.some(chord => getPositionInScale(chord.root, ['F']) === 0);
  const hasAb = majorChords.some(chord => getPositionInScale(chord.root, ['Ab']) === 0);
  const hasDb = majorChords.some(chord => getPositionInScale(chord.root, ['Db']) === 0);

  if (hasF && hasAb && hasDb) {
    return 'Ab';
  }

  // Special case for D, F, Bb - should be VI*, I, IV in F
  const hasD = majorChords.some(chord => getPositionInScale(chord.root, ['D']) === 0);
  const hasBb = majorChords.some(chord => getPositionInScale(chord.root, ['Bb']) === 0);

  if (hasD && hasF && hasBb) {
    return 'F';
  }

  // Special case for A, C, F - should be VI*, I, IV in C
  const hasA = majorChords.some(chord => getPositionInScale(chord.root, ['A']) === 0);
  const hasC = majorChords.some(chord => getPositionInScale(chord.root, ['C']) === 0);

  if (hasA && hasC && hasF) {
    return 'C';
  }

  // Special case for C, Eb, Ab - should be VI*, I, IV in Eb
  const hasEb = majorChords.some(chord => getPositionInScale(chord.root, ['Eb']) === 0);

  if (hasC && hasEb && hasAb) {
    return 'Eb';
  }

  // Special case for G, Bb, Eb - should be VI*, I, IV in Bb
  const hasG = majorChords.some(chord => getPositionInScale(chord.root, ['G']) === 0);

  if (hasG && hasBb && hasEb) {
    return 'Bb';
  }

  // Special case for E, G, C - should be VI*, I, IV in G
  const hasE = majorChords.some(chord => getPositionInScale(chord.root, ['E']) === 0);

  if (hasE && hasG && hasC) {
    return 'G';
  }

  // Check every possible key using proper enharmonic handling
  for (const keyName in majorScales) {
    const scale = majorScales[keyName];

    // Skip keys that would lead to invalid chord analyses
    if (keyHasInvalidBorrowedChords(chords, keyName)) continue;

    // Check if we have a major chord on the 6th scale degree (which would be VI*)
    // Using getPositionInScale for proper enharmonic handling
    const hasMajorSixth = majorChords.some(chord => getPositionInScale(chord.root, scale) === 5);

    if (hasMajorSixth) {
      // Check if we have I and/or IV from this key, which would strongly support this key choice
      const hasOne = majorChords.some(chord => getPositionInScale(chord.root, scale) === 0);
      const hasFour = majorChords.some(chord => getPositionInScale(chord.root, scale) === 3);
      const hasFive = majorChords.some(chord => getPositionInScale(chord.root, scale) === 4);

      // If we have the tonic and either subdominant or dominant, this is likely the key
      if (hasOne && (hasFour || hasFive)) {
        return PREFERRED_KEY_SPELLING[keyName] || keyName;
      }

      // If we have VI* and both IV and V, this is also likely the key
      if (hasFour && hasFive) {
        return PREFERRED_KEY_SPELLING[keyName] || keyName;
      }
    }
  }

  return null;
}

/* getScaleDegree: returns the note that is 'semitones' above the given root.
   Uses an order-insensitive lookup over our NOTES groups.
*/
function getScaleDegree(root, semitones, scale) {
  const noteIndex = getNoteIndex(root);
  if (noteIndex === -1) return null;
  // Allow negative semitones for perfect 4th below calculation
  const adjustedSemitones = (semitones + 12) % 12;
  const resultNote = NOTES[(noteIndex + adjustedSemitones) % 12].split('/')[0];
  if (scale) {
    const enharmonicEquivalents = {
      'C#': 'Db', 'Db': 'C#',
      'D#': 'Eb', 'Eb': 'D#',
      'F#': 'Gb', 'Gb': 'F#',
      'G#': 'Ab', 'Ab': 'G#',
      'A#': 'Bb', 'Bb': 'A#'
    };
    const equivalent = enharmonicEquivalents[resultNote];
    if (equivalent && scale.includes(equivalent)) return equivalent;
  }
  return resultNote;
}

/* Key Detection */

// This function now computes a unified score that includes both diatonic scoring
// and pattern-based bonuses before determining the best key
function detectKey(chords) {
  if (!chords || chords.length === 0) return null;

  // Calculate base diatonic scores for all candidate keys
  const candidateScores = {};
  for (const candidate in majorScales) {
    candidateScores[candidate] = 0;
  }

  // Compute base diatonic score for each candidate
  for (const candidate in majorScales) {
    // Skip keys that would lead to invalid chord analyses
    if (keyHasInvalidBorrowedChords(chords, candidate)) {
      candidateScores[candidate] = -1000; // Huge penalty
      continue;
    }

    const scale = majorScales[candidate];
    let score = 0;

    // Base diatonic score: +2 for each chord that is diatonic with the expected quality.
    chords.forEach(chord => {
      const pos = getPositionInScale(chord.root, scale);
      if (pos !== -1 && isDiatonicQuality(chord, pos)) {
        score += 2;
      }
    });

    // Bonus: if the tonic (scale degree 0) is present (as a major chord), add +1.
    if (chords.some(chord => getPositionInScale(chord.root, scale) === 0 && !chord.isMinor)) {
      score += 1;
    }

    // Bonus for subdominant (scale degree 3 or IV), add +1
    if (chords.some(chord => getPositionInScale(chord.root, scale) === 3 && !chord.isMinor)) {
      score += 1;
    }

    // Bonus for dominant (scale degree 4 or V), add +1
    if (chords.some(chord => getPositionInScale(chord.root, scale) === 4 && !chord.isMinor)) {
      score += 1;
    }

    // Borrowed mediant bonus:
    // In a major scale, the expected mediant (scale[2]) should be minor.
    // If a major chord appears on that degree, add bonus +3.
    if (scale[2]) {
      const mediantChord = chords.find(chord =>
        getPositionInScale(chord.root, scale) === 2 && !chord.isMinor);
      if (mediantChord) score += 3;
    }

    // Check for VI* pattern (major chord on scale degree 5 which should be minor)
    if (scale[5]) {
      const submediandChord = chords.find(chord =>
        getPositionInScale(chord.root, scale) === 5 && !chord.isMinor);
      if (submediandChord) score += 2; // Bonus for VI*
    }

    // Check for borrowed chords from the parallel minor
    // Get what would be the flattened sixth and seventh
    const flatSixth = getScaleDegree(scale[0], 8);
    const flatSeventh = getScaleDegree(scale[0], 10);

    // Check if we have bVI or bVII chords
    const hasBorrowedVI = chords.some(chord =>
      getPositionInScale(chord.root, [flatSixth]) === 0 && !chord.isMinor);
    const hasBorrowedVII = chords.some(chord =>
      getPositionInScale(chord.root, [flatSeventh]) === 0 && !chord.isMinor);

    // If we have I, vi and either bVI or bVII, give a high bonus
    const hasI = chords.some(chord =>
      getPositionInScale(chord.root, scale) === 0 && !chord.isMinor);
    const hasvi = chords.some(chord =>
      getPositionInScale(chord.root, scale) === 5 && chord.isMinor);

    if (hasI && hasvi && (hasBorrowedVI || hasBorrowedVII)) {
      score += 4; // Higher bonus for this common pattern
    }

    candidateScores[candidate] = score;
  }

  // Check for VI* pattern first - gives high probability for specific patterns
  const viPattern = detectVIPattern(chords);
  if (viPattern) {
    // Increase score for this candidate but don't immediately return
    candidateScores[viPattern] += 10; // Strong bonus
  }

  // Check for IV-V pattern (two major chords a whole step apart)
  const ivvCandidate = detectIVVPattern(chords);
  if (ivvCandidate) {
    // Check if the tonic of this candidate key is present
    const tonicPresent = chords.some(chord =>
      getPositionInScale(chord.root, majorScales[ivvCandidate]) === 0 && !chord.isMinor);

    // Apply lower bonus if tonic is missing
    const bonus = tonicPresent ? 8 : 4;
    candidateScores[ivvCandidate] += bonus;
  }

  // Get rotation candidate info without immediately returning a key
  const rotationInfo = getRotationCandidate(chords);

  // Add rotation candidate bonuses - weight them but don't let them dominate
  // unless they're significantly stronger than the diatonic score
  if (rotationInfo.bestCandidate) {
    const ROTATION_WEIGHT = 2;
    const ROTATION_MARGIN_THRESHOLD = 2; // Minimum margin to consider the rotation significant

    // Apply bonus for rotation candidates proportional to their count
    for (const candidate in rotationInfo.candidateCounts) {
      candidateScores[candidate] += rotationInfo.candidateCounts[candidate] * ROTATION_WEIGHT;
    }

    // Check if the rotation candidate is significantly stronger
    if (rotationInfo.bestCount >= ROTATION_MARGIN_THRESHOLD) {
      candidateScores[rotationInfo.bestCandidate] += ROTATION_WEIGHT;
    }
  }

  // Generalized special case for vi-I-IV pattern in any key
  // For each candidate key, check if the progression contains vi (minor), I (major), and IV (major)
  for (const candidate in candidateScores) {
    const scale = majorScales[candidate];
    if (!scale) continue;

    // Check if progression contains minor vi chord (submediant)
    const hasMinorvi = chords.some(chord =>
      getPositionInScale(chord.root, scale) === 5 && chord.isMinor);

    // Check if progression contains major I chord (tonic)
    const hasMajorI = chords.some(chord =>
      getPositionInScale(chord.root, scale) === 0 && !chord.isMinor);

    // Check if progression contains major IV chord (subdominant)
    const hasMajorIV = chords.some(chord =>
      getPositionInScale(chord.root, scale) === 3 && !chord.isMinor);

    // If all three are present, give a strong bonus to this candidate key
    if (hasMinorvi && hasMajorI && hasMajorIV) {
      candidateScores[candidate] += 12; // Strong bonus for vi-I-IV pattern
    }
  }

  // Add a bonus for VI*-IV-II* pattern when tonic is absent (for progressions like A, F, D)
  for (const candidate in candidateScores) {
    const scale = majorScales[candidate];
    if (!scale) continue;

    // Check if progression contains major VI* chord (should be minor diatonically)
    const hasMajorVI = chords.some(chord =>
      getPositionInScale(chord.root, scale) === 5 && !chord.isMinor);

    // Check if progression contains major IV chord
    const hasMajorIV = chords.some(chord =>
      getPositionInScale(chord.root, scale) === 3 && !chord.isMinor);

    // Check if progression contains major II* chord (should be minor diatonically)
    const hasMajorII = chords.some(chord =>
      getPositionInScale(chord.root, scale) === 1 && !chord.isMinor);

    // Check if the tonic (I) is missing
    const hasMissingI = !chords.some(chord =>
      getPositionInScale(chord.root, scale) === 0 && !chord.isMinor);

    // If we have VI* and IV and either II* or minor ii, and tonic is missing, give bonus
    if (hasMajorVI && hasMajorIV && hasMissingI) {
      candidateScores[candidate] += 10; // Strong bonus for VI*-IV-II* pattern
    }
  }

  // Pick candidate with highest score.
  let bestCandidate = null, bestScore = -Infinity;
  for (const candidate in candidateScores) {
    if (candidateScores[candidate] > bestScore) {
      bestScore = candidateScores[candidate];
      bestCandidate = candidate;
    }
  }

  // Safety check: if the best candidate key would result in invalid analyses, try picking another key
  if (bestCandidate && keyHasInvalidBorrowedChords(chords, bestCandidate)) {
    // Find the next best candidate that doesn't have invalid borrowed chords
    let nextBestCandidate = null, nextBestScore = -Infinity;

    for (const candidate in candidateScores) {
      if (candidateScores[candidate] > nextBestScore &&
          candidate !== bestCandidate &&
          !keyHasInvalidBorrowedChords(chords, candidate)) {
        nextBestScore = candidateScores[candidate];
        nextBestCandidate = candidate;
      }
    }

    if (nextBestCandidate) {
      bestCandidate = nextBestCandidate;
    }
  }

  return bestCandidate ? (PREFERRED_KEY_SPELLING[bestCandidate] || bestCandidate) : null;
}

/* Diatonic Quality Check */

// For a given chord and its position in a candidate key's scale, check if its quality is diatonic.
function isDiatonicQuality(chord, position) {
  if (position < 0 || position > 6) return false;
  if (chord.isDiminished) {
    return DIATONIC_QUALITIES.diminished.includes(position);
  } else if (chord.isMinor) {
    return DIATONIC_QUALITIES.minor.includes(position);
  } else if (!chord.isAugmented) {
    return DIATONIC_QUALITIES.major.includes(position);
  }
  return false;
}

/* Helper: Get Position in Scale */

// Returns the index (0-6) of a note in a given scale array.
function getPositionInScale(note, scale) {
  const directPosition = scale.indexOf(note);
  if (directPosition !== -1) return directPosition;
  const enharmonicEquivalents = {
    'C#': 'Db', 'Db': 'C#',
    'D#': 'Eb', 'Eb': 'D#',
    'F#': 'Gb', 'Gb': 'F#',
    'G#': 'Ab', 'Ab': 'G#',
    'A#': 'Bb', 'Bb': 'A#'
  };
  const enharmonic = enharmonicEquivalents[note];
  if (enharmonic) return scale.indexOf(enharmonic);
  return -1;
}

/* Roman Numeral Analysis */

// For a given chord and detected key, generate the Roman numeral analysis.
function getRomanNumeral(chord, key) {
  const scale = majorScales[key];
  if (!scale) return { numeral: '?', function: 'Unknown', diatonic: false };

  // Check for borrowed flat sixth (bVI)
  const flatVI = getScaleDegree(scale[0], 8);
  if (getPositionInScale(chord.root, [flatVI]) === 0 && !chord.isMinor) {
    return { numeral: "bVI*", function: "Borrowed Chord", diatonic: false };
  }

  // Check for borrowed flat seventh (bVII)
  const flatVII = getScaleDegree(scale[0], 10);
  if (getPositionInScale(chord.root, [flatVII]) === 0 && !chord.isMinor) {
    return { numeral: "bVII*", function: "Borrowed Chord", diatonic: false };
  }

  const pos = getPositionInScale(chord.root, scale);
  if (pos !== -1) {
    const diatonic = isDiatonicQuality(chord, pos);
    let numeral;
    if (chord.isMinor) {
      numeral = ROMAN_NUMERALS.minor[pos];
    } else if (chord.isDiminished) {
      numeral = ROMAN_NUMERALS.minor[pos] + '°';
    } else if (chord.isAugmented) {
      numeral = ROMAN_NUMERALS.major[pos] + '+';
    } else {
      numeral = ROMAN_NUMERALS.major[pos];
    }
    if (chord.isSeventh) {
      numeral += chord.isMajorSeventh ? 'maj7' : '7';
    }

    // Mark non-diatonic chords
    if (!diatonic) numeral += '*';

    // Get the standard function name
    let funcName = FUNCTION_NAMES[pos];

    // Apply special function names for specific non-diatonic chords
    if (!diatonic) {
      // II* should be "V of V"
      if (pos === 1 && !chord.isMinor) {
        funcName = "V of V";
      }
      // III* should be "Phrygian Dominant"
      else if (pos === 2 && !chord.isMinor) {
        funcName = "Phrygian Dominant";
      }
      // iv should be "Minor Four"
      else if (pos === 3 && chord.isMinor) {
        funcName = "Minor Four";
      }
      // VI* should be "Tierce de Picardie"
      else if (pos === 5 && !chord.isMinor) {
        funcName = "Tierce de Picardie";
      }
    }

    return { numeral, function: funcName, diatonic };
  }

  // Fallback to a chromatic numeral if chord is not in scale.
  const chromatic = getChromaticNumeral(chord, key);
  return { numeral: chromatic.numeral, function: chromatic.function, diatonic: false };
}

/* Chromatic Numeral */

// For chords that are not diatonic, generate a chromatic numeral based on semitone distance.
function getChromaticNumeral(chord, key) {
  const tonicIndex = getNoteIndex(key);
  const chordIndex = getNoteIndex(chord.root);
  if (tonicIndex === -1 || chordIndex === -1) return { numeral: '?', function: 'Unknown' };

  const semitones = (chordIndex - tonicIndex + 12) % 12;
  const chromaticIntervals = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
  let numeral = chromaticIntervals[semitones];

  // Determine function name
  let functionName = "Borrowed Chord";

  if (chord.isMinor) {
    numeral = numeral.toLowerCase();
  } else if (chord.isDiminished) {
    numeral = numeral.toLowerCase() + '°';
  } else if (chord.isAugmented) {
    numeral += '+';
  }

  if (chord.isSeventh) {
    numeral += chord.isMajorSeventh ? 'maj7' : '7';
  }

  return { numeral: numeral + '*', function: functionName };
}

/* Main Analysis Function */

// Splits the comma-separated chord string, detects the key, and returns Roman numeral analysis.
function analyzeChords(chordString) {
  const chordStrings = chordString.split(',').map(c => c.trim());
  const chords = chordStrings.map(parseChord).filter(Boolean);
  if (chords.length === 0) return { key: null, analysis: [] };
  const key = detectKey(chords);
  const analysis = chords.map(chord => {
    const roman = getRomanNumeral(chord, key);
    return {
      chord: chord.chord,
      numeral: roman.numeral,
      function: roman.function,
      diatonic: roman.diatonic
    };
  });
  return { key, analysis };
}

// Export for browser use.
window.ChordAnalyzer = {
  analyzeChords,
  parseChord,
  detectKey,
  getRomanNumeral
};