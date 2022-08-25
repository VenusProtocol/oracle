/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type {
  FunctionFragment,
  Result,
  EventFragment,
} from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
  PromiseOrValue,
} from "../../common";

export type TokenConfigStruct = {
  vToken: PromiseOrValue<string>;
  baseUnit: PromiseOrValue<BigNumberish>;
  pancakePool: PromiseOrValue<string>;
  isBnbBased: PromiseOrValue<boolean>;
  isReversedPool: PromiseOrValue<boolean>;
  anchorPeriod: PromiseOrValue<BigNumberish>;
};

export type TokenConfigStructOutput = [
  string,
  BigNumber,
  string,
  boolean,
  boolean,
  BigNumber
] & {
  vToken: string;
  baseUnit: BigNumber;
  pancakePool: string;
  isBnbBased: boolean;
  isReversedPool: boolean;
  anchorPeriod: BigNumber;
};

export interface TwapOracleInterface extends utils.Interface {
  functions: {
    "VBNB()": FunctionFragment;
    "addTokenConfig((address,uint256,address,bool,bool,uint256))": FunctionFragment;
    "addTokenConfigs((address,uint256,address,bool,bool,uint256)[])": FunctionFragment;
    "bnbBaseUnit()": FunctionFragment;
    "busdBaseUnit()": FunctionFragment;
    "currentCumulativePrice((address,uint256,address,bool,bool,uint256))": FunctionFragment;
    "expScale()": FunctionFragment;
    "getUnderlyingPrice(address)": FunctionFragment;
    "newObservations(address)": FunctionFragment;
    "oldObservations(address)": FunctionFragment;
    "owner()": FunctionFragment;
    "prices(address)": FunctionFragment;
    "renounceOwnership()": FunctionFragment;
    "tokenConfigs(address)": FunctionFragment;
    "transferOwnership(address)": FunctionFragment;
    "updateTwap(address)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "VBNB"
      | "addTokenConfig"
      | "addTokenConfigs"
      | "bnbBaseUnit"
      | "busdBaseUnit"
      | "currentCumulativePrice"
      | "expScale"
      | "getUnderlyingPrice"
      | "newObservations"
      | "oldObservations"
      | "owner"
      | "prices"
      | "renounceOwnership"
      | "tokenConfigs"
      | "transferOwnership"
      | "updateTwap"
  ): FunctionFragment;

  encodeFunctionData(functionFragment: "VBNB", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "addTokenConfig",
    values: [TokenConfigStruct]
  ): string;
  encodeFunctionData(
    functionFragment: "addTokenConfigs",
    values: [TokenConfigStruct[]]
  ): string;
  encodeFunctionData(
    functionFragment: "bnbBaseUnit",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "busdBaseUnit",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "currentCumulativePrice",
    values: [TokenConfigStruct]
  ): string;
  encodeFunctionData(functionFragment: "expScale", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "getUnderlyingPrice",
    values: [PromiseOrValue<string>]
  ): string;
  encodeFunctionData(
    functionFragment: "newObservations",
    values: [PromiseOrValue<string>]
  ): string;
  encodeFunctionData(
    functionFragment: "oldObservations",
    values: [PromiseOrValue<string>]
  ): string;
  encodeFunctionData(functionFragment: "owner", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "prices",
    values: [PromiseOrValue<string>]
  ): string;
  encodeFunctionData(
    functionFragment: "renounceOwnership",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "tokenConfigs",
    values: [PromiseOrValue<string>]
  ): string;
  encodeFunctionData(
    functionFragment: "transferOwnership",
    values: [PromiseOrValue<string>]
  ): string;
  encodeFunctionData(
    functionFragment: "updateTwap",
    values: [PromiseOrValue<string>]
  ): string;

