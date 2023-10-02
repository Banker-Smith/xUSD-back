require("dotenv").config();
const express = require("express");
const router = express.Router();

const {Web3} = require('web3'); // Crypto imports
const EthereumTx = require('ethereumjs-tx').Transaction;

const web3 = new Web3(process.env.INFURA)

// smart contract initialization
const sc_Address = process.env.SC_ADDRESS;
const sc_ABI = require('./xUSDabi.json');
const contract = new web3.eth.Contract(sc_ABI, sc_Address);

// wallet initialization
const priv_Key = Buffer.from(process.env.ACC_PRIV_ADDRESS, 'hex');
const signer = web3.eth.accounts.privateKeyToAccount(priv_Key);


router.post("/mint", async (req, res) => {
    try {
        const { receiverAddress, amount } = req.body;
        if (!receiverAddress || !amount) { return res.status(400).json({ error: "Receiver address and amount are required." });}
    
        const amountInWei = web3.utils.toWei(amount.toString(), 'ether'); // Convert the amount to a BigNumber (Wei)
        const nonce = await web3.eth.getTransactionCount(signer.address); // Fetch the current nonce for the sender address
        
        const rawTransaction = {                // Create a raw transaction object
            nonce: web3.utils.toHex(nonce),
            gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
            gasLimit: web3.utils.toHex(300000), // Adjust the gas limit as needed
            to: sc_Address,
            data: contract.methods.mint(receiverAddress, amountInWei).encodeABI(),
        };
    
        const tx = new EthereumTx(rawTransaction, { 'chain': 'goerli' }); // Use the appropriate chain
        tx.sign(priv_Key);    // Sign the transaction
    
        const serializedTx = tx.serialize(); // Serialize the transaction and send it
        const txHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
    
        return res.status(200).json({ transactionHash: txHash.transactionHash });
    } catch (error) {
        console.error('Error minting tokens:', error);
        return res.status(500).json({ error: "An error occurred while minting tokens." });
    }
  });

router.post("/burn", async (req, res) => {
    try {
        const { burnerAddress, amount } = req.body;
        if (!burnerAddress || !amount) { return res.status(400).json({ error: "Burner address and amount are required." });}

        const amountInWei = web3.utils.toWei(amount.toString(), 'ether'); // Convert the amount to a BigNumber (Wei)
        const nonce = await web3.eth.getTransactionCount(signer.address); // Fetch the current nonce for the sender address
        
        const rawTransaction = { // Create a raw transaction object
            nonce: web3.utils.toHex(nonce),
            gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
            gasLimit: web3.utils.toHex(300000), // Adjust the gas limit as needed
            to: sc_Address,
            data: contract.methods.burn(burnerAddress, amountInWei).encodeABI(),
        };

        const tx = new EthereumTx(rawTransaction, { 'chain': 'goerli' }); // Use the appropriate chain
        tx.sign(priv_Key); // Sign the transaction
  
        const serializedTx = tx.serialize(); // Serialize the transaction and send it
        const txHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
    
        return res.status(200).json({ transactionHash: txHash.transactionHash });
    } catch(error) {
        console.error("Error burning tokens: ", error);
        return res.status(500).json({error: "An error occured while burning tokens. "});
    }
})

module.exports = router;