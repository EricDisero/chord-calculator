/**
 * UI Controller for the Chord Analyzer
 * Handles user interactions and display updates
 */

document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const form = document.getElementById('chord-form');
  const resultsDiv = document.getElementById('results');
  const detectedKeySpan = document.getElementById('detected-key');
  const analysisBody = document.getElementById('analysis-body');
  const exampleButtonsContainer = document.getElementById('example-buttons');

  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    const chordInput = document.getElementById('chord-input').value.trim();
    if (!chordInput) return;

    // Analyze the chords using the core library
    const result = window.ChordAnalyzer.analyzeChords(chordInput);

    // Display results
    displayResults(result);
  });

  // Function to display analysis results
  function displayResults(result) {
    // Display key
    detectedKeySpan.textContent = result.key || 'Unknown';

    // Clear previous results
    analysisBody.innerHTML = '';

    // Add rows to the table
    result.analysis.forEach(item => {
      const row = document.createElement('tr');

      // Highlight non-diatonic chords
      if (!item.diatonic) {
        row.classList.add('non-diatonic');
      }

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

    // Show results
    resultsDiv.classList.remove('hidden');
  }

  // Set up example buttons from the examples file
  function setupExampleButtons() {
    if (!window.ChordExamples) return;

    window.ChordExamples.forEach(example => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'example-btn';
      button.textContent = example.name;
      button.dataset.chords = example.chords;

      button.addEventListener('click', function() {
        document.getElementById('chord-input').value = this.dataset.chords;
        document.getElementById('analyze-btn').click();
      });

      exampleButtonsContainer.appendChild(button);
    });
  }

  // Initialize the UI
  setupExampleButtons();
});