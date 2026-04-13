
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

    // Calculate the price for flexible slots (non-mandatory slots)
    // We use the global base price as the standard for these slots.
    const flexibleSlotPrice = globalBasePrice || 100;

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

            const catBase = Number(cat.basePrice) || flexibleSlotPrice;
            reservedAmount += (neededInCat * catBase);
            mandatorySlotsUsed += neededInCat;
        });
    }

    // 2. Total Squad Requirement
    // Any remaining slots to reach the total squad size must also be reserved at the standard global base price.
    // This ensures they can fill their team with "Standard" players.
    const flexibleSlots = Math.max(0, playersNeededAfterThis - mandatorySlotsUsed);
    reservedAmount += (flexibleSlots * flexibleSlotPrice);

    return {
        maxBid: team.budget - reservedAmount,
        reservedAmount,
        playersNeeded: playersNeededAfterThis
    };
};

/**
 * Returns the effective base price of a player, considering their category.
 */
export const getEffectiveBasePrice = (player: Player, categories: any[]): number => {
    let basePrice = Number(player.basePrice) || 0;
    if (player.category) {
        const cat = categories.find(c => c.name === player.category);
        if (cat && Number(cat.basePrice) > basePrice) {
            basePrice = Number(cat.basePrice);
        }
    }
    return basePrice;
};
