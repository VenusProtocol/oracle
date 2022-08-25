/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import type { Provider, TransactionRequest } from "@ethersproject/providers";
import type { PromiseOrValue } from "../../../common";
import type {
  TwapOracle,
  TwapOracleInterface,
} from "../../../contracts/oracles/TwapOracle";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "vToken",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldTimestamp",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newTimestamp",
        type: "uint256",
      },
    ],
    name: "AnchorPriceUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "vToken",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "pancakePool",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "anchorPeriod",
        type: "uint256",
      },
    ],
    name: "TokenConfigAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "vToken",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldTimestamp",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oldAcc",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newTimestamp",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newAcc",
        type: "uint256",
      },
    ],
    name: "TwapWindowUpdated",
    type: "event",
  },
  {
    inputs: [],
    name: "VBNB",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "vToken",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "baseUnit",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "pancakePool",
            type: "address",
          },
          {
            internalType: "bool",
            name: "isBnbBased",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "isReversedPool",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "anchorPeriod",
            type: "uint256",
          },
        ],
        internalType: "struct TokenConfig",
        name: "config",
        type: "tuple",
      },
    ],
    name: "addTokenConfig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "vToken",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "baseUnit",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "pancakePool",
            type: "address",
          },
          {
            internalType: "bool",
            name: "isBnbBased",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "isReversedPool",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "anchorPeriod",
            type: "uint256",
          },
        ],
        internalType: "struct TokenConfig[]",
        name: "configs",
        type: "tuple[]",
      },
    ],
    name: "addTokenConfigs",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "bnbBaseUnit",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "busdBaseUnit",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "vToken",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "baseUnit",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "pancakePool",
            type: "address",
          },
          {
            internalType: "bool",
            name: "isBnbBased",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "isReversedPool",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "anchorPeriod",
            type: "uint256",
          },
        ],
        internalType: "struct TokenConfig",
        name: "config",
        type: "tuple",
      },
    ],
    name: "currentCumulativePrice",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "expScale",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "vToken",
        type: "address",
      },
    ],
    name: "getUnderlyingPrice",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "newObservations",
    outputs: [
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "acc",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "oldObservations",
    outputs: [
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "acc",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "prices",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "tokenConfigs",
    outputs: [
      {
        internalType: "address",
        name: "vToken",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "baseUnit",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "pancakePool",
        type: "address",
      },
      {
        internalType: "bool",
        name: "isBnbBased",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "isReversedPool",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "anchorPeriod",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "vToken",
        type: "address",
      },
    ],
    name: "updateTwap",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b5061001a3361001f565b61006f565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b6115838061007e6000396000f3fe608060405234801561001057600080fd5b50600436106101005760003560e01c80638cea8c2611610097578063cfed246b11610066578063cfed246b1461029a578063f2fde38b146102ba578063fc57d4df146102cd578063fe16e80c146102e057600080fd5b80638cea8c261461023a5780638da5cb5b14610276578063a0d5460714610287578063b8a8a6261461021057600080fd5b8063609f0f36116100d3578063609f0f361461021057806369aa3ac614610210578063715018a61461021f578063725068a51461022757600080fd5b80631b69dc5f146101055780632b9d9dea146101a75780633421fc52146101c85780633c3b559c146101fb575b600080fd5b6101606101133660046111fb565b600160208190526000918252604090912080549181015460028201546003909201546001600160a01b039384169391929182169160ff600160a01b8204811692600160a81b909204169086565b604080516001600160a01b03978816815260208101969096529390951692840192909252151560608301521515608082015260a081019190915260c0015b60405180910390f35b6101ba6101b5366004611301565b610307565b60405190815260200161019e565b6101e373a07c5b74c9b40447a954e1466938b865b6bbea3681565b6040516001600160a01b03909116815260200161019e565b61020e61020936600461131d565b610336565b005b6101ba670de0b6b3a764000081565b61020e610430565b6101ba6102353660046111fb565b610496565b6102616102483660046111fb565b6002602052600090815260409020805460019091015482565b6040805192835260208301919091520161019e565b6000546001600160a01b03166101e3565b61020e610295366004611301565b6105f3565b6101ba6102a83660046111fb565b60046020526000908152604090205481565b61020e6102c83660046111fb565b61096c565b6101ba6102db3660046111fb565b610a4e565b6102616102ee3660046111fb565b6003602052600090815260409020805460019091015482565b60008060006103198460400151610ad3565b509150915083608001511561032f579392505050565b5092915050565b6000546001600160a01b031633146103955760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657260448201526064015b60405180910390fd5b60008151116103e65760405162461bcd60e51b815260206004820152601160248201527f6c656e6774682063616e27742062652030000000000000000000000000000000604482015260640161038c565b60005b81518160ff16101561042c5761041a828260ff168151811061040d5761040d6113cd565b60200260200101516105f3565b80610424816113f9565b9150506103e9565b5050565b6000546001600160a01b0316331461048a5760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572604482015260640161038c565b6104946000610ca6565b565b6001600160a01b038181166000908152600160205260408120549091166104ff5760405162461bcd60e51b815260206004820152601060248201527f76546f6b6e65206e6f7420657869737400000000000000000000000000000000604482015260640161038c565b6001600160a01b03821673a07c5b74c9b40447a954e1466938b865b6bbea361480159061054e57506001600160a01b038216600090815260016020526040902060020154600160a01b900460ff165b156105725761057073a07c5b74c9b40447a954e1466938b865b6bbea36610496565b505b6001600160a01b03808316600090815260016020818152604092839020835160c081018552815486168152928101549183019190915260028101549384169282019290925260ff600160a01b8404811615156060830152600160a81b909304909216151560808301526003015460a08201526105ed90610d03565b92915050565b6000546001600160a01b0316331461064d5760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572604482015260640161038c565b80516001600160a01b0381166106a55760405162461bcd60e51b815260206004820152601560248201527f63616e2774206265207a65726f20616464726573730000000000000000000000604482015260640161038c565b60408201516001600160a01b0381166107005760405162461bcd60e51b815260206004820152601560248201527f63616e2774206265207a65726f20616464726573730000000000000000000000604482015260640161038c565b82516001600160a01b03908116600090815260016020526040902054161561076a5760405162461bcd60e51b815260206004820152601b60248201527f746f6b656e20636f6e666967206d757374206e6f742065786973740000000000604482015260640161038c565b60008360a00151116107be5760405162461bcd60e51b815260206004820152601e60248201527f616e63686f7220706572696f64206d75737420626520706f7369746976650000604482015260640161038c565b60008360200151116108125760405162461bcd60e51b815260206004820152601a60248201527f6261736520756e6974206d75737420626520706f736974697665000000000000604482015260640161038c565b600061081d84610307565b84516001600160a01b03908116600090815260036020818152604080842042908190558a51861685526002808452828620919091558a518616855283835281852060019081018890558b518716865281845282862081018890558b51871686528084528286208c51815490891673ffffffffffffffffffffffffffffffffffffffff1990911681178255948d015191810191909155828c0151918101805460608e015160808f01511515600160a81b027fffffffffffffffffffff00ffffffffffffffffffffffffffffffffffffffffff911515600160a01b027fffffffffffffffffffffff00000000000000000000000000000000000000000090931695909a1694851791909117169790971790965560a08b0151959093018590555194955092939092917f3cc8d9cb9370a23a8b9ffa75efa24cecb65c4693980e58260841adc474983c5f91a450505050565b6000546001600160a01b031633146109c65760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572604482015260640161038c565b6001600160a01b038116610a425760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201527f6464726573730000000000000000000000000000000000000000000000000000606482015260840161038c565b610a4b81610ca6565b50565b6001600160a01b03818116600090815260016020526040812054909116610ab75760405162461bcd60e51b815260206004820152601060248201527f76546f6b656e206e6f7420657869737400000000000000000000000000000000604482015260640161038c565b506001600160a01b031660009081526004602052604090205490565b6000806000610ae0610f78565b9050836001600160a01b0316635909c0d56040518163ffffffff1660e01b8152600401602060405180830381865afa158015610b20573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610b449190611418565b9250836001600160a01b0316635a3d54936040518163ffffffff1660e01b8152600401602060405180830381865afa158015610b84573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610ba89190611418565b91506000806000866001600160a01b0316630902f1ac6040518163ffffffff1660e01b8152600401606060405180830381865afa158015610bed573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610c11919061144f565b9250925092508363ffffffff168163ffffffff1614610c9c576000610c36828661149f565b90508063ffffffff16610c498486610f8e565b51610c5d91906001600160e01b03166114c4565b610c6790886114e3565b96508063ffffffff16610c7a8585610f8e565b51610c8e91906001600160e01b03166114c4565b610c9890876114e3565b9550505b5050509193909250565b600080546001600160a01b0383811673ffffffffffffffffffffffffffffffffffffffff19831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b600080600080610d1285611057565b925092509250804211610d675760405162461bcd60e51b815260206004820152601a60248201527f6e6f77206d75737420636f6d65206166746572206265666f7265000000000000604482015260640161038c565b6000610d734283611194565b905060006040518060200160405280610d9f84610d99888a61119490919063ffffffff16565b906111a7565b6001600160e01b0316905290506000610db7826111b3565b905060008860600151610dd257670de0b6b3a7640000610ddc565b670de0b6b3a76400005b90506000610dfb82610d998c60200151866111d390919063ffffffff16565b9050896060015115610eb25773a07c5b74c9b40447a954e1466938b865b6bbea36600090815260046020527f72faa2cb4c4b06d6d2d22ce41a41bb81f612b77e5274782c24a39f5d318ec89b5490819003610e985760405162461bcd60e51b815260206004820152601460248201527f626e6220707269636520697320696e76616c6964000000000000000000000000604482015260640161038c565b610eae670de0b6b3a7640000610d9984846111d3565b9150505b80600003610f025760405162461bcd60e51b815260206004820152601660248201527f747761702070726963652063616e6e6f74206265203000000000000000000000604482015260640161038c565b89516040805183815260208101899052428183015290516001600160a01b03909216917f7d881580fb2bb7844e8ecf8df26510247c4bbea2735d40bf0d9ac33c0d9acd819181900360600190a298516001600160a01b031660009081526004602052604090208990555096979650505050505050565b6000610f8964010000000042611511565b905090565b6040805160208101909152600081526000826dffffffffffffffffffffffffffff1611610ffd5760405162461bcd60e51b815260206004820152601760248201527f4669786564506f696e743a204449565f42595f5a45524f000000000000000000604482015260640161038c565b6040805160208101909152806110456dffffffffffffffffffffffffffff85167bffffffffffffffffffffffffffff0000000000000000000000000000607088901b16611525565b6001600160e01b031690529392505050565b60008060008061106685610307565b85516001600160a01b0316600090815260026020908152604080832081518083019092528054808352600190910154928201929092529293506110aa904290611194565b90508660a00151811061115f57815187516001600160a01b0390811660009081526003602090815260408083209490945580860180518c51851684528584206001908101919091558c51851684526002835285842042908190558d518616855293869020018890558b5187519151865192835292820193909352938401526060830186905216907f87208a84ec7402c933c70c261e53b733a9f1c893d73e941a152435d58177a2649060800160405180910390a25b505084516001600160a01b03908116600090815260036020526040808220600101549751909216815220549095909350915050565b60006111a0828461154b565b9392505050565b60006111a08284611562565b80516000906105ed906612725dd1d243ab906001600160e01b0316611562565b60006111a082846114c4565b80356001600160a01b03811681146111f657600080fd5b919050565b60006020828403121561120d57600080fd5b6111a0826111df565b634e487b7160e01b600052604160045260246000fd5b604051601f8201601f1916810167ffffffffffffffff8111828210171561125557611255611216565b604052919050565b803580151581146111f657600080fd5b600060c0828403121561127f57600080fd5b60405160c0810181811067ffffffffffffffff821117156112a2576112a2611216565b6040529050806112b1836111df565b8152602083013560208201526112c9604084016111df565b60408201526112da6060840161125d565b60608201526112eb6080840161125d565b608082015260a083013560a08201525092915050565b600060c0828403121561131357600080fd5b6111a0838361126d565b6000602080838503121561133057600080fd5b823567ffffffffffffffff8082111561134857600080fd5b818501915085601f83011261135c57600080fd5b81358181111561136e5761136e611216565b61137c848260051b0161122c565b818152848101925060c091820284018501918883111561139b57600080fd5b938501935b828510156113c1576113b2898661126d565b845293840193928501926113a0565b50979650505050505050565b634e487b7160e01b600052603260045260246000fd5b634e487b7160e01b600052601160045260246000fd5b600060ff821660ff810361140f5761140f6113e3565b60010192915050565b60006020828403121561142a57600080fd5b5051919050565b80516dffffffffffffffffffffffffffff811681146111f657600080fd5b60008060006060848603121561146457600080fd5b61146d84611431565b925061147b60208501611431565b9150604084015163ffffffff8116811461149457600080fd5b809150509250925092565b600063ffffffff838116908316818110156114bc576114bc6113e3565b039392505050565b60008160001904831182151516156114de576114de6113e3565b500290565b600082198211156114f6576114f66113e3565b500190565b634e487b7160e01b600052601260045260246000fd5b600082611520576115206114fb565b500690565b60006001600160e01b038084168061153f5761153f6114fb565b92169190910492915050565b60008282101561155d5761155d6113e3565b500390565b600082611571576115716114fb565b50049056fea164736f6c634300080d000a";

type TwapOracleConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: TwapOracleConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class TwapOracle__factory extends ContractFactory {
  constructor(...args: TwapOracleConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  override deploy(
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<TwapOracle> {
    return super.deploy(overrides || {}) as Promise<TwapOracle>;
  }
  override getDeployTransaction(
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  override attach(address: string): TwapOracle {
    return super.attach(address) as TwapOracle;
  }
  override connect(signer: Signer): TwapOracle__factory {
    return super.connect(signer) as TwapOracle__factory;
  }

  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): TwapOracleInterface {
    return new utils.Interface(_abi) as TwapOracleInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): TwapOracle {
    return new Contract(address, _abi, signerOrProvider) as TwapOracle;
  }
}