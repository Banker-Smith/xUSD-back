const express = require('express');
const Web3 = require('web3');
const { Wallet, providers } = require('ethers');

const app = express();
const port = 3000;

// Replace with your Ethereum node URL
const ethereumNodeUrl = 'YOUR_ETHEREUM_NODE_URL';

// Load the contract ABI from a file
const contractABI = require('./xUSDABI.json');

// Replace with your contract address
const contractAddress = 'YOUR_CONTRACT_ADDRESS';

// Initialize web3
const web3 = new Web3(ethereumNodeUrl);

// Initialize contract instance
const contractInstance = new web3.eth.Contract(contractABI, contractAddress);

// Replace with your private key
const privateKey = 'YOUR_PRIVATE_KEY';

// Create a wallet
const wallet = new Wallet(privateKey, web3.currentProvider);

app.use(express.json());

// Mint tokens
app.post('/mint', async (req, res) => {
  const { receiver, quantity } = req.body;

  try {
    const tx = await contractInstance.methods.mint(receiver, quantity).send({
      from: wallet.address,
      gas: 2000000, // Adjust gas limit as needed
    });
    res.json({ transactionHash: tx.transactionHash });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Minting failed' });
  }
});

// Burn tokens
app.post('/burn', async (req, res) => {
  const { receiver, quantity } = req.body;

  try {
    const tx = await contractInstance.methods.burn(receiver, quantity).send({
      from: wallet.address,
      gas: 2000000, // Adjust gas limit as needed
    });
    res.json({ transactionHash: tx.transactionHash });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Burning failed' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
