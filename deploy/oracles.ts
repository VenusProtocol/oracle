// npx hardhat deploy --network bsctestnet 
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/dist/types'

// import networks from '@venusprotocol/venus-protocol/networks/mainnet.json';

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    network
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

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
        contract: network.live ? 'ChainlinkOracle' : 'MockChainlinkOracle',
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

    // @todo: just testnet address, will be replaced to mainnet version in the future
    const WBNBAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";

    await deploy('PivotTwapOracle', {
        contract: network.live ? 'PivotTwapOracle' : 'MockPivotTwapOracle',
        from: deployer,
        log: true,
        deterministicDeployment: false,
        proxy: {
            proxyContract: 'OptimizedTransparentProxy',
            execute: {
                methodName: 'initialize',
                args: [WBNBAddress]
            }
        }
    });

    // @todo: just testnet address, will be replaced to mainnet version in the future
    const actualPythOracleAddress = '0xd7308b14BF4008e7C7196eC35610B1427C5702EA';

    await deploy('PythOracle', {
        contract: network.live ? 'PythOracle' : 'MockPythOracle',
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

    // @todo: just testnet address, will be replaced to mainnet version in the future
    const actualBinanceFeedRegistryAddress = '0x999DD49FeFdC043fDAC4FE12Bb1e4bb31cB4c47B';

    await deploy('BinanceOracle', {
        contract: network.live ? 'BinanceOracle' : 'MockBinanceOracle',
        from: deployer,
        log: true,
        deterministicDeployment: false,
        proxy: {
            proxyContract: 'OptimizedTransparentProxy',
            execute: {
                methodName: 'initialize',
                args: [actualBinanceFeedRegistryAddress]
            }
        }
    });
}

export default func
