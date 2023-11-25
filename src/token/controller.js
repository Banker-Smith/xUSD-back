require("dotenv").config();
const express = require("express");
const router = express.Router();
const {Web3} = require('web3');
const EthereumTx = require('ethereumjs-tx').Transaction;
const Binance = require('node-binance-api');
const Common = require('ethereumjs-common').default;
const {http, createWalletClient,parseEther} = require('viem');
const {goerli, baseGoerli, lineaTestnet} = require('viem/chains');
const {privateKeyToAccount} = require('viem/accounts');

const account = privateKeyToAccount('0x' + process.env.ACC_PRIV_ADDRESS);

const binance = new Binance().options({
    APIKEY: process.env.BINANCE_API_KEY,
    APISECRET: process.env.BINANCE_API_SECRET,
    'family': 4,
});

const viemMap = {
    "goerli": goerli,
    "baseGoerli": baseGoerli,
    "lineaTestnet": lineaTestnet,
};

const commonMap = {
    "goerli": Common.forCustomChain(
      'mainnet',
      {
        name: 'goerli',
        networkId: 5,
        chainId: 5,
      },
      'petersburg'
    ),
    "baseGoerli": Common.forCustomChain(
      'mainnet',
      {
        name: 'base goerli',
        networkId: 84531,
        chainId: 84531,
      },
      'petersburg'
    ),
    "lineaTestnet": Common.forCustomChain(
      'mainnet',
      {
        name: 'linea testnet',
        networkId: 59140,
        chainId: 59140,
      },
      'petersburg'
    ),
};

async function getTokenBalance(walletAddress) {
    try {
        const balance = await contract.methods.balanceOf(walletAddress).call();
        return balance;
    } catch (error) {
        console.error('Error checking token balance:', error);
        throw error;
    }
}

function setupWeb3(chain) {
    const web3 = new Web3(process.env[`INFURA_${chain.toUpperCase()}`]);
    const sc_Address = process.env[`SC_${chain.toUpperCase()}`];
    const sc_ABI = require('./xUSDabi.json');
    const priv_Key = Buffer.from(process.env.ACC_PRIV_ADDRESS, 'hex'); 
    
    const contract = new web3.eth.Contract(sc_ABI, sc_Address);
    const signer = web3.eth.accounts.privateKeyToAccount(priv_Key);

    return {web3, contract, signer, sc_Address};
}

async function transferETH(address, amount, ViemWalletClient) {
    try {
        const hash = await ViemWalletClient.sendTransaction({
            to: address,
            value: parseEther(amount.toString())
        });
        return hash;
    } catch (error){
        console.error('Error sending back ETH');
        throw error;
    }
}

async function processTokenTransaction(address, amount, method, common, web3, contract, signer, sc_Address) {
    try {
        const amountInWei = web3.utils.toWei(amount.toString(), 'ether');
        const nonce = await web3.eth.getTransactionCount(signer.address);
        
        const gasEstimate = await contract.methods.mint(address, amountInWei).estimateGas();
      
        const rawTransaction = {
            nonce: web3.utils.toHex(nonce),
            gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
            gasLimit: web3.utils.toHex(gasEstimate),
            to: sc_Address,
            data: method === 'mint' ? 
                contract.methods.mint(address, amountInWei).encodeABI() 
                : 
                contract.methods.burn(address, amountInWei).encodeABI(),
        };

        const tx = new EthereumTx(rawTransaction, { common });
        tx.sign(priv_Key);

        const serializedTx = tx.serialize();
        const txHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
        return txHash;

    } catch (error) {
        console.error(`Error ${method === 'mint' ? 'minting' : 'burning'} tokens:`, error);
        throw error; // Rethrow the error
    }
}

