import { loginIG } from './login_ig.js';

export async function stopLoss(request, env, ctx, usingDemoAccount) {

    let baseURL;
    if (usingDemoAccount) {
        baseURL = 'https://demo-api.ig.com/gateway/deal';
    } else {
        baseURL = 'https://api.ig.com/gateway/deal';
    }

    const { CST, X_SECURITY_TOKEN } = await loginIG(env, usingDemoAccount);

    // Fetch the account balance
    const accountResponse = await fetch(`${baseURL}/accounts`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-IG-API-KEY': env.IG_API_KEY,
            'Version': '1',
            'CST': CST,
            'X-SECURITY-TOKEN': X_SECURITY_TOKEN
        }
    });

    if (!accountResponse.ok) {
        throw new Error(`Error getting account. HTTP status: ${accountResponse.status}`);
    }

    const accountData = await accountResponse.json();

    let accountBalance;
    let account;
    if (usingDemoAccount) {
        accountBalance = accountData.accounts[1].balance.balance;
    } else {
        account = accountData.accounts.find(acc => acc.accountName === "Spread bet 2");
        accountBalance = account.balance.balance;
    }

    // Fetch all open positions
    const openPositionsResponse = await fetch(`${baseURL}/positions`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-IG-API-KEY': env.IG_API_KEY,
            'Version': '2',
            'CST': CST,
            'X-SECURITY-TOKEN': X_SECURITY_TOKEN
        }
    });

    if (!openPositionsResponse.ok) {
        throw new Error(`Error getting open positions. HTTP status: ${openPositionsResponse.status}`);
    }

    const openPositionsData = await openPositionsResponse.json();

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
    
    // Define the headers
    const closePositionHeaders = {
        'Content-Type': 'application/json',
        'X-IG-API-KEY': env.IG_API_KEY,
        'Version': '1',
        'CST': CST,
        'X-SECURITY-TOKEN': X_SECURITY_TOKEN,
        '_method': 'DELETE'
    };

    // Iterate over positionsToClose and make a request for each
    for (const position of positionsToClose) {
        const response = await fetch(`${baseURL}/positions/otc`, {
            method: 'POST',
            headers: closePositionHeaders,
            body: JSON.stringify(position) // Convert the JavaScript object to a string
        });

        if (!response.ok) {
            console.error(`Failed to close position. Status code: ${response.status}`);
        } else {
            console.log(`Position closed successfully.`);
        }
    }

    //return positionsToClose;


}