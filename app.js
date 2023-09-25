require("dotenv").config();

const express = require('express');
const Web3 = require('web3');
const { Wallet, providers } = require('ethers');

const app = express();
const router = express.Router();
const port = 3001;
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");

// ---- crypto logic ------
const ethereumNodeUrl = 'YOUR_ETHEREUM_NODE_URL';
const contractABI = require('./xUSDABI.json');
const contractAddress = '0x98602C1474638a96990fa76DCe0653Eb96591f21';
const web3 = new Web3(ethereumNodeUrl);
const contractInstance = new web3.eth.Contract(contractABI, contractAddress);
const privateKey = 'ce4d5a965b368889b62f831ae00e15a9e9b29165d99b7703600288fb70c294c1';
const wallet = new Wallet(privateKey, web3.currentProvider);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cors());

app.use(function (req, res, next) {

  var allowedDomains = ['http://localhost:3000','https://app.nftq.org', 'https://nft-q.vercel.app/' ];
  var origin = req.headers.origin;
  if(allowedDomains.indexOf(origin) > -1){
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Accept');
  res.setHeader('Access-Control-Allow-Credentials', true);

  next();
})

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

router.get("/test", (req, res) => {
  console.log("Hello world");
  return res.status(200).send("Hello the world");
});

router.use("/api-docs", swaggerUi.serve);
router.get("/api-docs", swaggerUi.setup(swaggerDocument));

app.use(express.static("public"));
app.use("/api", router);

app.listen(port, () => {console.log(`Server is running on port ${port}`); });
