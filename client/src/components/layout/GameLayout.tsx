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
    <div className="game-layout max-w-[1200px] mx-auto">
      {/* Vertical layout with connection panel on top */}
      <div className="flex flex-col">
        {/* Connection panel at the top */}
        {showConnectionInfo && (
          <div className="connection-panel-container w-full mb-4 border-b pb-4">
            <PlayerConnectionInfo compact={false} />
          </div>
        )}
        
        {/* Main content */}
        <div className="game-layout-content w-full">
          {children}
        </div>
      </div>
    </div>
  );
}