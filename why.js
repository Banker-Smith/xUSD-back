require("dotenv").config();

var express = require('express');
const { Web3 } = require('web3');
const ethers = require('ethers');
const EthereumTx = require('ethereumjs-tx').Transaction; // Import EthereumTx library

var app = express();
var port = process.env.PORT || 3000;

var SmartContractAddress = process.env.SC_ADDRESS;
var SmartContractABI = require('./xUSDabi.json');

var privateKey = Buffer.from(process.env.ACC_PRIV_ADDRESS, 'hex'); // Convert private key to buffer
const web3 = new Web3('https://goerli.infura.io/v3/077ba21fca0c46a4b1ed8c7ddbb5b0e9'); // Use HTTPS instead of WSS
const signer = web3.eth.accounts.privateKeyToAccount(privateKey);

const contract = new web3.eth.Contract(SmartContractABI, SmartContractAddress);

const sendData = async () => {
  try {
    const nonce = web3.utils.toHex(await web3.eth.getTransactionCount(signer.address));
    const gasPrice = web3.utils.toHex(await web3.eth.getGasPrice());
    const gasLimit = web3.utils.toHex(200000); // Adjust the gas limit as needed
    
    const rawTransaction = {
      nonce: nonce,
      gasPrice: gasPrice,
      gasLimit: gasLimit,
      to: SmartContractAddress,
      data: contract.methods.mint("0x74E4ad43c1EB21D0D1872F43Ed6ee29A813d890D", 5000000000000000).encodeABI(),
    };
    

    // Sign the transaction
    const tx = new EthereumTx(rawTransaction, { 'chain': 'goerli' }); // Use the appropriate chain
    tx.sign(privateKey);

    // Serialize the transaction and send it
    const serializedTx = tx.serialize();
    const txHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
    
    console.log(`Transaction sent with hash: ${txHash.transactionHash}`);
  } catch (error) {
    console.error('Error sending transaction:', error);
  }
}

sendData();

app.listen(port);
console.log('Listening on', port);
