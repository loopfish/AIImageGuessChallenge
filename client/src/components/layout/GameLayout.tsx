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
      {/* Always show the connection panel if flag is enabled, regardless of connection state */}
      {showConnectionInfo && (
        <div className="mb-6" style={{display: 'block', visibility: 'visible'}}>
          <PlayerConnectionInfo />
        </div>
      )}
      
      {/* Main content */}
      {children}
    </div>
  );
}