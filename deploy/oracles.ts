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
    
    await deploy('ResilientOracle', {
        from: deployer,
        log: true,
        deterministicDeployment: false,
        proxy: {
            proxyContract: 'OptimizedTransparentProxy',
            execute: {
                methodName: 'initialize',
                args: []
            }
        }
    });


    await deploy('ChainlinkOracle', {
        from: deployer,
        log: true,
        deterministicDeployment: false,
        proxy: {
            proxyContract: 'OptimizedTransparentProxy',
            execute: {
                methodName: 'initialize',
                args: []
            }
        }
    });

    const vBNBAddress = '0xa07c5b74c9b40447a954e1466938b865b6bbea36';

    await deploy('PivotTwapOracle', {
        from: deployer,
        log: true,
        deterministicDeployment: false,
        proxy: {
            proxyContract: 'OptimizedTransparentProxy',
            execute: {
                methodName: 'initialize',
                args: [vBNBAddress]
            }
        }
    });

    // @todo: just testnet address, will be replaced to mainnet version in the future
    const actualPythOracleAddress = '0xd7308b14BF4008e7C7196eC35610B1427C5702EA';

    await deploy('PythOracle', {
        from: deployer,
        log: true,
        deterministicDeployment: false,
        proxy: {
            proxyContract: 'OptimizedTransparentProxy',
            execute: {
                methodName: 'initialize',
                args: [actualPythOracleAddress]
            }
        }
    });
}

export default func
