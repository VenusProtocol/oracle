import { ethers } from "hardhat";

const RESILIENT_ORACLE = "0xDe564a4C887d5ad315a19a96DC81991c98b12182";
const ACM = "0x526159A92A82afE5327d37Ef446b68FD9a5cA914";

const ACCOUNTS = {
  Guardian: "0x751Aa759cfBB6CE71A43b48e40e1cCcFC66Ba4aa",
  "Normal Timelock": "0x093565Bc20AA326F4209eBaF3a26089272627613",
  "Fasttrack Timelock": "0x32f71c95BC8F9d996f89c642f1a84d06B2484AE9",
  "Critical Timelock": "0xbfbc79D4198963e4a66270F3EfB1fdA0F382E49c",
};

const ACM_ABI = ["function hasRole(bytes32 role, address account) external view returns (bool)"];

const FUNCTIONS = [
  "setTokenConfig(TokenConfig)",
  "setOracle(address,address,uint8)",
  "enableOracle(address,uint8,bool)",
  "pause()",
  "unpause()",
];

async function main() {
  const acm = new ethers.Contract(ACM, ACM_ABI, ethers.provider);

  console.log(`ResilientOracle: ${RESILIENT_ORACLE}`);
  console.log(`ACM: ${ACM}\n`);

  for (const [name, address] of Object.entries(ACCOUNTS)) {
    console.log(`--- ${name} (${address}) ---`);
    for (const fn of FUNCTIONS) {
      // Replicate ACM logic: role = keccak256(abi.encodePacked(callingContract, functionSig))
      const role = ethers.utils.keccak256(ethers.utils.solidityPack(["address", "string"], [RESILIENT_ORACLE, fn]));
      const allowed = await acm.hasRole(role, address);
      console.log(`  ${allowed ? "✅" : "❌"} ${fn}`);
    }
    console.log();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
