#!/bin/bash

# This shell script will verify the zksync deployed contracts on both explores:
#  - https://explorer.zksync.io
#  - https://era.zksync.network (based on Etherscan)
# Example of execution: $> ./verify-zksync-contracts.sh zksyncmainnet

network=$1

for deploymentFilePath in ../deployments/$network/*.json
do
  address=`jq -r '.address' $deploymentFilePath`
  args=`jq -cM '.args | join(" ")' $deploymentFilePath | tr -d '"'`
  echo $address $args
  yarn hardhat verify --network $network $address --config ../hardhat.config.zksync.ts $args
done
