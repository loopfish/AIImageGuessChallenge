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
  const { isConnected } = useGameContext();

  return (
    <div className="game-layout">
      {/* Always show the connection panel if connected and flag is enabled */}
      {showConnectionInfo && isConnected && (
        <div className="mb-6">
          <PlayerConnectionInfo />
        </div>
      )}
      
      {/* Main content */}
      {children}
    </div>
  );
}