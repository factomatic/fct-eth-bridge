pragma solidity ^0.5.0;

interface FactomAnchor {
    function getAnchor(uint256 blockNumber) external view returns (uint256);
}

contract Bridge {

  /*
  * Enums
  */

  enum RequestStatus { REQUESTED, BOOKED, FULFILLED }

  /*
  * Storage
  */

  address public owner;

  address public factomAnchorContract;

  bool public frozen;

  Request[] public requests;

  mapping(uint => Booking) public bookings; // requestId -> booker address

  /*
  * Structs
  */

  struct Request {
      address payable issuer;
      bytes32 fctAddress; // base58 decoded without the first 2 and last 4 bytes
      uint256 depositedAmount; //in wei
      uint256 requestedAmount; //in fct
      uint256 timestamp;
      uint256 deadline;
      RequestStatus status;
  }

  struct Booking {
      address payable booker;
      uint256 timeLimit; // after the time limit is passed the request is open to be booked again
      bytes32 txHash;
  }

  constructor(address _factomAnchorContract) public {
      owner = msg.sender;
      factomAnchorContract = _factomAnchorContract;
  }

  /**
  * @dev issueRequest(): instantiates a new request
  * @param _fctAddress the FCT address where the issuer wants to receive the funds (base58 decoded without the first 2 and last 4 bytes)
  * @param _requestedAmount the amount of FCT which the issuer wants to receive for the deposited ether
  * @param _deadline the unix timestamp after which bookings and fulfillments will no longer be accepted
  */
  function issueRequest(
      bytes32 _fctAddress,
      uint256 _requestedAmount,
      uint256 _deadline
  )
      public
      payable
      onlyNotFrozen
      onlyPositiveDepositedValue()
      onlyPositiveRequestedAmount(_requestedAmount)
      onlyValidDeadline(_deadline)
      returns (uint256 requestId)
  {
      requests.push(Request(msg.sender, _fctAddress, msg.value, _requestedAmount, now, _deadline, RequestStatus.REQUESTED));
      emit RequestIssued(requests.length - 1, msg.sender, msg.value);
      return (requests.length - 1);
  }

  /**
  * @dev bookRequest(): books an existing request
  * @param _requestId the id of the request to book
  */
  function bookRequest(
      uint256 _requestId
  )
      public
      onlyNotFrozen
      onlyExistingRequest(_requestId)
      hasStatus(_requestId, RequestStatus.REQUESTED)
      onlyBeforeDeadline(_requestId)
      notIssuer(_requestId)
  {
      bookings[_requestId].booker = msg.sender;
      bookings[_requestId].timeLimit = now + 2 hours;
      requests[_requestId].status = RequestStatus.BOOKED;
      emit RequestBooked(_requestId, msg.sender);
  }

  /**
  * @dev rebookRequest(): rebooks an already booked request if it is open for booking
  * @param _requestId the id of the request to rebook
  */
  function rebookRequest(
      uint256 _requestId
  )
      public
      onlyNotFrozen
      onlyExistingRequest(_requestId)
      hasStatus(_requestId, RequestStatus.BOOKED)
      onlyAfterBookTimeLimit(_requestId)
      onlyBeforeDeadline(_requestId)
      notIssuer(_requestId)
  {
      bookings[_requestId].booker = msg.sender;
      bookings[_requestId].timeLimit = now + 2 hours;
      emit RequestBooked(_requestId, msg.sender);
  }

  /**
  * @dev submitBookedRequestTransactionParams(): computes a transaction hash for a booked request with the submitted parameters
  */
  function submitBookedRequestTransactionParams(
      uint256 _requestId,
      bytes memory txTimestamp,
      uint8[] memory addressesCount,
      bytes32[] memory addresses,
      uint[] memory amounts,
      bytes32[] memory publicKeys,
      bytes32[] memory signatures
  )
      public
      onlyNotFrozen
      onlyExistingRequest(_requestId)
      hasStatus(_requestId, RequestStatus.BOOKED)
      onlyBooker(_requestId)
  {
      require(now < bookings[_requestId].timeLimit, "The book time limit has passed");
      require(now < requests[_requestId].deadline, "The request deadline has passed");

      uint256 txTimestampUint = convertTxTimestampToUint256(txTimestamp);
      require(requests[_requestId].timestamp < txTimestampUint, "The transaction was recorded before the request");

      uint outputIndex = addressesCount[0];
      require(requests[_requestId].fctAddress == addresses[outputIndex], "Invalid output address");

      require(requests[_requestId].requestedAmount <= amounts[outputIndex], "Invalid transaction amount");

      bookings[_requestId].txHash = computeTxHash(txTimestamp, addressesCount, addresses, amounts, publicKeys, signatures);
  }

  /**
  * @dev fulfillRequest(): fulfills a booked request
  */
  function fulfillRequest(
      uint256 _requestId,
      uint256 txBlockHeight,
      bytes32[] memory txPathNodes,
      bytes32[] memory factoidBlockPathNodes,
      bytes32[] memory directoryBlockPathNodes,
      uint8[] memory txPathPositions,
      uint8[] memory factoidBlockPathPositions,
      uint8[] memory directoryBlockPathPositions,
      bytes32[] memory headerHashesAndMerkleRoots
  )
      public
      onlyNotFrozen
      onlyExistingRequest(_requestId)
      hasStatus(_requestId, RequestStatus.BOOKED)
      onlyBooker(_requestId)
  {
      require(now < bookings[_requestId].timeLimit, "The book time limit has passed");
      require(bookings[_requestId].txHash != hex"00", "Transaction hash is not computed");
      require(now < requests[_requestId].deadline, "The request deadline has passed");

      verifyTransaction(bookings[_requestId].txHash, txBlockHeight, txPathNodes,
        factoidBlockPathNodes, directoryBlockPathNodes, txPathPositions,
        factoidBlockPathPositions, directoryBlockPathPositions, headerHashesAndMerkleRoots);

      requests[_requestId].status = RequestStatus.FULFILLED;
      bookings[_requestId].booker.transfer(requests[_requestId].depositedAmount);
  }

  /**
  * @dev withdrawRequestFunds(): withdraws funds for not fulfilled and expired request
  * @param _requestId the id of the request to withdraw funds for
  */
  function withdrawRequestFunds(
      uint256 _requestId
  )
      public
      onlyExistingRequest(_requestId)
      onlyIssuer(_requestId)
      onlyAfterDeadlineOrBeforeBook(_requestId)
      onlyNotFulfilledRequest(_requestId)
  {
      Request memory request = requests[_requestId];
      request.issuer.transfer(request.depositedAmount);
  }

  /**
  * @dev freeze(): freezes the contract and allows only withdrawals
  */
  function freeze() public onlyOwner {
      frozen = true;
      emit ContractFrozen();
  }

  /**
  * @dev kill(): destroys the contract
  */
  function kill() public onlyOwner {
      selfdestruct(address(0x0));
  }

  function computeTxHash(
      bytes memory txTimestamp,
      uint8[] memory addressesCount,
      bytes32[] memory addresses,
      uint[] memory amounts,
      bytes32[] memory publicKeys,
      bytes32[] memory signatures
  )
      internal
      pure
      returns (bytes32)
  {

      bytes memory buf;
      buf = mergeBytes(buf, hex"02");
      buf = mergeBytes(buf, txTimestamp);
      buf = mergeBytes(buf, abi.encodePacked(uint8(addressesCount[0])));
      buf = mergeBytes(buf, abi.encodePacked(uint8(addressesCount[1])));
      buf = mergeBytes(buf, abi.encodePacked(uint8(addressesCount[2])));

      for (uint i = 0; i < addresses.length; i++) {
        bytes memory output = mergeBytes(varIntEncode(amounts[i]), abi.encodePacked(addresses[i]));
        buf = mergeBytes(buf, output);
      }

      for (uint j = 0; j < addressesCount[0]; j++) {
        buf = mergeBytes(buf, abi.encodePacked(uint8(0x01)));
        buf = mergeBytes(buf, abi.encodePacked(publicKeys[j]));
        buf = mergeBytes(buf, abi.encodePacked(signatures[2*j]));
        buf = mergeBytes(buf, abi.encodePacked(signatures[2*j + 1]));
      }

      return sha256(buf);
  }

  function verifyTransaction(
      bytes32 txHash,
      uint256 txBlockHeight,
      bytes32[] memory txPathNodes,
      bytes32[] memory factoidBlockPathNodes,
      bytes32[] memory directoryBlockPathNodes,
      uint8[] memory txPathPositions,
      uint8[] memory factoidBlockPathPositions,
      uint8[] memory directoryBlockPathPositions,
      bytes32[] memory headerHashesAndMerkleRoots
  )
      internal
      view
  {
      require(verifyMerklePath(headerHashesAndMerkleRoots[1], txHash, txPathNodes, txPathPositions),
        "Invalid factoid block merkle root");

      bytes32 factoidBlockKeyMr = sha256(abi.encodePacked(headerHashesAndMerkleRoots[0], headerHashesAndMerkleRoots[1]));
      require(verifyMerklePath(headerHashesAndMerkleRoots[3], factoidBlockKeyMr, factoidBlockPathNodes, factoidBlockPathPositions),
        "Invalid directory block merkle root");

      bytes32 directoryBlockKeyMr = sha256(abi.encodePacked(headerHashesAndMerkleRoots[2], headerHashesAndMerkleRoots[3]));

      uint256 merkleRoot = FactomAnchor(factomAnchorContract).getAnchor(txBlockHeight);
      bytes32 windowMerkleRoot = bytes32(merkleRoot);

      require(verifyMerklePath(windowMerkleRoot, directoryBlockKeyMr, directoryBlockPathNodes, directoryBlockPathPositions),
        "Invalid window merkle root");
  }

  function varIntEncode(uint number) internal pure returns (bytes memory) {
      bytes memory buf;
      if (number == 0) {
        buf = mergeBytes(buf, abi.encodePacked(uint8(0x00)));
      }

      uint h = number;
      bool start = false;
      if((0x8000000000000000 & h) != 0) {
        buf = mergeBytes(buf, abi.encodePacked(uint8(0x81)));
        start = true;
      }

      for (uint i = 0; i<9; i++) {
        uint b = h / 2 ** 56;
        if (b != 0 || start) {
          start = true;
          if (i != 8) {
              b = b | 0x80;
          } else {
              b = b & 0x7F;
          }

          if (b >= 256) {
              b = b % 256;
          }

          buf = mergeBytes(buf, abi.encodePacked(uint8(b)));
        }

        h = h * 2 ** 7;
      }

      return buf;
  }

  function convertTxTimestampToUint256(bytes memory txTimestamp) internal pure returns (uint256) {
      uint256 result = 0;
      uint256 multiplier = 1;

      for(uint i = txTimestamp.length - 1; i > 0; i--) {
        if (txTimestamp[i] == 0x00) {
          continue;
        }

        result += multiplier * uint8(txTimestamp[i]);
        multiplier *= 256;
      }

      result += multiplier * uint8(txTimestamp[0]);
      return result / 1000;
  }

  function verifyMerklePath(
      bytes32 merkleRoot,
      bytes32 data,
      bytes32[] memory nodes,
      uint8[] memory positions
  )
      internal
      pure
      returns(bool)
  {
      bytes32 dataHash = data;

      for(uint i = 0; i < nodes.length; i++) {
        if(positions[i] == 1) {
          dataHash = sha256(abi.encodePacked(nodes[i], dataHash));
        } else {
          dataHash = sha256(abi.encodePacked(dataHash, nodes[i]));
        }
      }

      return dataHash == merkleRoot;
  }

  function mergeBytes(bytes memory a, bytes memory b) internal pure returns (bytes memory c) {
      // Store the length of the first array
      uint alen = a.length;
      // Store the length of BOTH arrays
      uint totallen = alen + b.length;
      // Count the loops required for array a (sets of 32 bytes)
      uint loopsa = (a.length + 31) / 32;
      // Count the loops required for array b (sets of 32 bytes)
      uint loopsb = (b.length + 31) / 32;
      assembly {
        let m := mload(0x40)
        // Load the length of both arrays to the head of the new bytes array
        mstore(m, totallen)
        // Add the contents of a to the array
        for {  let i := 0 } lt(i, loopsa) { i := add(1, i) } { mstore(add(m, mul(32, add(1, i))), mload(add(a, mul(32, add(1, i))))) }
        // Add the contents of b to the array
        for {  let i := 0 } lt(i, loopsb) { i := add(1, i) } { mstore(add(m, add(mul(32, add(1, i)), alen)), mload(add(b, mul(32, add(1, i))))) }
        mstore(0x40, add(m, add(32, totallen)))
        c := m
      }
  }

  /**
  * Modifiers
  */

  modifier onlyOwner() {
      require(msg.sender == owner, "Caller is not contract owner");
      _;
  }

  modifier onlyPositiveDepositedValue() {
      require(msg.value > 0, "Deposited value is not positive");
      _;
  }

  modifier onlyPositiveRequestedAmount(uint256 _requestedAmount) {
      require(_requestedAmount > 0, "Requested amount is not positive");
      _;
  }

  modifier onlyValidDeadline(uint256 _deadline) {
      require(_deadline > now, "Invalid deadline");
      _;
  }

  modifier onlyExistingRequest(uint256 _requestId) {
      require(_requestId >= 0 && _requestId < requests.length, "Non-existent request id");
      _;
  }

  modifier onlyIssuer(uint256 _requestId) {
      require(requests[_requestId].issuer == msg.sender, "Caller is not request issuer");
      _;
  }

  modifier notIssuer(uint256 _requestId) {
      require(msg.sender != requests[_requestId].issuer, "Caller is request issuer");
      _;
  }

  modifier onlyBeforeDeadline(uint256 _requestId) {
      require(now < requests[_requestId].deadline, "The request deadline has passed");
      _;
  }

  modifier onlyAfterDeadlineOrBeforeBook(uint256 _requestId) {
      require(now > requests[_requestId].deadline || requests[_requestId].status == RequestStatus.REQUESTED,
        "The request has been booked and the deadline has not passed");
      _;
  }

  modifier onlyAfterBookTimeLimit(uint256 _requestId) {
      require(now > bookings[_requestId].timeLimit, "The book time limit has not passed");
      _;
  }

  modifier onlyBooker(uint256 _requestId) {
      require(bookings[_requestId].booker == msg.sender, "Caller is not the booker of the request");
      _;
  }

  modifier hasStatus(uint256 _requestId, RequestStatus _desiredStatus) {
      require(requests[_requestId].status == _desiredStatus, "Invalid request status");
      _;
  }

  modifier onlyNotFulfilledRequest(uint256 _requestId) {
      require(requests[_requestId].status != RequestStatus.FULFILLED, "The request has been fulfilled");
      _;
  }

  modifier onlyNotFrozen() {
      require(frozen == false, "The contract is frozen");
      _;
  }

  /**
  * Events
  */

  event RequestIssued(uint256 requestId, address issuer, uint256 amount);
  event RequestBooked(uint256 requestId, address booker);
  event ContractFrozen();
}