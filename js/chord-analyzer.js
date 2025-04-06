/**
 * Chord Analyzer – Pattern‐Enhanced Version
 *
 * This version uses two “pattern” rules:
 *
 * 1. Rotation candidate: If there exists any pair of chords
 *    (A major, B minor) whose roots differ by exactly 4 semitones,
 *    then we assume A is functioning as the IV. In that case the key
 *    is set to getScaleDegree(A, 7) (i.e. a perfect 5th up from A).
 *
 * 2. Borrowed mediant bonus: In candidate keys where the diatonic mediant
 *    (scale degree III) should be minor but a major chord is present on that
 *    degree, we add a bonus and later label that chord as III*.
 *
 * In all other cases, the key is determined by an order‐insensitive scoring
 * of diatonic membership.
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

/* getScaleDegree: returns the note that is 'semitones' above the given root.
   Uses an order-insensitive lookup over our NOTES groups.
*/
function getScaleDegree(root, semitones, scale) {
  const noteIndex = getNoteIndex(root);
  if (noteIndex === -1) return null;
  const resultNote = NOTES[(noteIndex + semitones) % 12].split('/')[0];
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

// This function first checks for a rotation candidate from a pattern pair.
// If none is found, it computes a base diatonic score for each candidate key,
// then adds a bonus if the candidate key has a “borrowed mediant” (i.e. if
// the chord on scale degree III is major instead of the diatonic minor).
function detectKey(chords) {
  if (!chords || chords.length === 0) return null;

  // First, try to find a rotation candidate.
  const rotationCandidate = getRotationCandidate(chords);
  if (rotationCandidate) {
    return PREFERRED_KEY_SPELLING[rotationCandidate] || rotationCandidate;
  }

  // Otherwise, use scoring.
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
    // Borrowed mediant bonus:
    // In a major scale, the expected mediant (scale[2]) should be minor.
    // If a major chord appears on that degree, add bonus +3.
    if (scale[2]) {
      const mediantChord = chords.find(chord => chord.root === scale[2] && !chord.isMinor);
      if (mediantChord) score += 3;
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
