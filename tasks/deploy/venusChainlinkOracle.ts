import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("deploy:Oracle").setAction(async function (taskArguments: TaskArguments, { ethers }) {
  const signers: SignerWithAddress[] = await ethers.getSigners();
  const oracleFactory = await ethers.getContractFactory("Greeter");
  const oracle = await oracleFactory.connect(signers[0]).deploy(taskArguments.greeting);
  await oracle.deployed();
  console.log("Oracle deployed to: ", oracle.address);
});
