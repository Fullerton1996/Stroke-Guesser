import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

type Point = { x: number; y: number };

const MIN_STROKE = 2;
const MAX_STROKE = 50;
const MAX_GUESSES = 3;

// Helper to draw multiple paths on a canvas context
const drawPaths = (
    ctx: CanvasRenderingContext2D,
    paths: Point[][],
    strokeWidth: number
) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (paths.length === 0) return;
    
    ctx.strokeStyle = '#0f62fe';
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const path of paths) {
        if (path.length < 2) continue;
        
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
    }
};

const App: React.FC = () => {
    const [isIntroVisible, setIsIntroVisible] = useState(true);
    const [isIntroMounted, setIsIntroMounted] = useState(true);

    const [targetStrokeWidth, setTargetStrokeWidth] = useState(0);
    const [guessStrokeWidth, setGuessStrokeWidth] = useState(Math.floor((MIN_STROKE + MAX_STROKE) / 2));
    const [feedback, setFeedback] = useState<{ message: string; type: 'hint' | 'success' | '' }>({ message: '', type: '' });
    const [isRoundOver, setIsRoundOver] = useState(false);
    const [guessesLeft, setGuessesLeft] = useState(MAX_GUESSES);
    
    const [paths, setPaths] = useState<Point[][]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawnInRound, setHasDrawnInRound] = useState(false);

    const [winCount, setWinCount] = useState(0);

    const userCanvasRef = useRef<HTMLCanvasElement>(null);

    const startNewRound = useCallback(() => {
        setPaths([]); // Clear canvas for the new round
        setIsRoundOver(false);
        setFeedback({ message: '', type: '' });
        setHasDrawnInRound(false);
        setGuessesLeft(MAX_GUESSES);
        
        // Generate a random integer stroke width
        const newTargetWidth = Math.floor(Math.random() * (MAX_STROKE - MIN_STROKE + 1)) + MIN_STROKE;
        setTargetStrokeWidth(newTargetWidth);
        setGuessStrokeWidth(Math.floor((MIN_STROKE + MAX_STROKE) / 2));

    }, []);
    
    // Effect for intro animation
    useEffect(() => {
        const animationTimer = setTimeout(() => {
            setIsIntroVisible(false); // Triggers fade-out
        }, 2800);

        const unmountTimer = setTimeout(() => {
            setIsIntroMounted(false); // Removes from DOM after fade-out
        }, 3300); // 2800ms animation + 500ms fade

        return () => {
            clearTimeout(animationTimer);
            clearTimeout(unmountTimer);
        };
    }, []);

    // Effect for starting a new round on mount
    useEffect(() => {
        startNewRound();
    }, [startNewRound]);

    // Effect to redraw user's paths when they change
    useEffect(() => {
        const canvas = userCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        drawPaths(ctx, paths, targetStrokeWidth);
    }, [paths, targetStrokeWidth]);

    const getPointInCanvas = (e: React.MouseEvent | React.PointerEvent): Point => {
        const canvas = userCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isRoundOver || isDrawing) return;

        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDrawing(true);
        const point = getPointInCanvas(e);

        // Always start a new path on pointer down for a new stroke
        setPaths(prevPaths => [...prevPaths, [point]]);
        setHasDrawnInRound(true);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDrawing || isRoundOver) return;
        const point = getPointInCanvas(e);
        setPaths(prevPaths => {
            if (prevPaths.length === 0) return [];
            const newPaths = prevPaths.slice();
            const lastPath = newPaths[newPaths.length - 1];
            newPaths[newPaths.length - 1] = [...lastPath, point];
            return newPaths;
        });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDrawing) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        setIsDrawing(false);
    };
    
    const handleClearDrawing = () => {
        setPaths([]);
        setHasDrawnInRound(false);
    };

    const handleCheckGuess = () => {
        const diff = Math.abs(guessStrokeWidth - targetStrokeWidth);
        
        if (guessStrokeWidth === targetStrokeWidth) {
            setFeedback({ message: `You got it! It was ${targetStrokeWidth}px.`, type: 'success' });
            setIsRoundOver(true);
            const newWinCount = winCount + 1;
            setWinCount(newWinCount);
        } else {
            const newGuessesLeft = guessesLeft - 1;
            setGuessesLeft(newGuessesLeft);
            
            if (newGuessesLeft === 0) {
                setFeedback({ message: `Out of guesses! The answer was ${targetStrokeWidth}px.`, type: 'hint' });
                setIsRoundOver(true);
            } else if (guessStrokeWidth > targetStrokeWidth) {
                const message = diff > 10 ? 'Way too thick!' : 'A little too thick.';
                setFeedback({ message, type: 'hint' });
            } else {
                const message = diff > 10 ? 'Way too thin!' : 'A little too thin.';
                setFeedback({ message, type: 'hint' });
            }
        }
    };

    const handleExportDrawing = () => {
        const sourceCanvas = userCanvasRef.current;
        if (!sourceCanvas || paths.length === 0) return;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = sourceCanvas.width;
        exportCanvas.height = sourceCanvas.height;
        const ctx = exportCanvas.getContext('2d');

        if (!ctx) return;

        // 1. Draw a white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // 2. Draw the final paths from the round
        drawPaths(ctx, paths, targetStrokeWidth);

        // 3. Draw the creative overlay
        const bannerHeight = Math.max(80, exportCanvas.height * 0.15); // At least 80px tall
        ctx.fillStyle = 'rgba(15, 98, 254, 0.9)'; // UI blue with opacity
        ctx.fillRect(0, exportCanvas.height - bannerHeight, exportCanvas.width, bannerHeight);

        // 4. Draw the title text
        ctx.fillStyle = '#ffffff';
        const fontSize = Math.min(48, bannerHeight * 0.4); // Responsive font size
        ctx.font = `600 ${fontSize}px 'IBM Plex Sans', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('I guessed the stroke!', exportCanvas.width / 2, exportCanvas.height - bannerHeight / 2);

        // 5. Trigger share or download
        exportCanvas.toBlob(async (blob) => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                return;
            }

            const fileName = 'i-guessed-the-stroke.jpg';
            const file = new File([blob], fileName, { type: 'image/jpeg' });

            // Use Web Share API if available (great for mobile)
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'I guessed the stroke!',
                        text: 'Check out my drawing from the Guess the Stroke game!',
                    });
                } catch (error) {
                    // Fail silently if the user cancels the share dialog
                    if ((error as Error).name !== 'AbortError') {
                        console.error('Share API error:', error);
                    }
                }
            } else {
                // Fallback to traditional download (for desktop)
                const dataUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(dataUrl);
            }
        }, 'image/jpeg', 0.9);
    };


    // Resize observer to keep canvas drawing sharp
    useEffect(() => {
        const canvas = userCanvasRef.current;
        if (!canvas) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const canvasEl = entry.target as HTMLCanvasElement;
                const { width, height } = entry.contentRect;
                canvasEl.width = width;
                canvasEl.height = height;
                // Redraw after resize
                const ctx = canvasEl.getContext('2d');
                if(ctx) drawPaths(ctx, paths, targetStrokeWidth);
            }
        });

        resizeObserver.observe(canvas);

        return () => resizeObserver.disconnect();
    }, [paths, targetStrokeWidth]);

    return (
        <>
            {isIntroMounted && (
                <div className={`intro-overlay ${!isIntroVisible ? 'hidden' : ''}`} aria-hidden="true">
                    <svg viewBox="0 0 500 200" className="intro-svg">
                        <path
                            className="intro-stroke"
                            d="M 40,120 C 150,140 350,100 460,120"
                        />
                        <text x="50%" y="45%" dy=".3em" textAnchor="middle" className="intro-text">
                            {'Guess the Stroke'.split('').map((char, index) => (
                                <tspan
                                    key={index}
                                    style={{ animationDelay: `${1.2 + index * 0.05}s` }}
                                >
                                    {char === ' ' ? '\u00A0' : char}
                                </tspan>
                            ))}
                        </text>
                    </svg>
                </div>
            )}
            <div className="app-container">
                <div
                    className={`canvas-container ${isRoundOver ? 'disabled' : ''}`}
                    aria-label="Fullscreen canvas for drawing"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    <canvas ref={userCanvasRef}></canvas>
                    <button
                        className="btn-clear-canvas"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={handleClearDrawing}
                        disabled={paths.length === 0 || isRoundOver}
                        aria-label="Clear drawing"
                        title="Clear drawing"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                </div>
                <div className="controls-panel">
                    <h1 className="controls-title">Guess the Stroke</h1>
                    <div className="slider-group">
                        <label htmlFor="stroke-slider" className="slider-label">Your Guess:</label>
                        <input
                            id="stroke-slider"
                            type="range"
                            min={MIN_STROKE}
                            max={MAX_STROKE}
                            value={guessStrokeWidth}
                            onChange={(e) => setGuessStrokeWidth(Number(e.target.value))}
                            disabled={isRoundOver}
                            aria-label="Stroke width slider"
                        />
                        <span className="slider-value">{guessStrokeWidth}px</span>
                    </div>
                    <div className="stats-container">
                        <div className="stat-item">Guesses Left: {guessesLeft}</div>
                        <div className="stat-item">Wins: {winCount}</div>
                    </div>
                    <div className={`feedback feedback--${feedback.type}`}>
                        {feedback.message}
                    </div>
                    <div className="button-group">
                        <button onClick={handleCheckGuess} className="btn btn--primary" disabled={isRoundOver || !hasDrawnInRound || guessesLeft === 0}>
                            Check Guess
                        </button>
                        <button onClick={handleClearDrawing} className="btn btn--secondary hide-on-mobile" disabled={paths.length === 0 || isRoundOver}>
                            Clear
                        </button>
                        <button onClick={startNewRound} className={`btn ${isRoundOver ? 'btn--primary' : 'btn--secondary'}`} disabled={!isRoundOver}>
                            Next Round
                        </button>
                        <button 
                            onClick={handleExportDrawing} 
                            className="btn btn--secondary" 
                            disabled={!isRoundOver || paths.length === 0}
                            title={!isRoundOver ? "Finish the round to save your drawing" : "Save your drawing as a JPG"}
                        >
                            <span className="show-on-desktop">Export</span>
                            <span className="show-on-mobile">Save</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}