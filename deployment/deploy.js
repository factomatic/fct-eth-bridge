const etherlime = require('etherlime-lib');
const Bridge = require('../build/Bridge.json');

// add account 1 priv key
const account1PrivKey = '';
// add account 2 priv key
const account2PrivKey = '';
const infuraAPIKey = 'f8d2169f70584df396394ad9ce130289';


const deploy = async (network, secret, etherscanApiKey) => {

    // request deadline may need to be changed
    let requestDeadline = 1574380800;

    const factomAnchorContractAddress = "0xfac701d9554a008e48b6307fb90457ba3959e8a8";
    // change output fct address
    const outputFctAddress = "0x50fc0b6f3cae9d7677bb1d84170cb595269216d0b381666999cf8d9663ccc637";
    // change request amount
    const requestedAmount = 36500000000;


    // deploy contract
    const deployer = new etherlime.InfuraPrivateKeyDeployer(account1PrivKey, network, infuraAPIKey);
    // deployer.setDefaultOverrides({gasPrice: 20000000000, gasLimit: 47000000});

    const contractWrapper = await deployer.deploy(Bridge, false, factomAnchorContractAddress);
    const contractAddress = contractWrapper.contractAddress;

    // issue new request
    const issueRequestTransaction = await contractWrapper
        .issueRequest(outputFctAddress, requestedAmount, requestDeadline, { value: 100 });
    await contractWrapper.verboseWaitForTransaction(issueRequestTransaction, 'Issue new request');

    // change provider private key
    deployer.setPrivateKey(account2PrivKey);
    const deployedContractWrapper = deployer.wrapDeployedContract(Bridge, contractAddress);
    
    // book request
    const requestId = 0;
    const bookRequestTransaction = await deployedContractWrapper.bookRequest(requestId);
    await deployedContractWrapper.verboseWaitForTransaction(bookRequestTransaction, 'Book request');

    // change transaction params
    const txTimestamp = "0x016db650c90a";
    const addressesCount = [2, 1, 0];
    const addresses = [
        "0x77fd94eacd8191bef2b42cef6108eaeae28d1674354e169e88a9e6f0eefa29e8",
        "0x2d9723cd1d4f288ba4ab4f03974255f402913a8ebd7bb71b009481b08e566159",
        "0x50fc0b6f3cae9d7677bb1d84170cb595269216d0b381666999cf8d9663ccc637"
    ];
    const amounts = [18340956058, 18159420942, 36500000000];
    const publicKeys = [
        "0x813f7e6a2d87d9918eae6866a5abe9fe2151a81a0cbd81f6f552898e5894c2fb",
        "0x51d3684db90b61283c08eabdd9d0660d43b5640f30787d0235dfc25c0a59afec"
    ];
    const signatures = [
        "0x185b9985bddb3a38ea8c8841c304194068bfd208ae3fe36618633ed9e33e2b30",
        "0x3ee8a7536f59f3894f72f075b8dbeb50dd288e39b64a524b8231c43c8303cb0c",
        "0xbd566a110053fbd16d8c5b4ff7afb6c9e56551bbf95ff97206a72778e3495aa7",
        "0x979889c1cce941f663342ad501a794367ec0641155c4f4475b3e3a6509c09806"
    ];
    const expectedTransactionHash = "0x59c31965f38c8d48dd75c612145106d5cdbaf6d7096b748470d4f5d196de400e";

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
    console.log("Expected transaction hash: " + expectedTransactionHash);
    console.log("Transaction hash: " + booking.txHash);

    // change fulfill request params
    const txBlockHeight = 214686;
    const txPathNodes = [
        "0x03eb27bd1d37eb072d62ae9a1e47f87ea81632b2e7e8f6df44c3bd4934532a7b",
        "0xb289dea92ca5aba5f2e1891a1af11be27914c48854db0fe5b4bb95c137e0f2d6",
        "0xf8d3ccccb4c4e6d5e2fefbff8c68aaf58d56528e3b6d8ebf07b4210cefe6a1f1",
        "0xaf84f2f8b909bc3e22d5f0c7b0b14b63bbd746e248432d4267da321f0134d8a8"
    ];
    const factoidBlockPathNodes = [
        "0x000000000000000000000000000000000000000000000000000000000000000f",
        "0xb5a1cdb2bb1d0e2e18e61aae49b560ba08879a4097cd4831ed999c916d6bef2f",
        "0x1f998e1c3395c6a3f291f5a1ae51427a71b087c165365ce5713cfbbead1beea3",
        "0xf76c679cd46fa331810978913a21e95d071ca100a064717b7703b9bdf399362b"
    ];
    const directoryBlockPathNodes = [
        "0xd60636295bf4d296e10d646fb57f9c50c7f6a8297e90bcf7404867b386af15ef",
        "0x1deb7137c9fe9e5fb06b22568b81fa822a62bf97401db6346884da8591940e89",
        "0x311043718bf6a81be819bd4e49906687ee8dceeeab6a19b9711daa04aec9ae34",
        "0x5250d0a7885eb9889124563d016629de874084523ad8a314617f503b3800faf9",
        "0x2baf52ac6a2429f67b8016cfa67993eec72c494d92dc2a05a256c7c9c942db59",
        "0xf3586e543ea7f321ebeb4132b92564ea223727e1e9dc5f83141caf84ad35a190",
        "0x0b057d969f01a2a73ae99b0c33dc8e8d173d8472f89ae5afec58d69b4d699d0e",
        "0xf1f8ab5abd5bdef707dfe5013491305de4b6f7bf6cde7e2b7fb8bc1192aace0b",
        "0xab47deafaf088ea1a90e205720a121dc956b4e7925c8eaab7a1424172577d5f2",
        "0x87d0102db74322c5a2febfd77030b930d6a3d2841b96f281e19e52d6e2a83397"
    ];
    const txPathPositions = [1, 0, 0, 0];
    const factoidBlockPathPositions = [1, 0, 1, 0];
    const directoryBlockPathPositions = [0, 0, 1, 1, 1, 0, 0, 0, 0, 0];
    const headerHashesAndMerkleRoots = [
        "0xc3704c36bc9effa531c463c1a0b846b02ca8bd02cd7971cc83e60abf38640503",
        "0xd2dd9b16ea6a52e562e38607afd165d5a376ce10f248acb97f2f2c49b33f8f9c",
        "0xa554f75368b6647ea4b8a27a29874ee893d5e8601530ef9ecf35950b37b55585",
        "0xf7f643fb990bbf03dfedf0e4655f5c4314a02fc96d9094d1ea7449d613d7e3fa",
        "0xa819509fbfe2fc1a2ef62af6e5a5cdcab173291b390285d23a9a6d0c29570057"
    ];

    let contractBalance = await deployedContractWrapper.utils.getBalance();
    console.log("Contract balance before fulfill: " + contractBalance);
    
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
    console.log("Contract balance after fulfill: " + contractBalance);

};

module.exports = {
	deploy
};
