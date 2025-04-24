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
      {/* Main layout with sidebar for connection info */}
      <div className="flex">
        {/* Connection panel as a side panel */}
        {showConnectionInfo && (
          <div className="connection-panel-container w-72 p-4 shrink-0">
            <PlayerConnectionInfo compact={false} />
          </div>
        )}
        
        {/* Main content */}
        <div className="game-layout-content flex-1 p-4">
          {children}
        </div>
      </div>
    </div>
  );
}