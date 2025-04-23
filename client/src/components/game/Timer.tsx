interface TimerProps {
  timeRemaining: number;
}

export default function Timer({ timeRemaining }: TimerProps) {
  // Calculate the percentage of time remaining
  const percentage = Math.min(100, Math.max(0, (timeRemaining / 60) * 100));
  
  // Calculate the stroke-dashoffset value (100 = full circle)
  const strokeDashoffset = 100 - percentage;
  
  return (
    <div className="relative h-14 w-14">
      <svg className="w-full h-full" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" stroke="#e6e6e6" strokeWidth="2"></circle>
        <circle 
          className="timer-circle" 
          cx="18" 
          cy="18" 
          r="16" 
          fill="none" 
          stroke="#5D3FD3" 
          strokeWidth="2" 
          strokeDasharray="100" 
          strokeDashoffset={strokeDashoffset}
        ></circle>
      </svg>
      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
        <span className="text-lg font-medium">{timeRemaining}</span>
      </div>
    </div>
  );
}
