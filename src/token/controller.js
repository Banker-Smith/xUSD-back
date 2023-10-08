require("dotenv").config();
const express = require("express");
const router = express.Router();

const {Web3} = require('web3'); // Crypto imports
const EthereumTx = require('ethereumjs-tx').Transaction;
const Binance = require('node-binance-api');
const Common = require('ethereumjs-common').default;
const { LegacyTransaction } = require('@ethereumjs/tx');

const web3 = new Web3(process.env.INFURA)

// smart contract initialization
const sc_Address = process.env.SC_ADDRESS;
const sc_ABI = require('./xUSDabi.json');
const contract = new web3.eth.Contract(sc_ABI, sc_Address);

// wallet initialization
const priv_Key = Buffer.from(process.env.ACC_PRIV_ADDRESS, 'hex');
const signer = web3.eth.accounts.privateKeyToAccount(priv_Key);

// binance
const binance = new Binance().options({
    APIKEY: process.env.BINANCE_API_KEY,
    APISECRET: process.env.BINANCE_API_SECRET,
    'family': 4,
})

router.post("/mint", async (req, res) => {
    try {
        const { receiverAddress, amount, amountOfETH, priceOfEth } = req.body;
        /* 
        *  ------------------------------------------------------------------
        *   Binance Part
        *  ------------------------------------------------------------------  
        */

        // Define the chain configuration
        const common = Common.forCustomChain(
            'mainnet', {
                name: 'arbitrum-goerli',
                networkId: 42161,
                chainId: 42161,
            },
            'petersburg',
        );
        console.info(req.body);         
        if (!amountOfETH || !priceOfEth) { 
            return res.status(400).json({ error: "Price of eth and amount of eth not found" });
        }

        // Transfer amountOfEth from spot to coin-m
        console.info(await binance.universalTransfer("MAIN_CMFUTURE", "ETH", amountOfETH));

        // 1 cont is 10 dollars on binance, need to adjust the price accordingly
        const ONE_CONT = parseFloat(( 10 / priceOfEth).toFixed(5));
        const CONT_AMOUNT = parseInt((amountOfETH / ONE_CONT).toFixed(1));
        console.info("CONT_AMOUNT", CONT_AMOUNT);
        const position = await binance.deliveryMarketSell("ETHUSD_PERP", CONT_AMOUNT); // Opening a position
        console.info("CONT_AMOUNT2", CONT_AMOUNT);
        /* 
        *  ------------------------------------------------------------------
        *   Minting Part
        *  ------------------------------------------------------------------  
        */
        if (!receiverAddress || !amount) { 
            return res.status(400).json({ error: "Receiver address and amount are required." });
        }
    
        const amountInWei = web3.utils.toWei(amount.toString(), 'ether'); // Convert the amount to a BigNumber (Wei)
        const nonce = await web3.eth.getTransactionCount(signer.address); // Fetch the current nonce for the sender address
        
        const rawTransaction = {                // Create a raw transaction object
            nonce: web3.utils.toHex(nonce),
            gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
            gasLimit: web3.utils.toHex(300000), // Adjust the gas limit as needed
            to: sc_Address,
            data: contract.methods.mint(receiverAddress, amountInWei).encodeABI(),
        };

        const tx = new EthereumTx(rawTransaction, {common}); // Use the appropriate chain
        tx.sign(priv_Key);    // Sign the transaction
    
        const serializedTx = tx.serialize(); // Serialize the transaction and send it
        const txHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
        
        return res.status(200).json({ transactionHash: txHash.transactionHash});
    } catch (error) {
        console.error('Error minting tokens:', error);
        return res.status(500).json({ error: "An error occurred while minting tokens." });
    }
  });

router.post("/burn", async (req, res) => {
    try {
        const { burnerAddress, amount, amountOfETH, priceOfEth } = req.body;
        if (!burnerAddress || !amount) { return res.status(400).json({ error: "Burner address and amount are required." });}
        console.info(req.body);

        const amountInWei = web3.utils.toWei(amount.toString(), 'ether'); // Convert the amount to a BigNumber (Wei)
        const nonce = await web3.eth.getTransactionCount(signer.address); // Fetch the current nonce for the sender address
        
        const rawTransaction = { // Create a raw transaction object
            nonce: web3.utils.toHex(nonce),
            gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
            gasLimit: web3.utils.toHex(300000), // Adjust the gas limit as needed
            to: sc_Address,
            data: contract.methods.burn(burnerAddress, amountInWei).encodeABI(),
        };
        
        const common = Common.forCustomChain(
            'mainnet', {
                name: 'arbitrum-goerli',
                networkId: 42161,
                chainId: 42161,
            },
            'petersburg',
        );

        const tx = new EthereumTx(rawTransaction, {common}); // Use the appropriate chain
        tx.sign(priv_Key); // Sign the transaction
  
        const serializedTx = tx.serialize(); // Serialize the transaction and send it
        const txHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
        
        // Opening a position
        // 1 cont is 10 dollars, so we got to calculate how much eth that is
        if (!amountOfETH || !priceOfEth) { return res.status(400).json({ error: "Price of eth and amount of eth not found" });}

        const ONE_CONT = parseFloat(( 10 / priceOfEth).toFixed(5));
        const CONT_AMOUNT = parseInt((amountOfETH / ONE_CONT).toFixed(1));
        console.info("CONT_AMOUNT", CONT_AMOUNT);
        console.info(await binance.deliveryMarketBuy("ETHUSD_PERP", CONT_AMOUNT));
        await binance.universalTransfer("CMFUTURE_MAIN", "ETH", amountOfETH - 0.0008);

        const Binance = require('binance-api-node').default;
        const client2 = Binance({
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_API_SECRET,
        })
        console.log( await client2.withdraw({
            coin: 'ETH',
            network: 'ARBITRUM',
            address: burnerAddress,
            amount: amountOfETH - 0.0008,
            })
        );
        return res.status(200).json({ transactionHash: txHash.transactionHash});
    } catch(error) {
        console.error("Error burning tokens: ", error);
        return res.status(500).json({error: "An error occured while burning tokens. "});
    }
})

module.exports = router;