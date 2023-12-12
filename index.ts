import { readFile, writeFile } from "fs/promises";
import { Address, parseAbiItem } from "viem";
import { createBatch, createTransaction } from "./safe";
import { arbitrum } from "viem/chains";

const approveAbi = parseAbiItem(
  "function approve(address _spender, uint256 _value) public returns (bool success)" as const
);

const notifyRewardAmountAbi = parseAbiItem(
  "function notifyRewardAmount(address rewardToken, uint256 amount) public" as const
)

const bentoBox: Address = "0x7c8fef8ea9b1fe46a7689bfb8149341c90431d38";

const rewardToken: Address = "0x912ce59144191c1204e64559fe8253a0e49e6548";

type Market = {
  symbol: string;
  token: Address;
  farm: Address;
}

const markets = [{
  symbol: "ARB",
  token: "0xc25cef6061cf5de5eb761b50e4743c1f5d7e5407",
  farm: "0xaf4fdcaa6d9d5be4acd8fce02fa37f72b31a74cb",
}, {
  symbol: "BTC",
  token: "0x47c031236e19d024b42f8ae6780e44a573170703",
  farm: "0xeb0deab1099dd5a7d499b89a6f47cef8f08c5680",
}, {
  symbol: "ETH",
  token: "0x70d95587d40a2caf56bd97485ab3eec10bee6336",
  farm: "0xa7940dcb17214fabce26e146613804308c01c295",
}, {
  symbol: "LINK",
  token: "0x7f1fa204bb700853d36994da19f830b6ad18455c",
  farm: "0x5b51f27c279aeecc8352688b69d55b533417e263",
}, {
  symbol: "SOL",
  token: "0x09400d9db990d5ed3f35d7be61dfaeb900af03c9",
  farm: "0x18f7cca3d98ad96cf26dbda1db3fd71e30d32d31",
}] as const satisfies Market[];

type TokenSymbol = typeof markets[number]['symbol'];

type QueryMarket = {
  "weightedAverageMarketTokensSupply": string,
  "timestamp": number;
};
type QueryDeposit = {
  "weightedAverageMarketTokensBalance": string,
  "timestamp": number;
};

type Query = {
  "data": Record<`gm${TokenSymbol}Deposit`, QueryDeposit[]> & Record<`gm${TokenSymbol}Market`, QueryMarket[]>
};

const url = "https://subgraph.satsuma-prod.com/gmx/synthetics-arbitrum-stats/api";

const query = (since: number) => {
  let objects = ""
  for (const { symbol, token } of markets) {
    objects += `
      gm${symbol}Deposit: liquidityProviderIncentivesStats(
        skip: 1
        first: 10000
        where: {
          account: "${bentoBox}"
          marketAddress: "${token}"
          timestamp_gt: ${since}
        }
        orderBy: timestamp
        orderDirection: desc
      ) {
        weightedAverageMarketTokensBalance
        timestamp
      }

      gm${symbol}Market: marketIncentivesStats(
        skip: 1
        first: 10000
        where: {
          marketAddress: "${token}"
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

type Distribution = Record<TokenSymbol, string>;

const main = async () => {
  const latestDistribution = Number(await readFile('./distributions/.latest', 'utf8'));
  const distribution: Distribution = JSON.parse(await readFile('./distribution.json', 'utf8'));

  const latestDistributionQuery = query(latestDistribution);
  const headers = { "Content-Type": "application/json", "origin": "https://subgraph.satsuma-prod.com", "referer": "https://subgraph.satsuma-prod.com/gmx/synthetics-arbitrum-stats/playground" };
  const result = await fetch(url, {
    method: "POST", body: JSON.stringify({ query: latestDistributionQuery }),
    headers
  });

  const { data } = await result.json() as Query;

  // Calculate distribution
  const transactions = [];
  for (const { symbol, farm } of markets) {
    const queryDeposits = data[`gm${symbol}Deposit`];
    const queryMarkets = data[`gm${symbol}Market`];

    if (queryDeposits.length > queryMarkets.length) {
      throw Error(`Markets and deposits inconsitent for ${symbol}`);
    }

    if (queryDeposits.length === 0) {
      continue;
    }

    const bentoboxAverageDeposited = queryDeposits.reduce((a, b) => a + BigInt(b.weightedAverageMarketTokensBalance), 0n) / BigInt(queryDeposits.length);
    const marketAverageDeposited = queryMarkets.slice(0, queryDeposits.length).reduce((a, b) => a + BigInt(b.weightedAverageMarketTokensSupply), 0n) / BigInt(queryMarkets.length);

    const distributionAmount = BigInt(distribution[symbol]) * 10n ** 18n * bentoboxAverageDeposited / marketAverageDeposited;
    transactions.push(
      createTransaction({
        to: rewardToken,
        value: "0",
        contractMethod: approveAbi,
        contractInputsValues: {
          _spender: farm,
          _value: distributionAmount.toString(),
        },
      })
    );
    transactions.push(
      createTransaction({
        to: farm,
        value: "0",
        contractMethod: notifyRewardAmountAbi,
        contractInputsValues: {
          amount: distributionAmount.toString(),
          rewardToken: rewardToken,
        }
      })
    )
  }

  if (transactions.length === 0) {
    console.log("Nothing to distribute...")
  } else {
    const distributionTimestamp = data[`gm${markets[0].symbol}Market`][0].timestamp;
    const batch = createBatch({
      chainId: `${arbitrum.id}`,
      transactions,
    });
    const transactionBatchFile = `./distributions/${distributionTimestamp}_transaction_batch.json`;
    const inputFile = `./distributions/${distributionTimestamp}_input.json`;
    await writeFile(transactionBatchFile, JSON.stringify(batch, null, 4), 'utf8');
    await writeFile(inputFile, JSON.stringify({ url, headers, query: latestDistributionQuery.replace(/\n\s*/g, ' ').replace(/\"/g, '\'').trim(), result: data }, null, 4), 'utf8');
    await writeFile('./distributions/.latest', distributionTimestamp.toString(), 'utf8');
    console.log(`Created distribution: ${transactionBatchFile}`);
  }
}

main();
