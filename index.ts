const url = "https://subgraph.satsuma-prod.com/gmx/synthetics-arbitrum-stats/api";

const query = `
query {
    gmARBMarket: marketIncentivesStats(
        skip: 1
        first: 1
        where: {
            marketAddress: "0xc25cef6061cf5de5eb761b50e4743c1f5d7e5407"
        }
        orderBy: timestamp
        orderDirection: desc
    ) {
        weightedAverageMarketTokensSupply
        timestamp
    }

    gmETHMarket: marketIncentivesStats(
        skip: 1
        first: 1
        where: {
        marketAddress: "0x70d95587d40a2caf56bd97485ab3eec10bee6336"
        }
        orderBy: timestamp
        orderDirection: desc
    ) {
        weightedAverageMarketTokensSupply
        timestamp
    }

    gmBTCMarket: marketIncentivesStats(
        skip: 1
        first: 1
        where: {
            marketAddress: "0x47c031236e19d024b42f8ae6780e44a573170703"
        }
        orderBy: timestamp
        orderDirection: desc
    ) {
        weightedAverageMarketTokensSupply
        timestamp
    }

    
    gmSOLMarket: marketIncentivesStats(
        skip: 1
        first: 1
        where: {
        marketAddress: "0x09400d9db990d5ed3f35d7be61dfaeb900af03c9"
        }
        orderBy: timestamp
        orderDirection: desc
    ) {
        weightedAverageMarketTokensSupply
        timestamp
    }
    
    gmARBDeposit: liquidityProviderIncentivesStats(
        skip: 1
        first: 1
        where: {
            account: "0x7c8fef8ea9b1fe46a7689bfb8149341c90431d38"
            marketAddress: "0xc25cef6061cf5de5eb761b50e4743c1f5d7e5407"
        }
        orderBy: timestamp
        orderDirection: desc
    ) {
        weightedAverageMarketTokensBalance
        timestamp
    }

    gmBTCDeposit: liquidityProviderIncentivesStats(
        skip: 1
        first: 1
        where: {
            account: "0x7c8fef8ea9b1fe46a7689bfb8149341c90431d38"
            marketAddress: "0x47c031236e19d024b42f8ae6780e44a573170703"
        }
        orderBy: timestamp
        orderDirection: desc
    ) {
        weightedAverageMarketTokensBalance
        timestamp
    }

    gmETHDeposit: liquidityProviderIncentivesStats(
        skip: 1
        first: 1
        where: {
        account: "0x7c8fef8ea9b1fe46a7689bfb8149341c90431d38"
        marketAddress: "0x70d95587d40a2caf56bd97485ab3eec10bee6336"
        }
        orderBy: timestamp
        orderDirection: desc
    ) {
        weightedAverageMarketTokensBalance
        timestamp
    }

    gmSOLDeposit: liquidityProviderIncentivesStats(
        skip: 1
        first: 1
        where: {
        account: "0x7c8fef8ea9b1fe46a7689bfb8149341c90431d38"
        marketAddress: "0x09400d9db990d5ed3f35d7be61dfaeb900af03c9"
        }
        orderBy: timestamp
        orderDirection: desc
    ) {
        weightedAverageMarketTokensBalance
        timestamp
    }
}
`;

const main = async () => {
    console.log("Fetching data...");
    const result = await fetch(url, {
        method: "POST", body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json", "origin": "https://subgraph.satsuma-prod.com", "referer": "https://subgraph.satsuma-prod.com/gmx/synthetics-arbitrum-stats/playground" }
    });

    const json = await result.json();
    console.log(json);
}

main();