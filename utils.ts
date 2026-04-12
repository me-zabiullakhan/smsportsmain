
import { AuctionState, Team, Player } from './types';

/**
 * Calculates the maximum allowed bid for a team, ensuring they have enough 
 * budget left to fill their squad up to the required minimums and total size.
 */
export const calculateMaxBid = (
    team: Team,
    state: AuctionState,
    currentPlayer: Player | null
): { maxBid: number; reservedAmount: number; playersNeeded: number } => {
    const { 
        maxPlayersPerTeam = 25, 
        categories = [], 
        roles = [], 
        basePrice: globalBasePrice = 100,
        unlimitedPurse = false,
        autoReserveFunds = false 
    } = state;

    const currentSquadCount = team.players.length;
    const targetSquadSize = maxPlayersPerTeam;
    
    // If we buy the current player, how many more do we need to reach the target?
    const playersNeededAfterThis = Math.max(0, targetSquadSize - (currentSquadCount + 1));

    if (unlimitedPurse) {
        return { maxBid: Infinity, reservedAmount: 0, playersNeeded: playersNeededAfterThis };
    }

    // Calculate the absolute minimum base price across all categories and roles
    // We use this as the "cheapest possible" cost for a flexible slot
    const absoluteMinBasePrice = Math.max(1, Math.min(
        globalBasePrice || 100,
        ...(categories.length > 0 ? categories.map(c => Number(c.basePrice) || 100) : [100]),
        ...(roles.length > 0 ? roles.map(r => Number(r.basePrice) || 100) : [100])
    ));

    let reservedAmount = 0;
    let mandatorySlotsUsed = 0;

    // 1. Mandatory Category Requirements
    // If autoReserveFunds is enabled, we calculate based on category minimums
    if (autoReserveFunds) {
        categories.forEach(cat => {
            const countInCat = team.players.filter(p => p.category === cat.name).length;
            let neededInCat = Math.max(0, (Number(cat.minPerTeam) || 0) - countInCat);
            
            // If current player is in this category, they satisfy one of the needed slots
            if (currentPlayer && currentPlayer.category === cat.name) {
                neededInCat = Math.max(0, neededInCat - 1);
            }

            reservedAmount += (neededInCat * (Number(cat.basePrice) || absoluteMinBasePrice));
            mandatorySlotsUsed += neededInCat;
        });
    }

    // 2. Total Squad Requirement
    // Any remaining slots to reach the total squad size must also be reserved at the minimum price.
    // This part is CRITICAL: we ALWAYS respect the total squad size to ensure they can fill their team.
    const flexibleSlots = Math.max(0, playersNeededAfterThis - mandatorySlotsUsed);
    reservedAmount += (flexibleSlots * absoluteMinBasePrice);

    return {
        maxBid: team.budget - reservedAmount,
        reservedAmount,
        playersNeeded: playersNeededAfterThis
    };
};