async function processBinance(amountOfETH, priceOfEth, method, burnerAddress) {
    const ONE_CONT = 10; // 1 cont is 10 dollars on Binance
    const ONE_CONT_IN_ETH = ONE_CONT / priceOfEth;

    const SPOT_TO_COINM_TRANSFER_FEE = 0.0009; // Fee for transferring from spot to coin-m
    try {
        // Calculate the number of conts
        const contAmount = (amountOfETH / ONE_CONT_IN_ETH).toFixed(0);
        console.log("cont", contAmount);
        if (method === 'open') {
            // Transfer amountOfETH from spot to coin-m
            await binance.universalTransfer('MAIN_CMFUTURE', 'ETH', amountOfETH).then( async() => {
                // Opening a position by selling ETHUSD_PERP contracts
                console.log(await binance.deliveryMarketSell('ETHUSD_PERP', contAmount));
            });
        } else {
            // Closing a position by buying ETHUSD_PERP contracts
            await binance.deliveryMarketBuy('ETHUSD_PERP', contAmount).then(async () => {
                // Transfer ETH back to the spot account, subtracting the transfer fee
                await binance.universalTransfer('CMFUTURE_MAIN', 'ETH', amountOfETH - SPOT_TO_COINM_TRANSFER_FEE);
            })
            console.log(burnerAddress);
            
            // For MVP, we do not withdraw. If you want to enable withdrawal, you can use the following code:
            /*
            const client2 = binance({
                apiKey: process.env.BINANCE_API_KEY,
                apiSecret: process.env.BINANCE_API_SECRET,
            });

            console.log('withdraw', await client2.withdraw({
                coin: 'ETH',
                network: 'ARBITRUM',
                address: burnerAddress,
                amount: amountOfETH - 0.0002, // You can adjust the withdrawal amount
            }));
            */
        }
    } catch (error) {
        console.error(`Error ${method === 'open' ? 'opening' : 'closing'} position:`, error);
        throw error;
    }
}

router.post("/mint", async (req, res) => {
    const { receiverAddress, amount, amountOfETH, priceOfEth } = req.body;
    try {
        if (!amountOfETH || !priceOfEth || !receiverAddress || !amount || !chain) { 
            return res.status(404).json({ error: "Arguments missing" }); 
        }

        const common = commonMap[chain];
        const minting_result = await processTokenTransaction(receiverAddress, amount, 'mint', common);
        const { web3, contract, signer, sc_Address } = setupWeb3(chain);

        setTimeout(async () => {
            try {
                processBinance(amountOfETH, priceOfEth, 'open', '');
            } catch (error) {
                await processTokenTransaction(receiverAddress, amount, 'burn', common, web3, contract, signer, sc_Address);
                return res.status(501).json({error: "An error occured while opening a position"});
            }
        }, 1000);
        return res.status(200).json({txHash: minting_result.transactionHash})
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "An error occurred while minting tokens." });
    }
});

router.post("/burn", async (req, res) => {
    try {
        const { burnerAddress, amount, amountOfETH, priceOfEth, chain } = req.body;
        if (!amountOfETH || !priceOfEth || !burnerAddress || !amount || !chain) { 
            return res.status(404).json({error: "Arguments missing"});
        }
        const common = commonMap[chain];
        const viemChain = viemMap[chain];
        const ViemWalletClient = createWalletClient({
            account,
            chain: viemChain,
            transport: http(process.env[`INFURA_${chain.toUpperCase()}`]),
        });
        const { web3, contract, signer, sc_Address } = setupWeb3(chain);

        getTokenBalance(burnerAddress)
            .then(async (balance) => {
                const balanceInEther = web3.utils.fromWei(balance, 'ether'); // Convert from Wei to Ether
                if (amount > balanceInEther) {return res.status(500).json({error: "Insufficient balance"}); }
                ethTransferHash = await transferETH(burnerAddress, amountOfETH, ViemWalletClient);
                console.log(`ETH transfer transaction hash: ${ethTransferHash}`);
            })
            .catch((error) => {
                console.error('Error:', error);
            });
        
        processBinance(amountOfETH, priceOfEth, 'close', burnerAddress);
        const burning_result = await processTokenTransaction(burnerAddress, amount, 'burn', common, web3, contract, signer, sc_Address);
        return res.status(200).json({ txHash: burning_result.transactionHash});
    } catch(error) {
        return res.status(500).json({error: "An error occured while burning tokens. "});
    }
});

module.exports = router;
