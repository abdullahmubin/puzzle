# Visual CAPTCHA Challenge

**React.js Code Challenge (this repo contain just task 1 and task 2)**

A modern, interactive CAPTCHA system that uses your camera and visual puzzles to verify you're human. Instead of typing distorted text, you'll take a photo and solve a simple shape-matching puzzle.

## Developer Information

**Name:** Abdullah al Mubin  
**Email:** amubin19@gmail.com  
**WhatsApp:** +8801686578649  
**Location:** Dhaka, Bangladesh  
**GitHub:** [https://github.com/abdullahmubin](https://github.com/abdullahmubin)  
**LinkedIn:** [https://www.linkedin.com/in/abdullah-al-mubin/](https://www.linkedin.com/in/abdullah-al-mubin/)

## Task Completion

- **Task 1 & Task 2:** Completed (Branch: [`task1-task2-completed`](https://github.com/abdullahmubin/puzzle/tree/task1-task2-completed))
- **Task 1, Task 2 & Task 3:** Completed (Branches: [`task1-task2-task3-completed`](https://github.com/abdullahmubin/puzzle/tree/task1-task2-task3-completed) | [`master`](https://github.com/abdullahmubin/puzzle/tree/master))

## What is this?

This is a custom CAPTCHA implementation built with React. It's designed to be more engaging than traditional text-based CAPTCHAs while still being effective at blocking automated bots. The system uses your device's camera to capture an image, then presents you with a grid-based puzzle where you need to find and select specific shapes with matching colors.

## Features

### Camera-Based Challenge
- Uses your device's front-facing camera to capture a live image
- Animated overlay that moves around to make the capture more dynamic
- No image storage - everything happens locally in your browser

### Visual Puzzle Grid
- 4x4 grid overlay on your captured image
- Random watermarks (shapes with colors) placed on half the cells
- Three shape types: triangles, squares, and circles
- Three color tints: red, green, and blue
- Your task: find all cells containing both the target shape AND target color

### Time-Based Bot Detection
The system analyzes your interaction patterns to detect automated solving attempts:
- **Minimum time check**: Humans need at least 2 seconds to understand and solve
- **Click pattern analysis**: Detects unnaturally consistent or too-fast clicking
- **Reaction time validation**: Ensures there's a thinking pause before validation

If the system detects bot-like behavior, validation fails immediately.

### Progressive Tolerance System
We understand that humans make mistakes, so the system gets more forgiving on your first attempts:

- **Attempt 1**: You can make up to 2 mistakes (80% accuracy required)
- **Attempt 2**: You can make up to 1 mistake (90% accuracy required)
- **Attempt 3**: Perfect match required (100% accuracy)

After 3 failed attempts, you'll be blocked and need to start a completely new challenge.

### User-Friendly Design
- Clean, modern interface with Tailwind CSS
- Dark mode support
- Responsive design that works on mobile and desktop
- Clear instructions and visual feedback
- Attempt counter shows your progress

## Getting Started

### Prerequisites
- Node.js (v16 or higher recommended)
- npm or yarn
- A device with a camera (for the full experience)

### Installation

1. Clone or download this repository
2. Navigate to the project directory:
   ```bash
   cd my-react-app
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

### Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory. You can preview the production build with:

```bash
npm run preview
```

## How to Use

1. **Start the Challenge**: When the app loads, you'll see the camera screen. Click "Start Camera" to allow camera access.

2. **Capture Your Photo**: Position yourself in the frame. You'll see a bouncing square overlay - this is just for visual interest. Click "Capture and Continue" when ready.

3. **Solve the Puzzle**: You'll see your captured image with a grid overlay. The instructions will tell you which shape and color to find (e.g., "Select all green triangle shapes"). Click on the cells that match both the shape AND color.

4. **Validate**: Once you've selected the matching cells, click "Validate Selection". The system will check your answers and analyze your interaction timing.

5. **See Results**: 
   - If you pass, you'll see a success message with a "Play Again" button
   - If you fail, you'll see your attempt number and can click "Try Again" to retry with stricter tolerance
   - After 3 failed attempts, you'll be blocked and need to click "Start New Challenge"

## Project Structure

```
my-react-app/
├── src/
│   ├── components/
│   │   ├── CameraCapture.jsx    # Handles camera access and image capture
│   │   └── PuzzleGrid.jsx        # Displays puzzle and handles user selections
│   ├── utils/
│   │   └── createWatermarks.js   # Generates random watermarks and target
│   ├── __tests__/                # Test files
│   ├── App.jsx                    # Main application component
│   └── main.jsx                  # Entry point
├── package.json
└── README.md
```

## Testing

The project includes comprehensive test coverage using Vitest and React Testing Library.

Run tests:
```bash
npm test
```

Run tests with UI:
```bash
npm run test:ui
```

Run tests with coverage:
```bash
npm run test:coverage
```

Tests cover:
- Component rendering and interactions
- Validation logic
- Time-based detection
- Progressive tolerance system
- Error handling

## Technical Details

### Tech Stack
- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Vitest** - Testing framework
- **React Testing Library** - Component testing utilities

### Key Implementation Details

**Watermark Generation**: Uses Fisher-Yates shuffle algorithm to randomly select 50% of grid cells for watermarks. Each watermark gets a random shape and color, and the target is selected from the actual watermarks to ensure there's always at least one correct answer.

**Time-Based Detection**: Analyzes multiple timing patterns:
- Total completion time
- Click interval consistency (coefficient of variation)
- Sub-100ms click detection
- Perfect interval matching
- Time between first click and validation

**Progressive Tolerance**: The system tracks attempt count and applies different validation rules:
- Calculates total mistakes (wrong selections + missed correct selections)
- Applies tolerance based on attempt number
- Resets attempt count on success
- Blocks after maximum attempts

**State Management**: Uses React hooks (useState, useRef) for component state. The camera component uses a key prop to force remounting on reset.

## Browser Compatibility

Works best in modern browsers that support:
- `getUserMedia` API (for camera access)
- Canvas API
- ES6+ JavaScript features

Tested on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Notes

- All processing happens client-side - no images are sent to any server
- Camera permissions are required for the full experience
- The system is designed for demonstration purposes - for production use, you'd want to add server-side validation
- The time-based detection helps prevent automated solving but isn't foolproof on its own

## Future Improvements

Some ideas for enhancements:
- Server-side validation for production use
- More shape/color variations
- Adjustable grid sizes
- Accessibility improvements (keyboard navigation, screen reader support)
- Analytics and performance monitoring
- Rate limiting per IP address

## License

This project is provided as-is for educational and demonstration purposes.

## Contributing

Feel free to fork this project and make it your own! If you find bugs or have suggestions, open an issue or submit a pull request.

---

**Developer:** Abdullah al Mubin  
**Email:** amubin19@gmail.com  
**Location:** Dhaka, Bangladesh

Built with ❤️ using React and modern web technologies.
