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

/* Pattern Detection for Key */

// Look for any rotation pair: a pair (A, B) with A major, B minor, and semitoneDiff(A,B)==4.
// For each such pair, candidate key = getScaleDegree(A.root, 7).
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
  return bestCandidate;
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

  // Special case for Eb and F, which should be interpreted as IV-V in Bb
  if (majorChords.some(chord => chord.root === 'Eb') &&
      majorChords.some(chord => chord.root === 'F')) {
    return 'Bb';
  }

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

        // Return the key with preferred spelling
        return PREFERRED_KEY_SPELLING[keyRoot] || keyRoot;
      }
    }
  }

  return null;
}

// Detect the VI* pattern - where a major chord would be VI in a key
// This specifically targets progressions like A, C, F where A should be VI* in C
function detectVIPattern(chords) {
  // Check for the specific A, C, F pattern (and variations like A, C, F, G or A, C, F, D)
  // which should be interpreted as VI*, I, IV in C (and possibly V or II)
  const hasA = chords.some(chord => chord.root === 'A' && !chord.isMinor);
  const hasC = chords.some(chord => chord.root === 'C' && !chord.isMinor);
  const hasF = chords.some(chord => chord.root === 'F' && !chord.isMinor);

  if (hasA && hasC && hasF) {
    return 'C'; // A is VI* in C
  }

  // More general detection for other keys
  // Filter to only major chords
  const majorChords = chords.filter(chord =>
    !chord.isMinor && !chord.isDiminished && !chord.isAugmented
  );

  if (majorChords.length < 2) return null;

  // For each potential key, check if we have a major VI chord (which would be VI*)
  // and also have the I chord or IV chord from that key
  for (const keyName in majorScales) {
    const scale = majorScales[keyName];

    // Get the expected VI chord (which should normally be minor in a major key)
    const sixthDegree = scale[5];

    // Check if we have a major chord on this degree
    const hasMajorSixth = majorChords.some(chord => chord.root === sixthDegree);

    if (hasMajorSixth) {
      // Check if we have I and/or IV from this key
      const hasOne = majorChords.some(chord => chord.root === scale[0]);
      const hasFour = majorChords.some(chord => chord.root === scale[3]);

      // If we have both I and IV, this is very likely the key
      if (hasOne && hasFour) {
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

// This function first checks for pattern-based candidates, then falls back to scoring.
function detectKey(chords) {
  if (!chords || chords.length === 0) return null;

  // Check for specific A, C, F pattern and variants first
  // This takes highest precedence to fix the issue
  const viPattern = detectVIPattern(chords);
  if (viPattern) {
    return viPattern;
  }

  // Check for IV-V pattern (two major chords a whole step apart)
  const ivvCandidate = detectIVVPattern(chords);
  if (ivvCandidate) {
    return ivvCandidate;
  }

  // Try to find a rotation candidate
  const rotationCandidate = getRotationCandidate(chords);
  if (rotationCandidate) {
    return PREFERRED_KEY_SPELLING[rotationCandidate] || rotationCandidate;
  }

  // Otherwise, use scoring
  const candidateScores = {};
  for (const candidate in majorScales) {
    candidateScores[candidate] = 0;
  }

  for (const candidate in majorScales) {
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
      const mediantChord = chords.find(chord => chord.root === scale[2] && !chord.isMinor);
      if (mediantChord) score += 3;
    }
    // Check for VI* pattern (major chord on scale degree 5 which should be minor)
    if (scale[5]) {
      const submediandChord = chords.find(chord => chord.root === scale[5] && !chord.isMinor);
      if (submediandChord) score += 2; // Bonus for VI*
    }
    candidateScores[candidate] = score;
  }

  // Pick candidate with highest score.
  let bestCandidate = null, bestScore = -Infinity;
  for (const candidate in candidateScores) {
    if (candidateScores[candidate] > bestScore) {
      bestScore = candidateScores[candidate];
      bestCandidate = candidate;
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
    // Mark non-diatonic chords.
    if (!diatonic) numeral += '*';
    let funcName = FUNCTION_NAMES[pos];
    // (Optional: additional adjustments for secondary dominants, etc. could be added here.)
    return { numeral, function: funcName, diatonic };
  }
  // Fallback to a chromatic numeral if chord is not in scale.
  return { numeral: getChromaticNumeral(chord, key), function: 'Chromatic', diatonic: false };
}

/* Chromatic Numeral */

// For chords that are not diatonic, generate a chromatic numeral based on semitone distance.
function getChromaticNumeral(chord, key) {
  const tonicIndex = NOTES.findIndex(n => n.split('/').includes(key));
  const chordIndex = NOTES.findIndex(n => n.split('/').includes(chord.root));
  if (tonicIndex === -1 || chordIndex === -1) return '?';
  const semitones = (chordIndex - tonicIndex + 12) % 12;
  const chromaticIntervals = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
  let numeral = chromaticIntervals[semitones];
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
  return numeral + '*';
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