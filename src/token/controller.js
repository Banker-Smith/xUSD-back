require("dotenv").config();
const express = require("express");
const router = express.Router();

const {Web3} = require('web3'); // Crypto imports
const EthereumTx = require('ethereumjs-tx').Transaction;
const Binance = require('node-binance-api');
const Common = require('ethereumjs-common').default;

const web3 = new Web3(process.env.INFURA_ARBITRUM_TESTNET);
const sc_Address = process.env.SC_TESTNET;
const sc_ABI = require('./xUSDabi.json');
const contract = new web3.eth.Contract(sc_ABI, sc_Address); // smart contract initialization

const priv_Key = Buffer.from(process.env.ACC_PRIV_ADDRESS, 'hex'); 
const signer = web3.eth.accounts.privateKeyToAccount(priv_Key); // wallet initialization

const binance = new Binance().options({
    APIKEY: process.env.BINANCE_API_KEY,
    APISECRET: process.env.BINANCE_API_SECRET,
    'family': 4,
})

const common1 = Common.forCustomChain(
    'mainnet', {
        name: 'arbitrum',
        networkId: 42161,
        chainId: 42161,
    },
    'petersburg',
);

const common = Common.forCustomChain(
    'mainnet', {
        name: 'arbitrum-goerli',
        networkId: 421613,
        chainId: 421613,
    },
    'petersburg',
);

async function getTokenBalance(walletAddress) {
    try {
        const balance = await contract.methods.balanceOf(walletAddress).call();
        return balance;
    } catch (error) {
        console.error('Error checking token balance:', error);
        throw error;
    }
}

async function transferETH(address, amount) {
    try {
        const amountInWei = web3.utils.toWei(amount.toString(), 'ether');
        const nonce = await web3.eth.getTransactionCount(signer.address);
        
        const gasEstimate = await contract.methods.mint(address, amountInWei).estimateGas();
        const rawTransaction = {
            nonce: web3.utils.toHex(nonce),
            gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
            gasLimit: web3.utils.toHex(gasEstimate),
            to: address,
            value: amountInWei, // Convert amount to Wei
            data: '0x', // Empty data for a simple ETH transfer
          };

        const tx = new EthereumTx(rawTransaction, { common });
        tx.sign(priv_Key);

        const serializedTx = tx.serialize();
        const txHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
        return txHash;
    } catch (error){
        console.error('Error sending back ETH');
        throw error;
    }
}

async function processTokenTransaction(address, amount, method) {
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
        if (!amountOfETH || !priceOfEth || !receiverAddress || !amount) { return res.status(404).json({ error: "Arguments missing" }); }

        const minting_result = await processTokenTransaction(receiverAddress, amount, 'mint');
        
        setTimeout(async () => {
            try {
                processBinance(amountOfETH, priceOfEth, 'open', '');
            } catch (error) {
                await processTokenTransaction(receiverAddress, amount, 'burn');
                return res.status(501).json({error: "An error occured while opening a position"});
            }
        }, 2000);
        return res.status(200).json({txHash: minting_result.transactionHash})
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "An error occurred while minting tokens." });
    }
});

router.post("/burn", async (req, res) => {
    try {
        const { burnerAddress, amount, amountOfETH, priceOfEth } = req.body;
        if (!amountOfETH || !priceOfEth || !burnerAddress || !amount) { return res.status(404).json({error: "Arguments missing"});}
        
        getTokenBalance(burnerAddress)
            .then(async (balance) => {
                const balanceInEther = web3.utils.fromWei(balance, 'ether'); // Convert from Wei to Ether
                if (amount > balanceInEther) {return res.status(500).json({error: "Insufficient balance"}); }
                // Process the ETH transfer to the burnerAddress
                ethTransferHash = await transferETH(burnerAddress, amountOfETH);
                console.log(`ETH transfer transaction hash: ${ethTransferHash}`);
            })
            .catch((error) => {
                console.error('Error:', error);
            });
        
        processBinance(amountOfETH, priceOfEth, 'close', burnerAddress);
        const burning_result = await processTokenTransaction(burnerAddress, amount, 'burn');
        return res.status(200).json({ txHash: burning_result.transactionHash});
    } catch(error) {
        return res.status(500).json({error: "An error occured while burning tokens. "});
    }
});

module.exports = router;