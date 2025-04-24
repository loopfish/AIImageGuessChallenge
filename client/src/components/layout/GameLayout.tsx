import React from 'react';
import { PlayerConnectionInfo } from "@/components/game/PlayerConnectionInfo";
import { useGameContext } from "@/hooks/use-game";

interface GameLayoutProps {
  children: React.ReactNode;
  showConnectionInfo?: boolean;
}

/**
 * Layout component for all game screens
 * Automatically includes the PlayerConnectionInfo on all screens
 * Always shows the connection panel with all possible fallbacks
 */
export function GameLayout({ children, showConnectionInfo = true }: GameLayoutProps) {
  const { gameState, isConnected } = useGameContext();

  // Debug log for GameLayout component
  console.log("GameLayout rendering with state:", {
    isConnected,
    showConnectionInfo,
    hasGameState: Boolean(gameState)
  });

  return (
    <div className="game-layout">
      {/* Always display the connection panel with guaranteed visibility */}
      {showConnectionInfo && (
        <div 
          className="mb-6" 
          style={{
            display: 'block', 
            visibility: 'visible',
            position: 'relative',
            zIndex: 10
          }}
          data-force-display="true"
        >
          <PlayerConnectionInfo />
        </div>
      )}
      
      {/* Main content */}
      <div className="game-layout-content">
        {children}
      </div>
    </div>
  );
}