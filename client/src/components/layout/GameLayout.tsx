import React from 'react';
import { PlayerConnectionInfo } from "@/components/game/PlayerConnectionInfo";
import { useGameContext } from "@/hooks/use-game";

interface GameLayoutProps {
  children: React.ReactNode;
  showConnectionInfo?: boolean;
}

/**
 * Layout component for all game screens
 * Automatically includes the PlayerConnectionInfo on all screens as a compact panel
 * in the top right corner
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
    <div className="game-layout relative">
      {/* Connection panel in top right corner */}
      {showConnectionInfo && (
        <div 
          className="connection-panel-container"
          style={{
            display: 'block', 
            visibility: 'visible',
            position: 'fixed',
            top: '16px',
            right: '16px',
            maxWidth: '260px',
            zIndex: 50
          }}
          data-force-display="true"
        >
          <PlayerConnectionInfo compact={true} />
        </div>
      )}
      
      {/* Main content */}
      <div className="game-layout-content pt-2">
        {children}
      </div>
    </div>
  );
}