
require("dotenv").config();


var express = require('express');
const ethers = require('ethers');
const { Web3 } = require('web3');
const Provider = require('@truffle/hdwallet-provider');

var app = express();
var port = process.env.PORT || 3000;

var SmartContractAddress = process.env.SC_ADDRESS;
var SmartContractABI = require('./xUSDabi2.json');
var address = process.env.ACC_ADDRESS;
const privatekey = process.env.ACC_PRIV_ADDRESS;
var rpcurl = process.env.INFURA;


// Infura URL for your Ethereum project
const infuraUrl = process.env.INFURA;

// Connect to Infura as the Ethereum provider
const provider = new ethers.providers.JsonRpcProvider(process.env.INFURA);

// Contract address and ABI (you need to provide these)
const contractAddress = process.env.SC_ADDRESS;
const contractAbi = require('./xUSDabi2.json');

// Create a contract instance
// Check if command-line arguments are provided
if (process.argv.length !== 4) {
  console.error('Usage: node temp.js <receiverAddress> <amount>');
  process.exit(1);
}

// Extract command-line arguments
const receiverAddress = process.argv[2];
const amount = process.argv[3];
const wallet = new ethers.Wallet(privatekey);
// Associate the provider with the wallet
wallet.connect(provider);
const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

// Function to check the contract's balance
async function getContractBalance() {
  try {
    // Call the 'balance' variable or method from your contract
    const balance = await contract.balance();

    // Convert the balance to a human-readable format (if needed)
    const formattedBalance = ethers.utils.formatUnits(balance, 18); // Assuming 18 decimal places

    return formattedBalance;
  } catch (error) {
    console.error('Error checking contract balance:', error);
    throw error;
  }
}

async function mintTokens(receiverAddress, amount) {
  try {
    // Call the 'mint' function from the contract (assuming 'mint' is the function name)
    const tx = await contract.mint(receiverAddress, amount);

    // Wait for the transaction to be mined
    await tx.wait();

    console.log(`Minted ${amount} tokens to ${receiverAddress}`);
  } catch (error) {
    console.error('Error minting tokens:', error);
  }
}

// Example usage
mintTokens(receiverAddress, amount);


// Usage example
// getContractBalance()
//   .then((balance) => {
//     console.log('Contract Balance:', balance);
//   })
//   .catch((error) => {
//     console.error('Failed to get contract balance:', error);
//   });



const sendData = async () => {

  console.log("in function");
  var provider = new Provider(privatekey, rpcurl);
  var web3 = new Web3(provider);
  var myContract = new web3.eth.Contract(SmartContractABI, SmartContractAddress);
  var oldvalue = await myContract.methods.balance.call();
  console.log("oldvalue", oldvalue);
}



app.listen(port);
console.log('listening on', port);