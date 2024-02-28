export async function getOpenPositions(env, CST, X_SECURITY_TOKEN, baseURL) {

    let attempts = 1;
    let openPositionsResponse;
    while (attempts <= 3) {

        openPositionsResponse = await fetch(`${baseURL}/positions`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-IG-API-KEY': env.IG_API_KEY,
                'Version': '2',
                'CST': CST,
                'X-SECURITY-TOKEN': X_SECURITY_TOKEN
            }
        });

        if (openPositionsResponse.ok) {
            const contentType = openPositionsResponse.headers.get("Content-Type");
            if (contentType && contentType.includes("application/json")) {
                console.log(`Get open positions API attempt ${attempts} succeeded`);
                const openPositionsData = await openPositionsResponse.json();
                return openPositionsData;
            } else {
                // Log the unexpected response
                const responseBody = await openPositionsResponse.text(); // Use .text() to avoid JSON parsing error
                console.error(`Unexpected response type. Expected JSON, got: ${responseBody.substring(0, 100)}`); // Log the first 100 characters to avoid logging too much data
                throw new Error('Unexpected response type. Expected JSON.');
            }
        } else {
            const responseBody = await openPositionsResponse.text(); // Use .text() for safety
            console.log(`Attempt ${attempts} failed with status: ${openPositionsResponse.status}, Response: ${responseBody.substring(0, 100)}`);
            attempts++;
            if (attempts > 3) {
                throw new Error(`Error getting open positions. HTTP status: ${openPositionsResponse.status}, Response: ${responseBody.substring(0, 100)}`);
            }
        }
    }

}