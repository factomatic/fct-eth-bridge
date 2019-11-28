const fs = require('fs');
const ethers = require('ethers');
const toml = require('toml');
const Bridge = require('../build/Bridge.json');

const args = process.argv.slice(2);
const config = toml.parse(fs.readFileSync('./config.toml', 'utf-8'));
const contractAddress = config.contractAddress; 
const accountPrivKey = config.fctBuyRequest.ethPrivateKey;
const provider = ethers.getDefaultProvider('homestead');
const wallet = new ethers.Wallet(accountPrivKey, provider);
const contract = new ethers.Contract(contractAddress, Bridge.abi, wallet);

const requestId = args[0];
const txTimestamp = '0x016db650c90a';
const addressesCount = [2, 1, 0];
const addresses = ['0x77fd94eacd8191bef2b42cef6108eaeae28d1674354e169e88a9e6f0eefa29e8', '0x2d9723cd1d4f288ba4ab4f03974255f402913a8ebd7bb71b009481b08e566159', '0x50fc0b6f3cae9d7677bb1d84170cb595269216d0b381666999cf8d9663ccc637'];
const amounts = [18340956058, 18159420942, 36500000000];
const publicKeys = ['0x813f7e6a2d87d9918eae6866a5abe9fe2151a81a0cbd81f6f552898e5894c2fb', '0x51d3684db90b61283c08eabdd9d0660d43b5640f30787d0235dfc25c0a59afec'];
const signatures = ['0x185b9985bddb3a38ea8c8841c304194068bfd208ae3fe36618633ed9e33e2b30', '0x3ee8a7536f59f3894f72f075b8dbeb50dd288e39b64a524b8231c43c8303cb0c', '0xbd566a110053fbd16d8c5b4ff7afb6c9e56551bbf95ff97206a72778e3495aa7', '0x979889c1cce941f663342ad501a794367ec0641155c4f4475b3e3a6509c09806'];
const expectedTransactionHash = '0x59c31965f38c8d48dd75c612145106d5cdbaf6d7096b748470d4f5d196de400e';

const submitParamsTransaction = await deployedContractWrapper
  .submitBookedRequestTransactionParams(
      requestId,
      txTimestamp,
      addressesCount,
      addresses,
      amounts,
      publicKeys,
      signatures
  );
await deployedContractWrapper.verboseWaitForTransaction(submitParamsTransaction, 'Submit transaction params for booked request');

let booking = await deployedContractWrapper.bookings(requestId);
console.log('Expected transaction hash: ' + expectedTransactionHash);
console.log('Transaction hash: ' + booking.txHash);

const txBlockHeight = 213715;
const txPathNodes = ('0x03eb27bd1d37eb072d62ae9a1e47f87ea81632b2e7e8f6df44c3bd4934532a7b', '0xb289dea92ca5aba5f2e1891a1af11be27914c48854db0fe5b4bb95c137e0f2d6', '0xf8d3ccccb4c4e6d5e2fefbff8c68aaf58d56528e3b6d8ebf07b4210cefe6a1f1', '0xaf84f2f8b909bc3e22d5f0c7b0b14b63bbd746e248432d4267da321f0134d8a8');
const factoidBlockPathNodes = ('0x000000000000000000000000000000000000000000000000000000000000000f', '0xb5a1cdb2bb1d0e2e18e61aae49b560ba08879a4097cd4831ed999c916d6bef2f', '0x1f998e1c3395c6a3f291f5a1ae51427a71b087c165365ce5713cfbbead1beea3', '0xf76c679cd46fa331810978913a21e95d071ca100a064717b7703b9bdf399362b');
const directoryBlockPathNodes = ['0xa109e005f6355d1927a6e04ca7c3ac0deaeb7e01b221cd275ad4e7fccb2a0518', '0x4751a7efb51435557d276a50415941b63c155815c925f5f7b96e95e17ec86081', '0xbae82f20bb0a5b1f2f808405593206bc21046278754433bc7b0165d08da94f3d', '0x78cb447ef1d2d15dd0e9ec3e480817dfe2c7a62ebbdf54a40f4548a088fe1137', '0x2759a2f27ad14e18a73e7178c4cdc99466ab17695bb0d69a64602c16bff241ef', '0xb2c286e78362c8b4b2c0e3e31d188c0589f35fc6e406b42897622c075de2417c', '0xc96b2be1e3f5dc8faf435e3803bab343d7589a379ee7253db2c8116ca4ecf4f1', '0x01e1c46f04b6bbe75ca06c6d16c21e2b92212358cf9c8ceb1fb920e8c0f2f23d', '0x09979de59543c6e01e44028d898b9cf15c2112c9a70cb3ba0b8f03855c580ed1', '0x824c07cdf3cf6b3cf3b65943cafcf45d676a24f1a56e04c37c409adfc3b11e7d'];
const txPathPositions = (1, 0, 0, 0);
const factoidBlockPathPositions = (1, 0, 1, 0);
const directoryBlockPathPositions = (1, 1, 1, 0, 0, 1, 1, 1, 1, 1);
const headerHashesAndMerkleRoots = ['0xc3704c36bc9effa531c463c1a0b846b02ca8bd02cd7971cc83e60abf38640503', '0xd2dd9b16ea6a52e562e38607afd165d5a376ce10f248acb97f2f2c49b33f8f9c', '0xa554f75368b6647ea4b8a27a29874ee893d5e8601530ef9ecf35950b37b55585', '0xf7f643fb990bbf03dfedf0e4655f5c4314a02fc96d9094d1ea7449d613d7e3fa'];

let contractBalance = await deployedContractWrapper.utils.getBalance();
console.log('Contract balance before fulfilling request: ' + contractBalance);

const fulfillRequestTransaction = await deployedContractWrapper
  .fulfillRequest(
      requestId,
      txBlockHeight,
      txPathNodes,
      factoidBlockPathNodes,
      directoryBlockPathNodes,
      txPathPositions,
      factoidBlockPathPositions,
      directoryBlockPathPositions,
      headerHashesAndMerkleRoots
  );
  
await deployedContractWrapper.verboseWaitForTransaction(fulfillRequestTransaction, 'Fulfill request');

let request = await deployedContractWrapper.requests(requestId);
console.log(request);

contractBalance = await deployedContractWrapper.utils.getBalance();
console.log('Contract balance after fulfilling request: ' + contractBalance);

