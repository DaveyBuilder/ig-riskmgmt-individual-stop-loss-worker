import { loginIG } from './helper_functions/login_ig.js';
import { getOpenPositions } from './helper_functions/open_positions.js';
import {isMarketOpen} from './helper_functions/is_market_open.js';
import { closePosition } from './helper_functions/close_position.js';
import { getAccountBalance } from './helper_functions/account_balance.js';

export async function executeScheduledTask(request, env, ctx, usingDemoAccount) {

    let baseURL;
    if (usingDemoAccount) {
        baseURL = 'https://demo-api.ig.com/gateway/deal';
    } else {
        baseURL = 'https://api.ig.com/gateway/deal';
    }

    const { CST, X_SECURITY_TOKEN } = await loginIG(env, baseURL);

    // Check if nasdaq 100 futures are open & exit if not
	const marketStatus = await isMarketOpen(env, CST, X_SECURITY_TOKEN, baseURL);
	if (marketStatus === "EDITS_ONLY") {
		return;
	}

    const accountBalance = await getAccountBalance(env, CST, X_SECURITY_TOKEN, baseURL);

    const openPositionsData = await getOpenPositions(env, CST, X_SECURITY_TOKEN, baseURL);

    // Initialize an empty object to store the summed profit and loss for each market
    let summedPositions = {};

    openPositionsData.positions.forEach(position => {

        const instrumentName = position.market.instrumentName;
        const direction = position.position.direction;
        const positionSize = position.position.size;

        let pl;

        if (direction === 'BUY') {
            const price = position.market.bid;
            // Using Math.round() to keep the pl at 2 decimal places
            pl = Math.round((price - position.position.level) * positionSize * 100) / 100;
        } else if (direction === 'SELL') {
            const price = position.market.offer;
            pl = Math.round((position.position.level - price) * positionSize * 100) / 100;
        }

        if (summedPositions[instrumentName]) {
            // Using Math.round() to keep the pl at 2 decimal places
            summedPositions[instrumentName].pl = Math.round((summedPositions[instrumentName].pl + pl) * 100) / 100;
            summedPositions[instrumentName].positions.push(position);
        } else {
            summedPositions[instrumentName] = { pl: pl, positions: [position] };
        }

    });

    // Add a plRatio property to each instrumentName and the market status

    for (const instrumentName in summedPositions) {
        const plRatio = summedPositions[instrumentName].pl / accountBalance;
        summedPositions[instrumentName].plRatio = plRatio;
        const marketStatus = summedPositions[instrumentName].positions[0].market.marketStatus;
        summedPositions[instrumentName].marketStatus = marketStatus;
    }

    // Push positions to close to an array

    const positionsToClose = [];

    for (const instrumentName in summedPositions) {
        if (summedPositions[instrumentName].plRatio < -0.01 && summedPositions[instrumentName].marketStatus === "TRADEABLE") {
            for (const position of summedPositions[instrumentName].positions) {
                const positionDetailsForClosure = {
                    dealId: position.position.dealId,
                    epic: null,
                    expiry: null,
                    direction: position.position.direction === "BUY" ? "SELL" : "BUY",
                    size: String(position.position.size),
                    level: null,
                    orderType: "MARKET",
                    timeInForce: "FILL_OR_KILL",
                    quoteId: null,
                };
                positionsToClose.push(positionDetailsForClosure);
            }
        }
    }

    // Now close each position in positionsToClose

    // Iterate over positionsToClose and make a request for each
    let closedPositionsErrors = [];
    for (const position of positionsToClose) {
        try {
            await closePosition(env, CST, X_SECURITY_TOKEN, baseURL, position);
        } catch (error) {
            closedPositionsErrors.push(error);
        }
    }

    if (closedPositionsErrors.length > 0) {
        throw new Error(`Failed to close positions: ${closedPositionsErrors.map(error => error.message).join(", ")}`);
    }

}