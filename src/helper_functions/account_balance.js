export async function getAccountBalance(env, CST, X_SECURITY_TOKEN, baseURL) {

    let attempts = 1;
    let accountResponse;
    while (attempts <= 3) {

        // Fetch the account balance
        accountResponse = await fetch(`${baseURL}/accounts`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-IG-API-KEY': env.IG_API_KEY,
                'Version': '1',
                'CST': CST,
                'X-SECURITY-TOKEN': X_SECURITY_TOKEN
            }
        });

        if (accountResponse.ok) {
            console.log(`Get account balance attempt ${attempts} succeeded`);
            const accountData = await accountResponse.json();
            let accountBalance;
            if (baseURL === 'https://demo-api.ig.com/gateway/deal') {
                accountBalance = accountData.accounts[1].balance.balance;
            } else {
                let account = accountData.accounts.find(acc => acc.accountName === "Spread bet 2");
                accountBalance = account.balance.balance;
            }
            return accountBalance;
        } else {
            const responseBody = await accountResponse.json();
            console.log(`Attempt ${attempts} failed with status: ${accountResponse.status}, Response: ${JSON.stringify(responseBody, null, 2)}`);
            attempts++;
            if (attempts > 3) {
                throw new Error(`Error getting account. HTTP status: ${accountResponse.status}, Response: ${JSON.stringify(responseBody, null, 2)}`);
            }
        }
    }

}

