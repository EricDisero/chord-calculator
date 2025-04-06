# Chord Analyzer

A music theory chord progression analyzer that identifies the key and provides Roman numeral analysis with consistent results across all 12 keys.

## Features

- **Accurate Key Detection**: Identifies the key of a chord progression using a sophisticated scoring algorithm
- **Roman Numeral Analysis**: Provides detailed Roman numeral analysis for each chord
- **Function Identification**: Shows chord functions (tonic, dominant, etc.)
- **Special Pattern Recognition**: Handles common chord progressions with specific key relationships
- **Non-Diatonic Chord Handling**: Identifies borrowed chords, secondary dominants, and chromatic alterations
- **Works in All 12 Keys**: Consistent analysis in any key

## Usage

1. Clone this repository
2. Open `index.html` in your web browser
3. Enter chord progressions in the input field (e.g., `C, G, Am, F`)
4. Click "Analyze Chords" to see the results

Alternatively, click on any of the example buttons to analyze common progressions.

## Project Structure

- `index.html` - Main HTML page
- `css/styles.css` - Styling for the application
- `js/chord-analyzer.js` - Core music theory analysis engine
- `js/ui-controller.js` - Handles UI interactions
- `js/chord-examples.js` - Example chord progressions

## How It Works

The analyzer uses a weighted scoring system to determine the most likely key based on:

- Diatonic chord patterns
- Cadential relationships
- Position of tonic/dominant/subdominant chords
- Presence of seventh chords in functional positions
- Special case recognition for common progressions

After determining the key, it analyzes each chord to generate Roman numerals and identify chord functions.

## Algorithm Details

The key detection algorithm:

1. Checks for known patterns (special cases)
2. Scores each possible key based on multiple musical factors
3. Identifies cadential patterns (V-I, IV-I, etc.)
4. Gives extra weight to tonic chords at the beginning or end
5. Analyzes seventh chords in context

The Roman numeral generation:

1. Determines if the chord is diatonic or non-diatonic
2. Identifies borrowed chords from parallel minor
3. Detects secondary dominants (V/V, V/vi, etc.)
4. Generates appropriate Roman numeral notation including:
   - Upper/lowercase for major/minor
   - Diminished/augmented symbols
   - Seventh notation
   - Non-diatonic indicators

## Customization

You can adjust the weighting factors in the `WEIGHTS` object in `chord-analyzer.js` to fine-tune key detection for specific use cases. You can also add more special patterns to the `SPECIAL_PATTERNS` array.

## License

MIT

---

Created by Your Name © 2025