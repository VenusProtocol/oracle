// npx hardhat deploy --network bsctestnet 
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/dist/types'


const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    getChainId,
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments
    const { deployer, dev } = await getNamedAccounts()
    console.log(deployer, dev, await getChainId());
    
    const res = await deploy('ChainlinkOracle', {
        from: deployer,
        log: true,
        deterministicDeployment: false,
    });

    console.log(`deployed to ${res.address}`);
 
}

export default func