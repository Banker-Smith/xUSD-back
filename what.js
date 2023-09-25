require("dotenv").config();
const ethers = require('ethers');

// Infura URL for your Ethereum project
const infuraUrl = process.env.INFURA;

// Connect to Infura as the Ethereum provider
const provider = new ethers.providers.JsonRpcProvider(infuraUrl);

// Contract address and ABI (you need to provide these)
const contractAddress = 'YOUR_CONTRACT_ADDRESS';
const contractAbi = [
  // Include the relevant ABI methods here
];

// Create a contract instance
const contract = new ethers.Contract(contractAddress, contractAbi, provider);

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

// Usage example
getContractBalance()
  .then((balance) => {
    console.log('Contract Balance:', balance);
  })
  .catch((error) => {
    console.error('Failed to get contract balance:', error);
  });
