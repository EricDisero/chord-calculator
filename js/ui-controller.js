/**
 * UI Controller for the Chord Analyzer
 * Handles user interactions and display updates
 */

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('chord-form');
  const resultsDiv = document.getElementById('results');
  const detectedKeySpan = document.getElementById('detected-key');
  const analysisBody = document.getElementById('analysis-body');
  const exampleButtonsContainer = document.getElementById('example-buttons');
  const downloadMidiBtn = document.getElementById('download-midi');
  let currentAnalysis = null;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const chordInput = document.getElementById('chord-input').value.trim();
    if (!chordInput) return;
    const result = window.ChordAnalyzer.analyzeChords(chordInput);
    currentAnalysis = result;
    displayResults(result);
  });

  downloadMidiBtn.addEventListener('click', function () {
    if (currentAnalysis) {
      createMidiFromAnalysis(currentAnalysis);
    } else {
      alert("Please analyze chords first before downloading MIDI");
    }
  });

  function displayResults(result) {
    detectedKeySpan.textContent = result.key || 'Unknown';
    analysisBody.innerHTML = '';
    result.analysis.forEach((item) => {
      const row = document.createElement('tr');
      if (!item.diatonic) row.classList.add('non-diatonic');

      const chordCell = document.createElement('td');
      chordCell.textContent = item.chord;

      const numeralCell = document.createElement('td');
      numeralCell.textContent = item.numeral;

      const functionCell = document.createElement('td');
      functionCell.textContent = item.function;

      row.appendChild(chordCell);
      row.appendChild(numeralCell);
      row.appendChild(functionCell);

      analysisBody.appendChild(row);
    });
    resultsDiv.classList.remove('hidden');
  }

  function getNoteName(root, offset) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatToSharp = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
    if (root.length > 1 && root[1] === 'b') {
      root = flatToSharp[root] || root;
    }
    let rootIndex = notes.indexOf(root);
    if (rootIndex === -1) return root;
    let newIndex = rootIndex + offset;
    let octave = 4;
    while (newIndex >= 12) {
      newIndex -= 12;
      octave++;
    }
    while (newIndex < 0) {
      newIndex += 12;
      octave--;
    }
    return notes[newIndex] + octave;
  }

    function getChordNotes(chord) {
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const flatToSharp = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

      let root = chord.root;
      if (root.length > 1 && root[1] === 'b') {
        root = flatToSharp[root] || root;
      }

      const rootIndex = notes.indexOf(root);
      if (rootIndex === -1) return [];

      // Root at octave 2
      const rootNote = notes[rootIndex] + '2';

      // Fifth — +7 semitones, normally stays in octave 2 unless it overlaps root
      let fifthIndex = (rootIndex + 7) % 12;
      let fifthOctave = 2;
      if (fifthIndex <= rootIndex) fifthOctave++; // push it up if it's below or same as root
      const fifthNote = notes[fifthIndex] + fifthOctave;

      // Tenth (major/minor 10th is root + 16 or 15 semitones)
      let tenthIndex = (rootIndex + (chord.quality === 'minor' ? 3 : 4)) % 12;
      let tenthOctave = 3;
      if (tenthIndex <= rootIndex) tenthOctave++; // same logic: keep above root
      const tenthNote = notes[tenthIndex] + tenthOctave;

      return [rootNote, fifthNote, tenthNote];
    }

  function createMidiFromAnalysis(analysis) {
    try {
      if (!window.Midi) {
        alert("jsmidgen library not found.");
        return;
      }

      const chordObjects = analysis.analysis.map((item) =>
        parseChordForMidi(item.chord)
      );
      const key = analysis.key || 'C';

      var file = new Midi.File();
      var track = new Midi.Track();
      file.addTrack(track);
      track.setTempo(120);

      chordObjects.forEach((chord) => {
        if (!chord) return;
        var chordNotes = getChordNotes(chord);
        track.addChord(0, chordNotes, 512); // or 64, 256 etc. for different durations
      });

      var midiBytes = file.toBytes();
      var dataUri = "data:audio/midi;base64," + btoa(midiBytes);
      var a = document.createElement('a');
      a.href = dataUri;
      a.download = "progression-in-" + key.replace('#', 'sharp').replace('b', 'flat') + ".mid";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

    } catch (error) {
      console.error("Error creating MIDI file:", error);
      alert("MIDI export failed. Check console.");
    }
  }

  function parseChordForMidi(chordStr) {
    if (!chordStr || typeof chordStr !== "string") return null;
    const chord = chordStr.trim();
    const match = chord.match(/^([A-G][b#]?)([^\/]*)(?:\/([A-G][b#]?))?$/);
    if (!match) return null;
    const [_, root, quality, bassNote] = match;

    let chordQuality = "major";
    if (quality.includes("m") && !quality.includes("maj")) {
      chordQuality = "minor";
    } else if (quality.includes("dim") || quality.includes("°")) {
      chordQuality = "diminished";
    } else if (quality.includes("aug") || quality.includes("+")) {
      chordQuality = "augmented";
    }

    let hasSeventh = false;
    let isMajorSeventh = false;
    if (quality.includes("maj7") || quality.includes("M7")) {
      hasSeventh = true;
      isMajorSeventh = true;
    } else if (quality.includes("7")) {
      hasSeventh = true;
    }

    return {
      root,
      quality: chordQuality,
      isSeventh: hasSeventh,
      isMajorSeventh,
      bassNote: bassNote || root,
    };
  }

  function setupExampleButtons() {
    if (!window.ChordExamples) return;

    window.ChordExamples.forEach((example) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "example-btn";
      button.textContent = example.name;
      button.dataset.chords = example.chords;

      button.addEventListener("click", function () {
        document.getElementById("chord-input").value = this.dataset.chords;
        document.getElementById("analyze-btn").click();
      });

      exampleButtonsContainer.appendChild(button);
    });
  }

  setupExampleButtons();
});