  decodeFunctionResult(functionFragment: "VBNB", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "addTokenConfig",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "addTokenConfigs",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "bnbBaseUnit",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "busdBaseUnit",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "currentCumulativePrice",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "expScale", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "getUnderlyingPrice",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "newObservations",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "oldObservations",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "prices", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "renounceOwnership",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "tokenConfigs",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferOwnership",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "updateTwap", data: BytesLike): Result;

  events: {
    "AnchorPriceUpdated(address,uint256,uint256,uint256)": EventFragment;
    "OwnershipTransferred(address,address)": EventFragment;
    "TokenConfigAdded(address,address,uint256)": EventFragment;
    "TwapWindowUpdated(address,uint256,uint256,uint256,uint256)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "AnchorPriceUpdated"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "OwnershipTransferred"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "TokenConfigAdded"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "TwapWindowUpdated"): EventFragment;
}

export interface AnchorPriceUpdatedEventObject {
  vToken: string;
  price: BigNumber;
  oldTimestamp: BigNumber;
  newTimestamp: BigNumber;
}
export type AnchorPriceUpdatedEvent = TypedEvent<
  [string, BigNumber, BigNumber, BigNumber],
  AnchorPriceUpdatedEventObject
>;

export type AnchorPriceUpdatedEventFilter =
  TypedEventFilter<AnchorPriceUpdatedEvent>;

export interface OwnershipTransferredEventObject {
  previousOwner: string;
  newOwner: string;
}
export type OwnershipTransferredEvent = TypedEvent<
  [string, string],
  OwnershipTransferredEventObject
>;

export type OwnershipTransferredEventFilter =
  TypedEventFilter<OwnershipTransferredEvent>;

export interface TokenConfigAddedEventObject {
  vToken: string;
  pancakePool: string;
  anchorPeriod: BigNumber;
}
export type TokenConfigAddedEvent = TypedEvent<
  [string, string, BigNumber],
  TokenConfigAddedEventObject
>;

export type TokenConfigAddedEventFilter =
  TypedEventFilter<TokenConfigAddedEvent>;

export interface TwapWindowUpdatedEventObject {
  vToken: string;
  oldTimestamp: BigNumber;
  oldAcc: BigNumber;
  newTimestamp: BigNumber;
  newAcc: BigNumber;
}
export type TwapWindowUpdatedEvent = TypedEvent<
  [string, BigNumber, BigNumber, BigNumber, BigNumber],
  TwapWindowUpdatedEventObject
>;

export type TwapWindowUpdatedEventFilter =
  TypedEventFilter<TwapWindowUpdatedEvent>;

export interface TwapOracle extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: TwapOracleInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    VBNB(overrides?: CallOverrides): Promise<[string]>;

    addTokenConfig(
      config: TokenConfigStruct,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    addTokenConfigs(
      configs: TokenConfigStruct[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    bnbBaseUnit(overrides?: CallOverrides): Promise<[BigNumber]>;

    busdBaseUnit(overrides?: CallOverrides): Promise<[BigNumber]>;

    currentCumulativePrice(
      config: TokenConfigStruct,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    expScale(overrides?: CallOverrides): Promise<[BigNumber]>;

    getUnderlyingPrice(
      vToken: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    newObservations(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber] & { timestamp: BigNumber; acc: BigNumber }
    >;

    oldObservations(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber] & { timestamp: BigNumber; acc: BigNumber }
    >;

    owner(overrides?: CallOverrides): Promise<[string]>;

    prices(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    renounceOwnership(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    tokenConfigs(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<
      [string, BigNumber, string, boolean, boolean, BigNumber] & {
        vToken: string;
        baseUnit: BigNumber;
        pancakePool: string;
        isBnbBased: boolean;
        isReversedPool: boolean;
        anchorPeriod: BigNumber;
      }
    >;

    transferOwnership(
      newOwner: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    updateTwap(
      vToken: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;
  };

  VBNB(overrides?: CallOverrides): Promise<string>;

  addTokenConfig(
    config: TokenConfigStruct,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  addTokenConfigs(
    configs: TokenConfigStruct[],
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  bnbBaseUnit(overrides?: CallOverrides): Promise<BigNumber>;

  busdBaseUnit(overrides?: CallOverrides): Promise<BigNumber>;

  currentCumulativePrice(
    config: TokenConfigStruct,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  expScale(overrides?: CallOverrides): Promise<BigNumber>;

  getUnderlyingPrice(
    vToken: PromiseOrValue<string>,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  newObservations(
    arg0: PromiseOrValue<string>,
    overrides?: CallOverrides
  ): Promise<[BigNumber, BigNumber] & { timestamp: BigNumber; acc: BigNumber }>;

  oldObservations(
    arg0: PromiseOrValue<string>,
    overrides?: CallOverrides
  ): Promise<[BigNumber, BigNumber] & { timestamp: BigNumber; acc: BigNumber }>;

  owner(overrides?: CallOverrides): Promise<string>;

  prices(
    arg0: PromiseOrValue<string>,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  renounceOwnership(
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  tokenConfigs(
    arg0: PromiseOrValue<string>,
    overrides?: CallOverrides
  ): Promise<
    [string, BigNumber, string, boolean, boolean, BigNumber] & {
      vToken: string;
      baseUnit: BigNumber;
      pancakePool: string;
      isBnbBased: boolean;
      isReversedPool: boolean;
      anchorPeriod: BigNumber;
    }
  >;

  transferOwnership(
    newOwner: PromiseOrValue<string>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  updateTwap(
    vToken: PromiseOrValue<string>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  callStatic: {
    VBNB(overrides?: CallOverrides): Promise<string>;

    addTokenConfig(
      config: TokenConfigStruct,
      overrides?: CallOverrides
    ): Promise<void>;

    addTokenConfigs(
      configs: TokenConfigStruct[],
      overrides?: CallOverrides
    ): Promise<void>;

    bnbBaseUnit(overrides?: CallOverrides): Promise<BigNumber>;

    busdBaseUnit(overrides?: CallOverrides): Promise<BigNumber>;

    currentCumulativePrice(
      config: TokenConfigStruct,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    expScale(overrides?: CallOverrides): Promise<BigNumber>;

    getUnderlyingPrice(
      vToken: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    newObservations(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber] & { timestamp: BigNumber; acc: BigNumber }
    >;

    oldObservations(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber] & { timestamp: BigNumber; acc: BigNumber }
    >;

    owner(overrides?: CallOverrides): Promise<string>;

    prices(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    renounceOwnership(overrides?: CallOverrides): Promise<void>;

    tokenConfigs(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<
      [string, BigNumber, string, boolean, boolean, BigNumber] & {
        vToken: string;
        baseUnit: BigNumber;
        pancakePool: string;
        isBnbBased: boolean;
        isReversedPool: boolean;
        anchorPeriod: BigNumber;
      }
    >;

    transferOwnership(
      newOwner: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<void>;

    updateTwap(
      vToken: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  filters: {
    "AnchorPriceUpdated(address,uint256,uint256,uint256)"(
      vToken?: PromiseOrValue<string> | null,
      price?: null,
      oldTimestamp?: null,
      newTimestamp?: null
    ): AnchorPriceUpdatedEventFilter;
    AnchorPriceUpdated(
      vToken?: PromiseOrValue<string> | null,
      price?: null,
      oldTimestamp?: null,
      newTimestamp?: null
    ): AnchorPriceUpdatedEventFilter;

    "OwnershipTransferred(address,address)"(
      previousOwner?: PromiseOrValue<string> | null,
      newOwner?: PromiseOrValue<string> | null
    ): OwnershipTransferredEventFilter;
    OwnershipTransferred(
      previousOwner?: PromiseOrValue<string> | null,
      newOwner?: PromiseOrValue<string> | null
    ): OwnershipTransferredEventFilter;

    "TokenConfigAdded(address,address,uint256)"(
      vToken?: PromiseOrValue<string> | null,
      pancakePool?: PromiseOrValue<string> | null,
      anchorPeriod?: PromiseOrValue<BigNumberish> | null
    ): TokenConfigAddedEventFilter;
    TokenConfigAdded(
      vToken?: PromiseOrValue<string> | null,
      pancakePool?: PromiseOrValue<string> | null,
      anchorPeriod?: PromiseOrValue<BigNumberish> | null
    ): TokenConfigAddedEventFilter;

    "TwapWindowUpdated(address,uint256,uint256,uint256,uint256)"(
      vToken?: PromiseOrValue<string> | null,
      oldTimestamp?: null,
      oldAcc?: null,
      newTimestamp?: null,
      newAcc?: null
    ): TwapWindowUpdatedEventFilter;
    TwapWindowUpdated(
      vToken?: PromiseOrValue<string> | null,
      oldTimestamp?: null,
      oldAcc?: null,
      newTimestamp?: null,
      newAcc?: null
    ): TwapWindowUpdatedEventFilter;
  };

  estimateGas: {
    VBNB(overrides?: CallOverrides): Promise<BigNumber>;

    addTokenConfig(
      config: TokenConfigStruct,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    addTokenConfigs(
      configs: TokenConfigStruct[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    bnbBaseUnit(overrides?: CallOverrides): Promise<BigNumber>;

    busdBaseUnit(overrides?: CallOverrides): Promise<BigNumber>;

    currentCumulativePrice(
      config: TokenConfigStruct,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    expScale(overrides?: CallOverrides): Promise<BigNumber>;

    getUnderlyingPrice(
      vToken: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    newObservations(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    oldObservations(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    owner(overrides?: CallOverrides): Promise<BigNumber>;

    prices(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    renounceOwnership(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    tokenConfigs(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    transferOwnership(
      newOwner: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    updateTwap(
      vToken: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    VBNB(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    addTokenConfig(
      config: TokenConfigStruct,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    addTokenConfigs(
      configs: TokenConfigStruct[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    bnbBaseUnit(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    busdBaseUnit(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    currentCumulativePrice(
      config: TokenConfigStruct,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    expScale(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    getUnderlyingPrice(
      vToken: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    newObservations(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    oldObservations(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    owner(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    prices(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    renounceOwnership(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    tokenConfigs(
      arg0: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    transferOwnership(
      newOwner: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    updateTwap(
      vToken: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
}