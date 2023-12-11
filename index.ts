import { readFile, writeFile } from "fs/promises";

const tokens = [{
  symbol: "ARB",
  address: "0xc25cef6061cf5de5eb761b50e4743c1f5d7e5407",
}, {
  symbol: "BTC",
  address: "0x47c031236e19d024b42f8ae6780e44a573170703",
}, {
  symbol: "ETH",
  address: "0x70d95587d40a2caf56bd97485ab3eec10bee6336",
}, {
  symbol: "LINK",
  address: "0x7f1fa204bb700853d36994da19f830b6ad18455c",
}, {
  symbol: "SOL",
  address: "0x09400d9db990d5ed3f35d7be61dfaeb900af03c9",
}] as const;

type TokenSymbol = typeof tokens[number]['symbol'];

type Market = {
  "weightedAverageMarketTokensSupply": string,
  "timestamp": number;
};
type Deposit = {
  "weightedAverageMarketTokensBalance": string,
  "timestamp": number;
};

type Query = {
  "data": Record<`gm${TokenSymbol}Deposit`, Deposit[]> & Record<`gm${TokenSymbol}Market`, Market[]>
};

const url = "https://subgraph.satsuma-prod.com/gmx/synthetics-arbitrum-stats/api";

const query = (since: number) => {
  let objects = ""
  for (const { symbol, address } of tokens) {
    objects += `
      gm${symbol}Deposit: liquidityProviderIncentivesStats(
        skip: 1
        first: 10000
        where: {
          account: "0x7c8fef8ea9b1fe46a7689bfb8149341c90431d38"
          marketAddress: "${address}"
          timestamp_gt: ${since}
        }
        orderBy: timestamp
        orderDirection: desc
      ) {
        weightedAverageMarketTokensBalance
        timestamp
      }
    `;

    objects += `
      gm${symbol}Market: marketIncentivesStats(
        skip: 1
        first: 10000
        where: {
          marketAddress: "${address}"
          timestamp_gt: ${since}
        }
        orderBy: timestamp
        orderDirection: desc
      ) {
        weightedAverageMarketTokensSupply
        timestamp
      }
    `;
  }
  return `
    query {
      ${objects}
    }
  `;
};

type Storage = {
  lastDistributionTimestamp: number;
};

type Distribution = Record<TokenSymbol, string>;

const main = async () => {
  const storage: Storage = JSON.parse(await readFile('./storage.json', 'utf8'));
  const distribution: Distribution = JSON.parse(await readFile('./distribution.json', 'utf8'));

  const result = await fetch(url, {
    method: "POST", body: JSON.stringify({ query: query(storage.lastDistributionTimestamp) }),
    headers: { "Content-Type": "application/json", "origin": "https://subgraph.satsuma-prod.com", "referer": "https://subgraph.satsuma-prod.com/gmx/synthetics-arbitrum-stats/playground" }
  });

  const { data } = await result.json() as Query;

  let emptyDistribution = true;
  // Calculate distribution
  for (const { symbol } of tokens) {
    const deposits = data[`gm${symbol}Deposit`];
    const markets = data[`gm${symbol}Market`];

    if (deposits.length > markets.length) {
      throw Error(`Markets and deposits inconsitent for ${symbol}`);
    }

    if (deposits.length === 0) {
      continue;
    }

    emptyDistribution = false;

    const bentoboxAverageDeposited = deposits.reduce((a, b) => a + BigInt(b.weightedAverageMarketTokensBalance), 0n) / BigInt(deposits.length);
    const marketAverageDeposited = markets.slice(0, deposits.length).reduce((a, b) => a + BigInt(b.weightedAverageMarketTokensSupply), 0n) / BigInt(markets.length);
    const ratio = Number(bentoboxAverageDeposited) / Number(marketAverageDeposited);
    const distribute = Number(distribution[symbol]) * ratio;
    console.log(`Distibute "${distribute}" to gm${symbol}`);
  }

  if (emptyDistribution) {
    console.log("Nothing to distribute...")
  } else {
    const newStorage: Storage = {
      lastDistributionTimestamp: data[`gm${tokens[0].symbol}Market`][0].timestamp,
    };
    await writeFile('./storage.json', JSON.stringify(newStorage, undefined, 4), 'utf8');
  }
}

main();
