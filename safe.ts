import { IterableElement, SetOptional, SetRequired } from "type-fest";
import { Address, Chain, Hex, keccak256, toBytes } from "viem";
import { AbiFunction, AbiParameter } from 'abitype'

type AbiFunctionNamedInputs = AbiFunction & { inputs: Readonly<SetRequired<AbiParameter, 'name'>[]> };

const stringifyReplacer = (_: any, value: any) => (value === undefined ? null : value);

const serializeJSONObject = (json: any): any => {
  if (Array.isArray(json)) {
    return `[${json.map((el) => serializeJSONObject(el)).join(',')}]`;
  }

  if (typeof json === 'object' && json !== null) {
    let acc = '';
    const keys = Object.keys(json).sort();
    acc += `{${JSON.stringify(keys, stringifyReplacer)}`;

    for (let i = 0; i < keys.length; i++) {
      acc += `${serializeJSONObject(json[keys[i]])},`;
    }

    return `${acc}}`;
  }

  return `${JSON.stringify(json, stringifyReplacer)}`;
};

function calculateChecksum<T extends Transaction<AbiFunctionNamedInputs>[]>(batch: SetOptional<Batch<T>, 'version' | 'createdAt' | 'meta'>) {
  const batchObject = {
    ...batch,
    meta: { ...batch.meta, name: null },
  };
  delete batchObject?.meta?.checksum;
  const serialized = serializeJSONObject(batchObject);

  return keccak256(toBytes(serialized));
};

export type Transaction<T extends AbiFunctionNamedInputs> = {
  to: Address;
  value: `${bigint}`;
  data?: Hex;
  contractMethod?: T;
} & (T extends undefined ? {} : {
  contractInputsValues: Record<IterableElement<T['inputs']>['name'], string>;
});

export function createTransaction<const T extends AbiFunctionNamedInputs>(transaction: Transaction<T>) {
  return transaction;
}

export type Batch<T extends Transaction<AbiFunctionNamedInputs>[]> = {
  version: `${bigint}.${bigint}`;
  chainId: `${Chain['id']}`;
  createdAt: number;
  meta: { name?: string; checksum: Hex; };
  transactions: T;
};

export function createBatch<T extends Transaction<AbiFunctionNamedInputs>[]>(batch: SetOptional<Batch<T>, 'version' | 'createdAt' | 'meta'>) {
  const batchWithDefaults = {
    version: "1.0" as const,
    createdAt: new Date().getTime(),
    ...batch,
  };
  const checksum = calculateChecksum(batchWithDefaults);
  return {
    ...batchWithDefaults,
    meta: {
      ...batchWithDefaults.meta,
      checksum,
    }
  };
}
