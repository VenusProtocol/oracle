/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  IPyth,
  IPythInterface,
} from "../../../../contracts/interfaces/PythInterface.sol/IPyth";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint16",
        name: "chainId",
        type: "uint16",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "sequenceNumber",
        type: "uint64",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "batchSize",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "freshPricesInBatch",
        type: "uint256",
      },
    ],
    name: "BatchPriceFeedUpdate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "bool",
        name: "fresh",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "uint16",
        name: "chainId",
        type: "uint16",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "sequenceNumber",
        type: "uint64",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "lastPublishTime",
        type: "uint64",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "publishTime",
        type: "uint64",
      },
      {
        indexed: false,
        internalType: "int64",
        name: "price",
        type: "int64",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "conf",
        type: "uint64",
      },
    ],
    name: "PriceFeedUpdate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "batchCount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "fee",
        type: "uint256",
      },
    ],
    name: "UpdatePriceFeeds",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
    ],
    name: "getCurrentPrice",
    outputs: [
      {
        components: [
          {
            internalType: "int64",
            name: "price",
            type: "int64",
          },
          {
            internalType: "uint64",
            name: "conf",
            type: "uint64",
          },
          {
            internalType: "int32",
            name: "expo",
            type: "int32",
          },
        ],
        internalType: "struct PythStructs.Price",
        name: "price",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
    ],
    name: "getEmaPrice",
    outputs: [
      {
        components: [
          {
            internalType: "int64",
            name: "price",
            type: "int64",
          },
          {
            internalType: "uint64",
            name: "conf",
            type: "uint64",
          },
          {
            internalType: "int32",
            name: "expo",
            type: "int32",
          },
        ],
        internalType: "struct PythStructs.Price",
        name: "price",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
    ],
    name: "getLatestAvailablePriceUnsafe",
    outputs: [
      {
        components: [
          {
            internalType: "int64",
            name: "price",
            type: "int64",
          },
          {
            internalType: "uint64",
            name: "conf",
            type: "uint64",
          },
          {
            internalType: "int32",
            name: "expo",
            type: "int32",
          },
        ],
        internalType: "struct PythStructs.Price",
        name: "price",
        type: "tuple",
      },
      {
        internalType: "uint64",
        name: "publishTime",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
      {
        internalType: "uint64",
        name: "duration",
        type: "uint64",
      },
    ],
    name: "getLatestAvailablePriceWithinDuration",
    outputs: [
      {
        components: [
          {
            internalType: "int64",
            name: "price",
            type: "int64",
          },
          {
            internalType: "uint64",
            name: "conf",
            type: "uint64",
          },
          {
            internalType: "int32",
            name: "expo",
            type: "int32",
          },
        ],
        internalType: "struct PythStructs.Price",
        name: "price",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "updateDataSize",
        type: "uint256",
      },
    ],
    name: "getUpdateFee",
    outputs: [
      {
        internalType: "uint256",
        name: "feeAmount",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes[]",
        name: "updateData",
        type: "bytes[]",
      },
    ],
    name: "updatePriceFeeds",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes[]",
        name: "updateData",
        type: "bytes[]",
      },
      {
        internalType: "bytes32[]",
        name: "priceIds",
        type: "bytes32[]",
      },
      {
        internalType: "uint64[]",
        name: "publishTimes",
        type: "uint64[]",
      },
    ],
    name: "updatePriceFeedsIfNecessary",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

export class IPyth__factory {
  static readonly abi = _abi;
  static createInterface(): IPythInterface {
    return new utils.Interface(_abi) as IPythInterface;
  }
  static connect(address: string, signerOrProvider: Signer | Provider): IPyth {
    return new Contract(address, _abi, signerOrProvider) as IPyth;
  }
}